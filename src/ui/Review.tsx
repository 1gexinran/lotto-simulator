import type { RefObject } from 'react'
import { LETTERS, quote, RULES } from '../game'
import type { Command, Round } from '../round'
import { dateLabel, money } from './format'
import { Elections, pendingLine } from './Playslip'

export function Review({ round, send, busy, heading }: {
  round: Round, send: (command: Command) => void, busy: boolean,
  heading?: RefObject<HTMLHeadingElement | null>,
}) {
  const game = round.game!
  const draft = round.drafts[game]
  const rules = RULES[game]
  const purchase = quote(draft, rules)
  const scenario = round.scenarios[game]!
  return <section className={`review paper ${game}`} aria-label="Review your plays">
    <h1 tabIndex={-1} ref={heading}>Review your plays</h1>
    <div className="review-game"><strong>{rules.name}</strong><span>Texas · Single simulated draw</span></div>
    <p className="draw-date">{dateLabel(scenario.drawAt)}</p>
    <ul className="review-lines">
      {purchase.letters.map(letter => {
        const selection = pendingLine(draft.lines[LETTERS.indexOf(letter)], game)
        return <li key={letter}><b>Play {letter}</b><span>{selection.white}</span><span>{selection.special}</span></li>
      })}
    </ul>
    <Elections {...{ game, draft, send }} />
    {game === 'mm' && <p className="review-note">Each play gets a multiplier when the ticket prints.</p>}
    {!draft.payment && <p className="review-note">Select a jackpot payment election to print.</p>}
    <div className="review-total">
      <span>{purchase.letters.length} {purchase.letters.length === 1 ? 'play' : 'plays'} · Simulated total</span>
      <strong>{money(purchase.totalCents)}</strong>
    </div>
    <div className="review-actions">
      <button type="button" onClick={() => send({ type: 'edit' })} disabled={busy}>Back to playslip</button>
      <button type="button" className="primary" disabled={busy || Boolean(purchase.errors.length)}
        onClick={() => send({ type: 'confirm' })}>Confirm &amp; print</button>
    </div>
  </section>
}
