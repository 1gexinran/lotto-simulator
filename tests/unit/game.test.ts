import { describe, expect, it } from 'vitest'
import {
  classifyLine, createDraw, createScenario, cryptoInteger, emptyDraft, issueTicket,
  quote, RULES, scoreTicket, type Draw, type Game, type IssuedTicket, type LineDraft,
  type Multiplier,
} from '../../src/game'

const ids = { id: () => 'fixture', now: () => new Date('2026-11-22T14:30:00Z') }
const line = (white: number[], special: number | null): LineDraft =>
  ({ white, special, whiteQuick: false, specialQuick: false })
const low = () => 0
const multipliers = [2, 3, 4, 5, 10] as const

it('checks exact pool sizes, bounds and uniqueness independently', () => {
  const pb = RULES.pb
  const mm = RULES.mm
  expect(classifyLine(line([], null), pb)).toBe('blank')
  expect(classifyLine(line([1, 2, 3, 26, 69], 26), pb)).toBe('complete')
  expect(classifyLine(line([1, 2, 3, 24, 70], 24), mm)).toBe('complete')
  for (const invalid of [
    line([1, 2, 3, 4, 70], 26), line([1, 2, 3, 4, 69], 27),
    line([1, 2, 3, 3, 69], 26), line([0, 2, 3, 4, 69], 26),
    line([1, 2, 3, 4, 4.5], 26), line([1, 2, 3, 4], 26),
    line([1, 2, 3, 4, 5, 6], 26), line([1, 2, 3, 4, 5], null),
  ]) expect(classifyLine(invalid, pb)).toBe('partial')
  expect(classifyLine(line([1, 2, 3, 4, 71], 24), mm)).toBe('partial')
  expect(classifyLine(line([1, 2, 3, 4, 70], 25), mm)).toBe('partial')
})

it('quotes only complete boards, preserving their original letters', () => {
  const draft = emptyDraft()
  draft.lines[0] = { ...line([7, 21, 5, 11, 9], null), specialQuick: true }
  draft.lines[2] = { ...line([], 7), whiteQuick: true }
  expect(quote(draft, RULES.pb)).toMatchObject({
    letters: ['A', 'C'], totalCents: 400, errors: [{ field: 'payment' }],
  })
  draft.powerPlay = true
  expect(quote(draft, RULES.pb).totalCents).toBe(600)
  expect(quote(draft, RULES.mm).totalCents).toBe(1000)
  draft.lines[1] = line([7], null)
  expect(quote(draft, RULES.pb).errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ letter: 'B', field: 'white' }),
    expect.objectContaining({ letter: 'B', field: 'special' }),
  ]))
  expect(() => issueTicket(draft, createScenario(RULES.pb, ids), RULES.pb, low, ids)).toThrow()
  draft.lines[1] = line([], null)
  draft.payment = 'cash'
  expect(issueTicket(draft, createScenario(RULES.pb, ids), RULES.pb, low, ids).lines).toEqual([
    { letter: 'A', white: [5, 7, 9, 11, 21], special: 1, whiteOrigin: 'manual', specialOrigin: 'quick' },
    { letter: 'C', white: [1, 2, 3, 4, 5], special: 7, whiteOrigin: 'quick', specialOrigin: 'manual' },
  ])
})

it('uses the next Eastern drawing strictly after the scenario instant across daylight changes', () => {
  const at = (game: Game, now: string) =>
    createScenario(RULES[game], { ...ids, now: () => new Date(now) }).drawAt
  expect(at('pb', '2026-11-22T14:30:00Z')).toBe('2026-11-24T03:59:00.000Z')
  expect(at('pb', '2026-11-24T03:59:00Z')).toBe('2026-11-26T03:59:00.000Z')
  expect(at('mm', '2026-03-06T18:00:00Z')).toBe('2026-03-07T04:00:00.000Z')
  expect(at('mm', '2026-03-07T04:00:00Z')).toBe('2026-03-11T03:00:00.000Z')
})

it('exhausts all integer weight slots at the Power Play boundary and for Mega Millions', () => {
  const powers = (estimate: number, slots: number) => Array.from({ length: slots }, (_, slot) =>
    createDraw(createScenario(RULES.pb, ids, estimate), RULES.pb, limit => limit === slots ? slot : 0).powerPlay)
  const repeated = (weights: number[]) => multipliers.flatMap((value, index) => Array<number>(weights[index]).fill(value))
  expect(powers(15_000_000_000, 43)).toEqual(repeated([24, 13, 3, 2, 1]))
  expect(powers(15_000_000_100, 42)).toEqual(repeated([24, 13, 3, 2, 0]))
  const draft = emptyDraft()
  draft.payment = 'annuity'
  draft.lines[0] = line([1, 2, 3, 4, 5], 7)
  const mm = RULES.mm
  expect(Array.from({ length: 32 }, (_, slot) =>
    issueTicket(draft, createScenario(mm, ids), mm, () => slot, ids).lines[0].multiplier,
  )).toEqual(repeated([15, 10, 4, 2, 1]))
})

it('keeps extraction order and rejects biased crypto tail words', () => {
  const slots = [41, 6, 58, 10, 2, 6, 42]
  const draw = createDraw(createScenario(RULES.pb, ids), RULES.pb, () => slots.shift()!)
  expect(draw).toMatchObject({ white: [42, 7, 61, 12, 3], special: 7, powerPlay: 10 })
  const words = [0xffffffff, 47]
  expect(cryptoInteger(10, () => words.shift()!)).toBe(7)
  expect(words).toEqual([])
  const combinations = (n: number) => n * (n - 1) * (n - 2) * (n - 3) * (n - 4) / 120
  expect(combinations(RULES.pb.whiteMax) * RULES.pb.specialMax).toBe(292_201_338)
  expect(combinations(RULES.mm.whiteMax) * RULES.mm.specialMax).toBe(290_472_336)
})

const awards = {
  pb: [[0, 4], [0, 4], [0, 7], [7, 100], [100, 50_000], [1_000_000, null]],
  mm: [[0, 5], [0, 7], [0, 10], [10, 200], [500, 10_000], [1_000_000, null]],
}
function fixtures(game: Game, powerPlay: boolean, multiplier: Multiplier) {
  const rules = RULES[game]
  const draft = emptyDraft()
  draft.payment = 'cash'
  draft.powerPlay = powerPlay
  draft.lines[0] = line([1, 2, 3, 4, 12], 12)
  const scenario = createScenario(rules, ids)
  const ticket = issueTicket(draft, scenario, rules, low, ids)
  const draw: Draw = {
    ...createDraw(scenario, rules, low), white: [1, 2, 3, 4, 12], special: 12,
    ...(game === 'pb' ? { powerPlay: multiplier } : {}),
  }
  function play(white: number[], special: number): IssuedTicket['lines'][number] {
    return { ...ticket.lines[0], white, special, ...(game === 'mm' ? { multiplier } : {}) }
  }
  return { rules, ticket, draw, play }
}

describe.each([
  ['pb', false, 2], ...multipliers.map(value => ['pb', true, value]),
  ...multipliers.map(value => ['mm', false, value]),
] as [Game, boolean, Multiplier][])('%s prize table, Power Play %s, %sx', (game, powerPlay, times) => {
  for (let white = 0; white <= 5; white++) {
    for (const special of [0, 1]) {
      it(`scores ${white} whites and ${special} special`, () => {
        const { rules, ticket, draw, play } = fixtures(game, powerPlay, times)
        const picked = [...draw.white.slice(0, white), ...[20, 21, 22, 23, 24].slice(white)]
        const result = scoreTicket({ ...ticket, lines: [play(picked, special ? 12 : 1)] }, draw, rules)
        const base = awards[game][white][special]
        const prize = white === 5 && !special && powerPlay ? 2_000_000 :
          base === null ? null : base * (powerPlay || game === 'mm' ? times : 1)
        expect(result.lines[0]).toMatchObject({
          matchedWhite: draw.white.slice(0, white), specialMatch: Boolean(special),
          fixedCents: prize === null ? null : prize * 100,
        })
        expect(result.fixedCents).toBe((prize ?? 0) * 100)
        expect(result.jackpotShares).toBe(prize === null ? 1 : 0)
      })
    }
  }
})

it('keeps duplicate jackpots separate from fixed awards and assigns a multiplier per identical purchase', () => {
  const { rules, ticket, draw, play } = fixtures('mm', false, 10)
  const jackpot = play([12, 4, 3, 2, 1], 12)
  const onSpecial = play([5, 6, 7, 8, 9], 12)
  const multiple = { ...ticket, lines: [jackpot, { ...jackpot, letter: 'B' as const }, { ...onSpecial, letter: 'D' as const }] }
  expect(scoreTicket(multiple, draw, rules)).toMatchObject({ jackpotShares: 2, fixedCents: 5000 })
  expect(() => scoreTicket(ticket, { ...draw, drawId: 'wrong' }, rules)).toThrow()
  expect(() => scoreTicket(ticket, { ...draw, game: 'pb' }, rules)).toThrow()
  const draft = emptyDraft()
  draft.payment = 'cash'
  draft.lines[0] = draft.lines[1] = line([5, 6, 7, 8, 9], 12)
  const slots = [0, 29]
  const purchased = issueTicket(draft, ticket.scenario, rules, () => slots.shift()!, ids)
  expect(purchased.lines.map(entry => entry.multiplier)).toEqual([2, 5])
  expect(scoreTicket(purchased, draw, rules)).toMatchObject({ fixedCents: 3500, jackpotShares: 0 })
})
