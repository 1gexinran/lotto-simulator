import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { classifyLine, emptyDraft, emptyLine, LETTERS, quote, RULES, type Game, type LineDraft, type Pool } from '../game'
import type { Command, Round } from '../round'
import { awardMoney, money, numberLabel } from './format'

const neutralDraft = emptyDraft()
const blank = emptyLine()
const outlineNumbers = Array.from({ length: 70 }, (_, index) => index + 1)
type Send = (command: Command) => void

export function Elections({ game, draft, send }: {
  game: Game, draft: Round['drafts'][Game], send: Send
}) {
  return <div className="elections">
    {game === 'pb' && <label className="power-election">
      <input type="checkbox" checked={draft.powerPlay}
        onChange={event => send({ type: 'powerPlay', value: event.target.checked })} />
      <span>Power Play <small>+{awardMoney(RULES.pb.powerPlayCents)} per play</small></span>
    </label>}
    <fieldset>
      <legend>Jackpot payment election</legend>
      <div className="payment-options">
        <label><input type="radio" name="payment" checked={draft.payment === 'cash'}
          onChange={() => send({ type: 'payment', value: 'cash' })} /> Cash value</label>
        <label><input type="radio" name="payment" checked={draft.payment === 'annuity'}
          onChange={() => send({ type: 'payment', value: 'annuity' })} /> 30 annual payments</label>
      </div>
    </fieldset>
  </div>
}

type NumberFieldProps = {
  pool: Pool, game: Game, preview: boolean, active: boolean, line: LineDraft,
  onMark: (pool: Pool, number: number) => void, send: Send,
}

const NumberField = memo(function NumberField({ pool, game, preview, active, line, onMark, send }: NumberFieldProps) {
  const rules = RULES[game]
  const white = pool === 'white'
  const max = white ? rules.whiteMax : rules.specialMax
  const label = white ? 'White numbers' : preview ? 'Special ball' : rules.specialName
  const quick = white ? line.whiteQuick : line.specialQuick
  const selected = white ? line.white.length : Number(line.special !== null)
  const [tabStop, setTabStop] = useState(1)
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-number]')
    if (!button) return
    const number = Number(button.dataset.number)
    const columns = matchMedia('(max-width: 510px)').matches ? 7 : 10
    const targets: Record<string, number> = {
      ArrowLeft: number - 1, ArrowRight: number + 1,
      ArrowUp: number - columns, ArrowDown: number + columns, Home: 1, End: max,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    if (target < 1 || target > max) return
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-number="${target}"]`)?.focus()
  }
  return <div className="pool" role={active ? 'group' : undefined} aria-label={active ? label : undefined}
    aria-describedby={active ? 'number-navigation' : undefined}>
    <div className="pool-head">
      <b>{white ? 'Pick 5 white numbers' : `Pick 1 ${label}`}</b>
      {active && <span className="count">{quick ? 'Quick Pick' : `${selected} / ${white ? 5 : 1}`}</span>}
    </div>
    <div className="numbers" onKeyDown={active ? navigate : undefined}>
      {outlineNumbers.slice(0, max).map(value => {
        const marked = white ? line.white.includes(value) : line.special === value
        if (!active) return <span className="number" key={value} data-marked={marked}>{numberLabel(value)}</span>
        return <button type="button" className="number" key={value} aria-pressed={marked}
          aria-label={`${white ? 'White number' : label} ${value}`}
          data-number={value} tabIndex={tabStop === value ? 0 : -1}
          onFocus={() => setTabStop(value)} onClick={() => onMark(pool, value)}>
          {numberLabel(value)}
        </button>
      })}
    </div>
    {!preview && <label className="pool-quick">
      <input type="checkbox" checked={quick} disabled={!active} onChange={() => send({ type: 'poolQuick', pool })} />
      Quick Pick {white ? 'white numbers' : label}
    </label>}
  </div>
})

export function pendingLine(line: LineDraft, game: Game) {
  return {
    white: line.whiteQuick ? 'White numbers · pending Quick Pick' : [...line.white].sort((a, b) => a - b).map(numberLabel).join(' '),
    special: line.specialQuick ? `${RULES[game].specialName} · pending Quick Pick`
      : `${RULES[game].specialName} ${line.special === null ? '' : numberLabel(line.special)}`,
  }
}

export function Playslip({ round, send, heading }: {
  round: Round, send: Send, heading: RefObject<HTMLHeadingElement | null>,
}) {
  const preview = round.phase === 'choose' || round.atChooser === true
  const game = preview ? 'pb' : round.game!
  const rules = RULES[game]
  const draft = preview ? neutralDraft : round.drafts[game]
  const currentLine = draft.lines[draft.active]
  const classification = classifyLine(currentLine, rules)
  const quoteNow = quote(draft, rules)
  const canFinish = !quoteNow.errors.some(error => error.field !== 'payment')
  const [hint, setHint] = useState('')
  const [boardHeight, setBoardHeight] = useState(0)
  const board = useRef<HTMLElement>(null)
  const pendingWhiteFocus = useRef(false)
  const boardLetter = LETTERS[draft.active]

  useLayoutEffect(() => {
    if (preview || !board.current) return
    const element = board.current
    const fit = () => setBoardHeight(element.offsetHeight)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [preview, draft.active, game])

  useLayoutEffect(() => {
    if (pendingWhiteFocus.current && classification === 'blank') {
      board.current?.querySelector<HTMLButtonElement>('button.number')?.focus({ preventScroll: true })
      pendingWhiteFocus.current = false
    }
  }, [classification])

  function move(step: -1 | 1) {
    setHint('')
    send({ type: 'move', step })
  }

  function mark(pool: Pool, value: number) {
    setHint('')
    if (pool === 'white' && currentLine.white.length === 5 && !currentLine.white.includes(value)) {
      setHint('Remove a marked white number to choose another.')
      return
    }
    send({ type: 'mark', pool, value })
  }

  const completed = quoteNow.letters
  const unfinished = quoteNow.errors.filter(error => error.letter)
  const otherErrors = unfinished.filter(error => error.letter !== boardLetter)
  const fieldName = (field: string) => field === 'white' ? 'white numbers' : rules.specialName
  const missing = unfinished.filter(error => error.letter === boardLetter).map(error => fieldName(error.field))
  const nextAllowed = classification === 'complete' && draft.active < LETTERS.length - 1
  const style = {
    '--stage-height': `${boardHeight + 48}px`, '--shift': -draft.active,
    '--accent': preview ? '#885c44' : game === 'pb' ? '#a03829' : '#294b7d',
  } as CSSProperties

  return <main className={`playslip-stage ${preview ? '' : 'is-active'}`} style={style}>
    <span id="number-navigation" className="visually-hidden">Use arrow keys to move between numbers and Space to mark a number.</span>
    <div className="sheet" inert={preview} aria-hidden={preview || undefined}>
      <div className="sheet-wrap">
        {LETTERS.map((letter, index) => {
          const line = draft.lines[index] ?? blank
          const active = !preview && index === draft.active
          const saved = !preview && !active && classifyLine(line, rules) === 'complete'
          const upcoming = index > draft.active && !saved
          return <section key={letter} ref={active ? board : undefined} inert={!active}
            aria-hidden={!active || undefined}
            className={`board ${saved ? 'saved' : ''} ${upcoming ? 'upcoming' : ''}`}>
            <div className="endpaper" aria-hidden="true" />
            <h1 className="slip-head" tabIndex={active ? -1 : undefined} ref={active ? heading : undefined}>
              <strong>{preview ? 'Lotto playslip' : rules.name}</strong>
              <span className="letter">Board {letter}{saved ? ' · ✓ Saved' : ''}</span>
            </h1>
            {active && completed.some(value => value !== letter) && <ul className="saved-lines" aria-label="Saved plays">
              {completed.filter(value => value !== letter).map(value => {
                const selection = pendingLine(draft.lines[LETTERS.indexOf(value)], game)
                return <li key={value}>✓ {value} saved · {selection.white} · {selection.special}</li>
              })}
            </ul>}
            <NumberField pool="white" {...{ game, preview, active, line, onMark: mark, send }} />
            <NumberField pool="special" {...{ game, preview, active, line, onMark: mark, send }} />
            {(active || saved) && <div className="board-foot">
              <button type="button" className="whole-quick" onClick={() => {
                setHint('')
                send({ type: 'wholeQuick' })
              }}>Quick Pick whole play</button>
              {active && <Elections {...{ game, draft, send }} />}
              {active && <div className="board-status">
                <div role="status">
                  {hint && <div>{hint}</div>}
                  {classification === 'complete' && <div>Board {letter} complete.</div>}
                  {classification === 'partial' && <div>Complete {missing.join(' and ')} on Board {letter}.</div>}
                  {classification === 'blank' && completed.length > 0 &&
                    <div>{completed.length} completed {completed.length === 1 ? 'play' : 'plays'}.</div>}
                  {otherErrors.length > 0 && <div>
                    Complete or clear {Array.from(new Set(otherErrors.map(error => error.letter))).map(value =>
                      `Board ${value} (${otherErrors.filter(error => error.letter === value).map(error => fieldName(error.field)).join(' and ')})`,
                    ).join(', ')} to finish.
                  </div>}
                </div>
                <span>Running total <strong>{money(quoteNow.totalCents)}</strong></span>
              </div>}
              {active && <div className="play-actions">
                <button type="button" className="clear" disabled={classification === 'blank'} onClick={() => {
                  pendingWhiteFocus.current = true
                  setHint('Current play cleared.')
                  send({ type: 'clear' })
                }}>Clear play</button>
                {draft.active > 0 && <button type="button" onClick={() => move(-1)}>Previous play</button>}
                {draft.active < LETTERS.length - 1 &&
                  <button type="button" disabled={!nextAllowed} onClick={() => move(1)}>Next play</button>}
                <button type="button" className="primary" disabled={!canFinish} onClick={() => send({ type: 'finish' })}>
                  Finish
                </button>
              </div>}
            </div>}
          </section>
        })}
      </div>
      {!preview && draft.active > 0 &&
        <button type="button" className="board-edge prev" aria-label="Open previous board"
          tabIndex={-1} onClick={() => move(-1)}><span aria-hidden="true">‹</span></button>}
      {!preview && draft.active < LETTERS.length - 1 &&
        <button type="button" className="board-edge forward" aria-label="Next board"
          tabIndex={-1} disabled={!nextAllowed} onClick={() => move(1)}><span aria-hidden="true">›</span></button>}
    </div>

    <section className="cover" inert={!preview} aria-hidden={!preview || undefined} aria-labelledby="choose-title">
      <h1 id="choose-title" tabIndex={-1} ref={preview ? heading : undefined}>Choose your game.</h1>
      <div className="game-cards">
        {(['pb', 'mm'] as const).map(key => <button type="button" key={key}
          className={`game-card ${key}`} onClick={() => { setHint(''); send({ type: 'choose', game: key }) }}>
          <span className="game-name">{RULES[key].name}</span>
          <span className="game-price">{awardMoney(RULES[key].cents)} / play</span>
          <span className="card-ball" aria-hidden="true"><i>{RULES[key].specialMax}</i></span>
        </button>)}
      </div>
      {round.atChooser && <button type="button" className="back resume-ticket"
        onClick={() => send({ type: 'resumeTicket' })}>Resume ticket</button>}
    </section>
  </main>
}
