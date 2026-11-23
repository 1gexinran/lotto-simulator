import { expect, type Page } from '@playwright/test'
import { createScenario, EDITION, emptyDraft, issueTicket, RULES, type Game } from '../../src/game'
import type { Round } from '../../src/round'

export const drawOrder = [42, 7, 61, 12, 3, 7]
const identity = { id: () => 'fixture', now: () => new Date('2026-11-22T15:00:00Z') }

export function fixture(game: Game, phase: 'review' | 'issued'): Round {
  const draft = emptyDraft()
  draft.payment = 'cash'
  draft.powerPlay = game === 'pb'
  const extraLines = game === 'pb' ? [
    { white: [42, 7, 61, 12, 3], special: 8 },
    { white: [42, 7, 61, 12, 5], special: 7 },
    { white: [5, 6, 8, 9, 10], special: 12 },
  ] : []
  draft.lines = [
    { white: [42, 7, 61, 12, 3], special: 7 },
    { white: [42, 7, 61, 12, 3], special: 7 },
    ...extraLines,
  ].map(line => ({ ...line, whiteQuick: false, specialQuick: false }))
  const scenario = createScenario(RULES[game], identity)
  return {
    id: 'fixture-round', revision: 1, schema: 1, edition: EDITION, phase, game,
    drafts: { pb: emptyDraft(), mm: emptyDraft(), [game]: draft },
    scenarios: { [game]: scenario },
    ...(phase === 'issued' ? { ticket: issueTicket(draft, scenario, RULES[game], () => 0, identity, 'fixture-round') } : {}),
  }
}

export async function deterministicWords(page: Page, words: number[]) {
  await page.addInitScript(values => {
    const original = Crypto.prototype.getRandomValues
    Crypto.prototype.getRandomValues = function <T extends ArrayBufferView>(array: T): T {
      if (array instanceof Uint32Array && array.length === 1 && values.length) {
        array[0] = values.shift()!
        return array
      }
      return original.call(this, array) as T
    }
  }, words)
}

export async function seed(page: Page, round: Round) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
  await page.evaluate(record => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('live-lotto', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('rounds', 'readwrite')
      tx.objectStore('rounds').put(record, 'current')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => reject(tx.error)
    }
  }), round)
  await page.reload()
}

export const start = (page: Page) => page.getByRole('button', { name: 'Start draw' })
export const results = (page: Page) => page.getByRole('heading', { name: 'Ticket results' })
export const ticket = (page: Page) => page.getByRole('article', { name: /ticket/i })
export const balls = (page: Page) => page.locator('[data-ball-state="settled"]')
