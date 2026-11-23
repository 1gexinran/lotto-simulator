import type { RefObject } from 'react'
import { RULES, type IssuedTicket, type LineResult, type Result } from '../game'
import { awardMoney, dateLabel, money, numberLabel, paymentLabel } from './format'

function lineAward(result: LineResult) {
  if (result.tier === 'jackpot') return 'Jackpot share'
  if (result.tier === 'none') return 'No prize · $0'
  const base = awardMoney(result.baseCents!)
  const fixed = awardMoney(result.fixedCents!)
  if (result.setAward) return `Base prize ${base} · Power Play set award ${fixed}`
  if (result.multiplier) return `${base} × ${result.multiplier} = ${fixed}`
  return `Base prize ${base} · Award ${fixed}`
}

export function Ticket({ ticket, result, heading }: {
  ticket: IssuedTicket, result?: Result, heading: RefObject<HTMLHeadingElement | null>,
}) {
  const { scenario } = ticket
  const rules = RULES[scenario.game]
  return <article className={`ticket ${rules.game}`} aria-labelledby="ticket-title">
    <header className="ticket-header">
      <p className="ticket-kicker">Texas · Simulated draw</p>
      <h1 id="ticket-title" ref={heading} tabIndex={-1}>{rules.name} ticket</h1>
      <dl className="ticket-meta">
        <div><dt>Ticket ID</dt><dd data-testid="ticket-id">{ticket.id}</dd></div>
        <div><dt>Draw ID</dt><dd>{scenario.drawId}</dd></div>
        <div><dt>Issued</dt><dd><time dateTime={ticket.issuedAt}>{dateLabel(ticket.issuedAt)}</time></dd></div>
        <div><dt>Simulated draw</dt><dd><time dateTime={scenario.drawAt}>{dateLabel(scenario.drawAt)}</time></dd></div>
      </dl>
    </header>

    <ol className="ticket-lines" aria-label="Issued plays">
      {ticket.lines.map((line, index) => {
        const score = result?.lines[index]
        const whiteQuick = line.whiteOrigin === 'quick'
        const specialQuick = line.specialOrigin === 'quick'
        return <li key={line.letter} data-testid="ticket-line">
          <div className="ticket-line-title">
            <strong>Play {line.letter}</strong>
            {line.multiplier && <span className="line-multiplier">Multiplier {line.multiplier}×</span>}
          </div>
          <div className="ticket-pools">
            <div className="ticket-pool" role="group" aria-label="White numbers">
              {line.white.map(value => <span className={score?.matchedWhite.includes(value) ? 'hit' : undefined} key={value}>
                {numberLabel(value)}
              </span>)}
            </div>
            <div className="ticket-special">
              <span>{rules.specialName}</span>
              <strong className={score?.specialMatch ? 'hit' : undefined}>{numberLabel(line.special)}</strong>
            </div>
          </div>
          {(whiteQuick || specialQuick) && <div className="quick-origin">
            Quick Pick · {[whiteQuick ? 'white numbers' : null, specialQuick ? rules.specialName : null].filter(Boolean).join(' + ')}
          </div>}
          {score && <div className={`line-result ${score.tier}`}>
            <span>{score.matchedWhite.length} white + {score.specialMatch ? rules.specialName : 'no special ball'}</span>
            <strong>{lineAward(score)}</strong>
          </div>}
        </li>
      })}
    </ol>

    <dl className="ticket-elections">
      {rules.game === 'pb' && <div><dt>Power Play</dt><dd>{ticket.powerPlay ? 'Yes' : 'No'}</dd></div>}
      <div><dt>Jackpot election</dt><dd>{paymentLabel(ticket.payment)}</dd></div>
      <div><dt>Simulated total</dt><dd>{money(ticket.totalCents)}</dd></div>
    </dl>
    {result && <section className="ticket-results" aria-labelledby="results-title">
      <h2 id="results-title">Ticket results</h2>
      <div className="fixed-total"><span>Fixed awards</span><strong>{awardMoney(result.fixedCents)}</strong></div>
      {result.jackpotShares > 0 && <div className="jackpot">
        <strong>{result.jackpotShares} jackpot-winning {result.jackpotShares === 1 ? 'play' : 'plays'}</strong>
        <p>Simulated annuity estimate {awardMoney(scenario.annuityCents)}</p>
        <p>Payment election · {paymentLabel(ticket.payment)}</p>
        <p>Final cash share undetermined.</p>
      </div>}
    </section>}
    <div className="ticket-footer">Simulation ticket</div>
  </article>
}
