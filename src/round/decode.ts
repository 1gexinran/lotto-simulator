import { EDITION, inPool, LETTERS, MULTIPLIERS, RULES, type Game } from '../game'
import type { Round } from './model'

export class InvalidRound extends Error {
  constructor() {
    super('This saved round uses an unreadable format or rules edition.')
  }
}

type Stored = Record<string, unknown>

function object(value: unknown): value is Stored {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function date(value: unknown) {
  return text(value) && Number.isFinite(Date.parse(value))
}

function payment(value: unknown) {
  return value === 'cash' || value === 'annuity'
}

function whites(value: unknown, game: Game, count?: number): value is number[] {
  return Array.isArray(value) && (count === undefined ? value.length <= 5 : value.length === count) &&
    new Set(value).size === value.length && Array.from(value).every(number => inPool(number, RULES[game].whiteMax))
}

function draft(value: unknown, game: Game) {
  return object(value) && Array.isArray(value.lines) && value.lines.length <= LETTERS.length &&
    integer(value.active, 0, value.lines.length - 1) && (value.payment === null || payment(value.payment)) &&
    (game === 'pb' ? typeof value.powerPlay === 'boolean' : value.powerPlay === false) &&
    Array.from(value.lines).every(line => object(line) && whites(line.white, game) &&
      (line.special === null || inPool(line.special, RULES[game].specialMax)) &&
      typeof line.whiteQuick === 'boolean' && (!line.whiteQuick || line.white.length === 0) &&
      typeof line.specialQuick === 'boolean' && (!line.specialQuick || line.special === null))
}

function scenario(value: unknown, game: Game): value is Stored {
  return object(value) && value.jurisdiction === 'TX' && value.game === game &&
    value.edition === EDITION && text(value.drawId) && date(value.drawAt) && integer(value.annuityCents, 0)
}

function multiplier(value: unknown) {
  return MULTIPLIERS.some(allowed => value === allowed)
}

function ticket(value: unknown, game: Game, roundId: string, selected: Stored) {
  return object(value) && text(value.id) && value.roundId === roundId &&
    scenario(value.scenario, game) && value.scenario.drawId === selected.drawId &&
    value.scenario.drawAt === selected.drawAt && value.scenario.annuityCents === selected.annuityCents &&
    value.edition === EDITION && date(value.issuedAt) && payment(value.payment) &&
    (game === 'pb' ? typeof value.powerPlay === 'boolean' : value.powerPlay === false) &&
    value.totalCents === (RULES[game].cents + (value.powerPlay ? RULES[game].powerPlayCents : 0)) *
      (Array.isArray(value.lines) ? value.lines.length : 0) &&
    Array.isArray(value.lines) && value.lines.length >= 1 && value.lines.length <= LETTERS.length &&
    Array.from(value.lines).every((line, index, lines) => object(line) &&
      LETTERS.some(letter => line.letter === letter) && (!index || lines[index - 1].letter < line.letter!) &&
      whites(line.white, game, 5) && line.white.every((number, i, list) => !i || list[i - 1] < number) &&
      inPool(line.special, RULES[game].specialMax) &&
      [line.whiteOrigin, line.specialOrigin].every(origin => origin === 'manual' || origin === 'quick') &&
      (game === 'mm' ? multiplier(line.multiplier) : line.multiplier === undefined))
}

function draw(value: unknown, game: Game, selected: Stored) {
  return object(value) && value.edition === EDITION && value.game === game && value.drawId === selected.drawId &&
    whites(value.white, game, 5) && inPool(value.special, RULES[game].specialMax) &&
    (game === 'pb' ? multiplier(value.powerPlay) && (value.powerPlay !== 10 || Number(selected.annuityCents) <= 15_000_000_000)
      : value.powerPlay === undefined)
}

export function decode(value: unknown): Round {
  if (!object(value) || value.schema !== 1 || value.edition !== EDITION || !text(value.id) ||
    !integer(value.revision, 0) || !object(value.drafts) || !draft(value.drafts.pb, 'pb') ||
    !draft(value.drafts.mm, 'mm') || !object(value.scenarios)) throw new InvalidRound()

  const { phase, game, scenarios } = value
  if ((scenarios.pb !== undefined && !scenario(scenarios.pb, 'pb')) ||
    (scenarios.mm !== undefined && !scenario(scenarios.mm, 'mm'))) throw new InvalidRound()

  const hasNoDraw = value.draw === undefined && value.startedAt === undefined
  const hasNoTicket = value.ticket === undefined
  if (phase === 'choose' && (game === null || game === 'pb' || game === 'mm') && hasNoTicket && hasNoDraw) {
    return value as Round
  }
  if (game !== 'pb' && game !== 'mm') throw new InvalidRound()
  if (phase === 'edit' && hasNoTicket && hasNoDraw) return value as Round
  const selected = scenarios[game]
  if (!scenario(selected, game)) throw new InvalidRound()
  if (phase === 'review' && hasNoTicket && hasNoDraw) return value as Round
  if (!ticket(value.ticket, game, value.id, selected)) throw new InvalidRound()
  if (phase === 'issued' && hasNoDraw) return value as Round
  if ((phase === 'revealing' || phase === 'complete') &&
    integer(value.startedAt, 0) && draw(value.draw, game, selected)) return value as Round
  throw new InvalidRound()
}
