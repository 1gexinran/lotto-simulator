import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { expect, it, vi } from 'vitest'
import { createStore, InvalidRound, type Command, type Round } from '../../src/round'
import { scoreTicket, RULES } from '../../src/game'

function setup() {
  const factory = new IDBFactory()
  let serial = 0
  const dependencies = {
    identity: { id: () => String(++serial), now: () => new Date('2026-11-22T15:00:00Z') },
    rng: vi.fn(() => 0),
  }
  const store = createStore(factory, dependencies)
  return { factory, store, dependencies }
}

it('restores partial marks, separates game drafts, and omits a cleared middle board', async () => {
  const { store } = setup()
  let round = await store.restore()
  const act = async (command: Command) => { round = (await store.dispatch(round, command)).round }
  await act({ type: 'choose', game: 'pb' })
  await act({ type: 'wholeQuick' })
  await act({ type: 'move', step: 1 })
  await act({ type: 'mark', pool: 'white', value: 42 })
  expect((await store.restore()).drafts.pb.lines[1].white).toEqual([42])
  await act({ type: 'move', step: -1 })
  await act({ type: 'move', step: 1 })
  expect(round.drafts.pb.lines[1].white).toEqual([42])
  await act({ type: 'move', step: 1 })
  expect(round.drafts.pb.active).toBe(1)
  await act({ type: 'wholeQuick' })
  await act({ type: 'move', step: 1 })
  await act({ type: 'wholeQuick' })
  await act({ type: 'move', step: -1 })
  await act({ type: 'clear' })
  await act({ type: 'chooser' })
  await act({ type: 'choose', game: 'mm' })
  expect(round.drafts.mm.lines).toHaveLength(1)
  await act({ type: 'chooser' })
  await act({ type: 'choose', game: 'pb' })
  await act({ type: 'finish' })
  expect(round.phase).toBe('review')
  const scenario = round.scenarios.pb
  await act({ type: 'edit' })
  await act({ type: 'finish' })
  expect(round.scenarios.pb).toEqual(scenario)
  await act({ type: 'confirm' })
  expect(round.ticket?.payment).toBe('cash')
  expect(round.ticket?.lines.map(line => line.letter)).toEqual(['A', 'C'])
  expect(round.ticket?.totalCents).toBe(400)
})

it('replaces and removes QP marks per pool before issuing', async () => {
  const { store } = setup()
  let round = await store.restore()
  const act = async (command: Command) => { round = (await store.dispatch(round, command)).round }
  await act({ type: 'choose', game: 'mm' })
  await act({ type: 'mark', pool: 'special', value: 7 })
  await act({ type: 'poolQuick', pool: 'white' })
  expect(round.drafts.mm.lines[0]).toMatchObject({ whiteQuick: true, special: 7 })
  await act({ type: 'poolQuick', pool: 'white' })
  expect(round.drafts.mm.lines[0]).toMatchObject({ whiteQuick: false, white: [] })
  await act({ type: 'wholeQuick' })
  await act({ type: 'mark', pool: 'special', value: 12 })
  expect(round.drafts.mm.lines[0]).toMatchObject({ whiteQuick: true, specialQuick: false, special: 12 })
})

async function review(store: ReturnType<typeof createStore>, game: 'pb' | 'mm' = 'pb') {
  let round = await store.restore()
  for (const command of [
    { type: 'choose', game }, { type: 'wholeQuick' },
    { type: 'payment', value: 'annuity' }, { type: 'finish' },
  ] satisfies Command[]) round = (await store.dispatch(round, command)).round
  return round
}

it('issues one ticket and creates one draw across concurrent connections', async () => {
  const { store, factory, dependencies } = setup()
  const second = createStore(factory, dependencies)
  const draft = await review(store, 'mm')
  const [a, b] = await Promise.all([
    store.dispatch(draft, { type: 'confirm' }), second.dispatch(draft, { type: 'confirm' }),
  ])
  expect([a.outcome, b.outcome].sort()).toEqual(['already', 'applied'])
  expect(a.round.ticket).toEqual(b.round.ticket)
  expect(dependencies.rng).toHaveBeenCalledTimes(7)
  const [c, d] = await Promise.all([
    store.dispatch(a.round, { type: 'start' }), second.dispatch(b.round, { type: 'start' }),
  ])
  expect([c.outcome, d.outcome].sort()).toEqual(['already', 'applied'])
  expect(c.round.draw).toEqual(d.round.draw)
  expect(dependencies.rng).toHaveBeenCalledTimes(13)
  const complete = await second.restore()
  expect(complete).toMatchObject({ phase: 'complete', draw: c.round.draw, ticket: a.round.ticket })
  expect((await store.dispatch(c.round, { type: 'complete' })).round).toEqual(complete)
  const result = scoreTicket(complete.ticket!, complete.draw!, RULES.mm)
  expect(result.jackpotShares).toBe(1)
  const fresh = (await store.dispatch(complete, { type: 'again' })).round
  expect(fresh.id).not.toBe(complete.id)
  expect((await second.dispatch(complete, { type: 'start' })).round).toEqual(fresh)
})

it('returns the newest revision for a stale edit without overwriting it', async () => {
  const { store } = setup()
  const blank = await store.restore()
  const selected = (await store.dispatch(blank, { type: 'choose', game: 'pb' })).round
  const first = (await store.dispatch(selected, { type: 'mark', pool: 'white', value: 8 })).round
  const stale = await store.dispatch(selected, { type: 'mark', pool: 'white', value: 9 })
  expect(stale).toEqual({ round: first, outcome: 'stale' })
  expect((await store.restore()).drafts.pb.lines[0].white).toEqual([8])
})

it('retains the review after a failed write and commits a single ticket on retry', async () => {
  const { store } = setup()
  const draft = await review(store)
  const sabotage = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw new Error('disk unavailable')
  })
  try {
    await expect(store.dispatch(draft, { type: 'confirm' })).rejects.toThrow('disk unavailable')
    expect(await store.restore()).toEqual(draft)
    const receipt = await store.dispatch(draft, { type: 'confirm' })
    expect(receipt).toMatchObject({ outcome: 'applied', round: { phase: 'issued' } })
    expect(await store.restore()).toEqual(receipt.round)
  } finally {
    sabotage.mockRestore()
  }
})

it.each(['edition', 'sparse boards'])('retains an unreadable record (%s) until an explicit fresh-round request', async (problem) => {
  const { store, factory } = setup()
  const record = await store.restore()
  const unknown = problem === 'edition' ? { ...record, edition: 'other-edition' } : {
    ...record, game: 'pb', phase: 'edit',
    drafts: { ...record.drafts, pb: { ...record.drafts.pb, lines: Array(1) } },
  }
  await new Promise<void>((resolve, reject) => {
    const request = factory.open('live-lotto')
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('rounds', 'readwrite')
      tx.objectStore('rounds').put(unknown, 'current')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = reject
    }
    request.onerror = reject
  })
  await expect(store.restore()).rejects.toBeInstanceOf(InvalidRound)
  await expect(store.restore()).rejects.toBeInstanceOf(InvalidRound)
  const fresh: Round = await store.replaceUnreadable()
  expect(fresh).toMatchObject({ phase: 'choose', revision: 0 })
  expect(fresh.id).not.toBe(record.id)
  expect(await store.restore()).toEqual(fresh)
})

it('creates a single replacement outcome for an issued ticket across racing redraws', async () => {
  const { store, factory, dependencies } = setup()
  const second = createStore(factory, dependencies)
  const ready = await review(store, 'mm')
  const issued = (await store.dispatch(ready, { type: 'confirm' })).round
  const first = (await store.dispatch(issued, { type: 'start' })).round
  const complete = (await store.dispatch(first, { type: 'complete' })).round
  expect(scoreTicket(complete.ticket!, complete.draw!, RULES.mm).jackpotShares).toBe(1)

  dependencies.rng.mockReturnValue(1)
  const receipts = await Promise.all([
    store.dispatch(complete, { type: 'redraw' }), second.dispatch(complete, { type: 'redraw' }),
  ])
  expect(receipts.filter(receipt => receipt.outcome === 'applied')).toHaveLength(1)
  const replacement = receipts[0].round
  expect(receipts[1].round).toEqual(replacement)
  expect(replacement).toMatchObject({ phase: 'revealing', drawAttempt: 2, ticket: issued.ticket })
  expect(replacement.draw?.white).toEqual([2, 3, 4, 5, 6])
  expect((await store.dispatch(first, { type: 'complete' })).outcome).toBe('stale')
  const restored = await second.restore()
  expect(restored.phase).toBe('complete')
  expect(scoreTicket(restored.ticket!, restored.draw!, RULES.mm)).toMatchObject({ jackpotShares: 0, fixedCents: 100_000 })
})

it('loads an older unpaid draft with Cash value and keeps a saved annuity election', async () => {
  const { store, factory } = setup()
  const blank = await store.restore()
  const selected = (await store.dispatch(blank, { type: 'choose', game: 'pb' })).round
  const previous = {
    ...selected, drafts: {
      pb: { ...selected.drafts.pb, payment: null },
      mm: { ...selected.drafts.mm, payment: 'annuity' },
    },
  }
  await new Promise<void>((resolve, reject) => {
    const request = factory.open('live-lotto')
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('rounds', 'readwrite')
      tx.objectStore('rounds').put(previous, 'current')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = reject
    }
    request.onerror = reject
  })
  const restored = await store.restore()
  expect(restored.drafts.pb.payment).toBe('cash')
  expect(restored.drafts.mm.payment).toBe('annuity')
})

it('honors Home when another tab completed the same ticket first', async () => {
  const { store } = setup()
  const ready = await review(store)
  const issued = (await store.dispatch(ready, { type: 'confirm' })).round
  const revealing = (await store.dispatch(issued, { type: 'start' })).round
  const complete = (await store.dispatch(revealing, { type: 'complete' })).round

  const home = await store.dispatch(revealing, { type: 'chooser' })
  expect(home).toMatchObject({
    outcome: 'applied',
    round: { atChooser: true, phase: 'complete', ticket: complete.ticket, draw: complete.draw },
  })
  expect((await store.restore()).atChooser).toBe(true)
})
