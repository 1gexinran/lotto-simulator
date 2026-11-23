export const EDITION = 'tx-2026-11-21'
export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
export type Letter = typeof LETTERS[number]
export type Game = 'pb' | 'mm'
export type Payment = 'cash' | 'annuity'
export const DEFAULT_PAYMENT: Payment = 'cash'
export type Pool = 'white' | 'special'
export type Multiplier = 2 | 3 | 4 | 5 | 10
export type IntegerSampler = (limit: number) => number
export type Identity = { id: () => string, now: () => Date }

export type LineDraft = {
  white: number[]
  special: number | null
  whiteQuick: boolean
  specialQuick: boolean
}

export type Draft = {
  lines: LineDraft[]
  active: number
  payment: Payment | null
  powerPlay: boolean
}

export type Scenario = {
  jurisdiction: 'TX'
  game: Game
  edition: typeof EDITION
  drawId: string
  drawAt: string
  annuityCents: number
}

export type TicketLine = {
  letter: Letter
  white: number[]
  special: number
  whiteOrigin: 'manual' | 'quick'
  specialOrigin: 'manual' | 'quick'
  multiplier?: Multiplier
}

export type IssuedTicket = {
  id: string
  roundId: string
  scenario: Scenario
  issuedAt: string
  edition: typeof EDITION
  payment: Payment
  powerPlay: boolean
  totalCents: number
  lines: TicketLine[]
}

export type Draw = {
  game: Game
  edition: typeof EDITION
  drawId: string
  white: number[]
  special: number
  powerPlay?: Multiplier
}

export type LineResult = {
  letter: Letter
  matchedWhite: number[]
  specialMatch: boolean
  tier: 'jackpot' | 'fixed' | 'none'
  baseCents: number | null
  fixedCents: number | null
  multiplier?: Multiplier
  setAward: boolean
}

export type Result = { lines: LineResult[], fixedCents: number, jackpotShares: number }

type Rules = {
  game: Game
  name: string
  specialName: string
  whiteMax: number
  specialMax: number
  cents: number
  powerPlayCents: number
  days: number[]
  hour: number
  minute: number
  annuityCents: number
  prizes: readonly (readonly [number, number | null])[]
}

export const RULES: Record<Game, Rules> = {
  pb: {
    game: 'pb', name: 'Powerball', specialName: 'Powerball', whiteMax: 69, specialMax: 26,
    cents: 200, powerPlayCents: 100, days: [1, 3, 6], hour: 22, minute: 59,
    annuityCents: 10_000_000_000,
    prizes: [[0, 400], [0, 400], [0, 700], [700, 10_000], [10_000, 5_000_000], [100_000_000, null]],
  },
  mm: {
    game: 'mm', name: 'Mega Millions', specialName: 'Mega Ball', whiteMax: 70, specialMax: 24,
    cents: 500, powerPlayCents: 0, days: [2, 5], hour: 23, minute: 0,
    annuityCents: 10_000_000_000,
    prizes: [[0, 500], [0, 700], [0, 1000], [1000, 20_000], [50_000, 1_000_000], [100_000_000, null]],
  },
}

export const MULTIPLIERS = [2, 3, 4, 5, 10] as const
const POWER_PLAY_WEIGHTS = [24, 13, 3, 2, 1]
const MEGA_WEIGHTS = [15, 10, 4, 2, 1]
export const POWER_PLAY_MATCH_FIVE_CENTS = 200_000_000

export function maxPowerPlay(annuityCents: number) {
  return annuityCents <= 15_000_000_000 ? 10 : 5
}

export const browserIdentity: Identity = {
  id: () => crypto.randomUUID(),
  now: () => new Date(),
}

export function emptyLine(): LineDraft {
  return { white: [], special: null, whiteQuick: false, specialQuick: false }
}

export function emptyDraft(): Draft {
  return { lines: [emptyLine()], active: 0, payment: DEFAULT_PAYMENT, powerPlay: false }
}

export function inPool(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max
}

export function openFields(line: LineDraft, rules: Rules): Pool[] {
  const fields: Pool[] = []
  const unique = new Set(line.white)
  if (line.whiteQuick ? line.white.length !== 0 :
    unique.size !== 5 || line.white.length !== 5 || line.white.some(value => !inPool(value, rules.whiteMax))) {
    fields.push('white')
  }
  if (line.specialQuick ? line.special !== null : !inPool(line.special, rules.specialMax)) {
    fields.push('special')
  }
  return fields
}

export function classifyLine(line: LineDraft, rules: Rules): 'blank' | 'partial' | 'complete' {
  if (!line.white.length && line.special === null && !line.whiteQuick && !line.specialQuick) return 'blank'
  return openFields(line, rules).length ? 'partial' : 'complete'
}

export type QuoteError = { letter?: Letter, field: Pool | 'payment' | 'plays' }

export function quote(draft: Draft, rules: Rules) {
  const letters: Letter[] = []
  const errors: QuoteError[] = []
  draft.lines.forEach((line, index) => {
    const classification = classifyLine(line, rules)
    if (classification === 'complete') letters.push(LETTERS[index])
    if (classification === 'partial') {
      errors.push(...openFields(line, rules).map(field => ({ field, letter: LETTERS[index] })))
    }
  })
  if (draft.lines.length > LETTERS.length || !letters.length) errors.push({ field: 'plays' })
  if (draft.payment !== 'cash' && draft.payment !== 'annuity') errors.push({ field: 'payment' })
  const lineCents = rules.cents + (draft.powerPlay ? rules.powerPlayCents : 0)
  return { letters, lineCents, totalCents: letters.length * lineCents, errors }
}

export function cryptoInteger(limit: number, nextWord = () => crypto.getRandomValues(new Uint32Array(1))[0]): number {
  const range = 2 ** 32
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > range) throw new RangeError('Invalid sample range')
  const cutoff = range - range % limit
  let word: number
  do { word = nextWord() } while (word >= cutoff)
  return word % limit
}

function sampleWhite(max: number, rng: IntegerSampler) {
  const available = Array.from({ length: max }, (_, index) => index + 1)
  return Array.from({ length: 5 }, () => available.splice(rng(available.length), 1)[0])
}

function sampleMultiplier(weights: number[], rng: IntegerSampler): Multiplier {
  let slot = rng(weights.reduce((sum, weight) => sum + weight, 0))
  for (const [index, weight] of weights.entries()) {
    if (slot < weight) return MULTIPLIERS[index]
    slot -= weight
  }
  throw new RangeError('Invalid multiplier sample')
}

const eastern = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', hourCycle: 'h23',
})

function easternParts(date: Date) {
  return Object.fromEntries(eastern.formatToParts(date).map(part => [part.type, Number(part.value)]))
}

export function createScenario(rules: Rules, identity = browserIdentity, annuityCents = rules.annuityCents): Scenario {
  const now = identity.now()
  const date = easternParts(now)
  for (let extraDays = 0; extraDays < 7; extraDays++) {
    const noonUtc = new Date(Date.UTC(date.year, date.month - 1, date.day + extraDays, 12))
    if (!rules.days.includes(noonUtc.getUTCDay())) continue
    // US offset changes occur before local morning; noon has the evening draw's offset.
    const offsetHours = 12 - easternParts(noonUtc).hour
    const candidate = new Date(noonUtc.getTime())
    candidate.setUTCHours(rules.hour + offsetHours, rules.minute)
    if (candidate > now) return {
      jurisdiction: 'TX', game: rules.game, edition: EDITION, drawId: identity.id(),
      drawAt: candidate.toISOString(), annuityCents,
    }
  }
  throw new Error('Unable to schedule the simulated drawing')
}

function checkScenario(scenario: Scenario, rules: Rules) {
  if (scenario.edition !== EDITION || scenario.game !== rules.game || scenario.jurisdiction !== 'TX') {
    throw new Error('The scenario and selected rules do not match')
  }
}

export function issueTicket(
  draft: Draft, scenario: Scenario, rules: Rules, rng: IntegerSampler = cryptoInteger,
  identity: Identity = browserIdentity, roundId = scenario.drawId,
): IssuedTicket {
  checkScenario(scenario, rules)
  const purchase = quote(draft, rules)
  if (purchase.errors.length || !draft.payment) throw new Error('Complete the plays and payment election first')
  const lines = purchase.letters.map((letter): TicketLine => {
    const line = draft.lines[LETTERS.indexOf(letter)]
    const white = line.whiteQuick ? sampleWhite(rules.whiteMax, rng) : [...line.white]
    return {
      letter, white: white.sort((a, b) => a - b),
      special: line.specialQuick ? rng(rules.specialMax) + 1 : line.special!,
      whiteOrigin: line.whiteQuick ? 'quick' : 'manual',
      specialOrigin: line.specialQuick ? 'quick' : 'manual',
      ...(rules.game === 'mm' ? { multiplier: sampleMultiplier(MEGA_WEIGHTS, rng) } : {}),
    }
  })
  return {
    id: identity.id(), roundId, scenario: { ...scenario }, issuedAt: identity.now().toISOString(),
    edition: EDITION, payment: draft.payment, powerPlay: rules.game === 'pb' && draft.powerPlay,
    totalCents: purchase.totalCents, lines,
  }
}

export function createDraw(scenario: Scenario, rules: Rules, rng: IntegerSampler = cryptoInteger): Draw {
  checkScenario(scenario, rules)
  const white = sampleWhite(rules.whiteMax, rng)
  const special = rng(rules.specialMax) + 1
  return {
    edition: EDITION, game: rules.game, drawId: scenario.drawId, white, special,
    ...(rules.game === 'pb' ? {
      powerPlay: sampleMultiplier(
        maxPowerPlay(scenario.annuityCents) === 10 ? POWER_PLAY_WEIGHTS : POWER_PLAY_WEIGHTS.slice(0, -1), rng,
      ),
    } : {}),
  }
}

export function scoreTicket(ticket: IssuedTicket, draw: Draw, rules: Rules): Result {
  checkScenario(ticket.scenario, rules)
  if (ticket.edition !== EDITION || draw.edition !== EDITION ||
    draw.game !== rules.game || draw.drawId !== ticket.scenario.drawId) {
    throw new Error('The ticket and drawing do not match')
  }
  const winners = new Set(draw.white)
  const lines = ticket.lines.map((line): LineResult => {
    const matchedWhite = line.white.filter(value => winners.has(value))
    const specialMatch = line.special === draw.special
    const baseCents = rules.prizes[matchedWhite.length][specialMatch ? 1 : 0]
    const match = { letter: line.letter, matchedWhite, specialMatch, baseCents }
    if (baseCents === null) return { ...match, tier: 'jackpot', fixedCents: null, setAward: false }
    if (baseCents === 0) return { ...match, tier: 'none', fixedCents: 0, setAward: false }
    if (ticket.powerPlay && matchedWhite.length === 5) {
      return { ...match, tier: 'fixed', fixedCents: POWER_PLAY_MATCH_FIVE_CENTS, setAward: true }
    }
    const multiplier = rules.game === 'mm' ? line.multiplier : ticket.powerPlay ? draw.powerPlay : undefined
    return { ...match, tier: 'fixed', fixedCents: baseCents * (multiplier ?? 1), multiplier, setAward: false }
  })
  return {
    lines, fixedCents: lines.reduce((total, line) => total + (line.fixedCents ?? 0), 0),
    jackpotShares: lines.filter(line => line.tier === 'jackpot').length,
  }
}
