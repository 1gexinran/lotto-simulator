import {
  browserIdentity, classifyLine, createDraw, createScenario, cryptoInteger, EDITION, emptyDraft, emptyLine,
  inPool, issueTicket, LETTERS, quote, RULES, type Draft, type Draw, type Game, type Identity,
  type IntegerSampler, type IssuedTicket, type LineDraft, type Payment, type Pool, type Scenario,
} from '../game'

export type Round = {
  id: string
  revision: number
  schema: 1
  edition: typeof EDITION
  phase: 'choose' | 'edit' | 'review' | 'issued' | 'revealing' | 'complete'
  game: Game | null
  drafts: Record<Game, Draft>
  scenarios: Partial<Record<Game, Scenario>>
  ticket?: IssuedTicket
  draw?: Draw
  startedAt?: number
}

export type Command =
  | { type: 'choose', game: Game }
  | { type: 'mark', pool: Pool, value: number }
  | { type: 'poolQuick', pool: Pool }
  | { type: 'move', step: -1 | 1 }
  | { type: 'payment', value: Payment }
  | { type: 'powerPlay', value: boolean }
  | { type: 'chooser' | 'wholeQuick' | 'clear' | 'finish' | 'edit' | 'confirm' | 'start' | 'complete' | 'again' }

export type Dependencies = { identity: Identity, rng: IntegerSampler }
export const browserDependencies: Dependencies = { identity: browserIdentity, rng: cryptoInteger }

export function freshRound(identity: Identity): Round {
  return {
    id: identity.id(), revision: 0, schema: 1, edition: EDITION, phase: 'choose', game: null,
    drafts: { pb: emptyDraft(), mm: emptyDraft() }, scenarios: {},
  }
}

function mark(line: LineDraft, pool: Pool, value: number) {
  if (pool === 'special') {
    line.special = line.special === value ? null : value
    line.specialQuick = false
    return true
  }
  if (line.white.includes(value)) {
    line.white = line.white.filter(number => number !== value)
  } else {
    if (line.white.length === 5) return false
    line.white = [...line.white, value].sort((a, b) => a - b)
  }
  line.whiteQuick = false
  return true
}

export function transition(current: Round, command: Command, dependencies: Dependencies): Round | undefined {
  const { identity, rng } = dependencies
  if (current.phase === 'complete' && command.type === 'again') return freshRound(identity)
  const next = structuredClone(current)
  next.revision++
  if (current.phase === 'choose' && command.type === 'choose') {
    next.game = command.game
    next.phase = 'edit'
    return next
  }
  const game = next.game
  if (!game) return
  const rules = RULES[game]
  const draft = next.drafts[game]
  const line = draft.lines[draft.active]

  if (current.phase === 'edit' || current.phase === 'review') {
    if (command.type === 'payment') {
      draft.payment = command.value
      return next
    }
    if (command.type === 'powerPlay' && game === 'pb') {
      draft.powerPlay = command.value
      return next
    }
  }

  if (current.phase === 'edit') {
    switch (command.type) {
      case 'chooser':
        next.phase = 'choose'
        return next
      case 'mark': {
        const max = command.pool === 'white' ? rules.whiteMax : rules.specialMax
        return inPool(command.value, max) && mark(line, command.pool, command.value) ? next : undefined
      }
      case 'poolQuick':
        if (command.pool === 'white') {
          line.white = []
          line.whiteQuick = !line.whiteQuick
        } else {
          line.special = null
          line.specialQuick = !line.specialQuick
        }
        return next
      case 'wholeQuick':
        draft.lines[draft.active] = { ...emptyLine(), whiteQuick: true, specialQuick: true }
        return next
      case 'clear':
        draft.lines[draft.active] = emptyLine()
        return next
      case 'move': {
        const target = draft.active + command.step
        if (target < 0 || target >= LETTERS.length ||
          (command.step === 1 && classifyLine(line, rules) !== 'complete')) return
        if (target === draft.lines.length) draft.lines.push(emptyLine())
        draft.active = target
        return next
      }
      case 'finish':
        if (quote(draft, rules).errors.some(error => error.field !== 'payment')) return
        next.scenarios[game] ??= createScenario(rules, identity)
        next.phase = 'review'
        return next
    }
  }

  if (current.phase === 'review' && command.type === 'edit') {
    next.phase = 'edit'
    return next
  }
  if (current.phase === 'review' && command.type === 'confirm' && !quote(draft, rules).errors.length) {
    next.ticket = issueTicket(draft, next.scenarios[game]!, rules, rng, identity, current.id)
    next.phase = 'issued'
    return next
  }
  if (current.phase === 'issued' && command.type === 'start') {
    next.draw = createDraw(next.ticket!.scenario, rules, rng)
    next.startedAt = identity.now().getTime()
    next.phase = 'revealing'
    return next
  }
  if (current.phase === 'revealing' && command.type === 'complete') {
    next.phase = 'complete'
    return next
  }
}
