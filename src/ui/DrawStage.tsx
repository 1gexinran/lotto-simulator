import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { RULES, scoreTicket } from '../game'
import type { Command, Round } from '../round'
import { DrawCharts } from './DrawCharts'
import { numberLabel } from './format'
import { Review } from './Review'
import { Ticket } from './Ticket'

const ROLL = 650
const INTERVAL = 1000
const BALL_COUNT = 6
const DURATION = (BALL_COUNT - 1) * INTERVAL + ROLL
const motionQuery = '(prefers-reduced-motion: reduce)'

function settleBall(node: HTMLElement) {
  node.removeAttribute('data-rolling')
  node.style.removeProperty('--travel')
  node.style.removeProperty('--roll')
  node.style.removeProperty('--pitch')
  node.style.removeProperty('--yaw')
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia(motionQuery).matches)
  useEffect(() => {
    const query = matchMedia(motionQuery)
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    update()
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

function Tube({ round, complete, reduced }: { round: Round, complete: () => void, reduced: boolean }) {
  const rail = useRef<HTMLDivElement>(null)
  const ballNodes = useRef<(HTMLDivElement | null)[]>([])
  const finish = useRef(complete)
  finish.current = complete
  const [count, setCount] = useState(0)
  const rules = RULES[round.game!]
  const draw = round.draw
  const values = draw ? [...draw.white, draw.special] : []
  const revealing = round.phase === 'revealing'
  const settled = round.phase === 'complete' ? BALL_COUNT : count

  useLayoutEffect(() => {
    if (!revealing || !rail.current || round.startedAt === undefined) return
    if (reduced) {
      finish.current()
      return
    }
    const origin = performance.now() - Math.max(0, Date.now() - round.startedAt)
    const track = rail.current
    let frame = 0
    let published = 0
    let ended = false
    function animate() {
      cancelAnimationFrame(frame)
      if (ended) return
      const elapsed = Math.max(0, performance.now() - origin)
      const width = track.clientWidth
      const newlySettled = Math.max(0, Math.min(BALL_COUNT, Math.floor((elapsed - ROLL) / INTERVAL) + 1))
      if (newlySettled !== published) {
        published = newlySettled
        setCount(newlySettled)
      }
      for (const [index, node] of ballNodes.current.entries()) {
        if (!node) continue
        const time = elapsed - index * INTERVAL
        if (time < 0 || time >= ROLL) {
          if (node.hasAttribute('data-rolling')) settleBall(node)
          continue
        }
        const center = width * (index + 0.5) / BALL_COUNT
        const radius = node.offsetWidth / 2
        if (!radius) continue
        const remainingTime = 1 - time / ROLL
        const travel = (width - center + radius + 4) * remainingTime ** 2.4
        const roll = travel / radius
        node.style.setProperty('--travel', `${travel}px`)
        node.style.setProperty('--roll', `${roll * 180 / Math.PI}deg`)
        node.style.setProperty('--pitch', `${18 * Math.sin(roll) * remainingTime}deg`)
        node.style.setProperty('--yaw', `${32 * Math.sin(roll * 0.7) * remainingTime}deg`)
        node.setAttribute('data-rolling', '')
      }
      if (elapsed >= DURATION) {
        ended = true
        finish.current()
      } else {
        frame = requestAnimationFrame(animate)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') animate()
    }
    animate()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelAnimationFrame(frame)
      track.querySelectorAll<HTMLElement>('[data-rolling]').forEach(settleBall)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [revealing, reduced, round.id, round.startedAt])

  const shownWhite = values.slice(0, Math.min(settled, 5))
  if (settled === BALL_COUNT) shownWhite.sort((a, b) => a - b)

  return <div className="tube-panel">
    <div className="tube-frame">
      <div className="tube-channel">
        <div className="tube-rail" ref={rail}>
          {Array.from({ length: BALL_COUNT }, (_, index) => <span className="rail-slot"
            aria-hidden="true" key={index} style={{ '--slot': index } as CSSProperties} />)}
          {values.map((value, index) => {
            const special = index === BALL_COUNT - 1
            const isSettled = index < settled
            return <div key={index} className="draw-ball" data-ball-state={isSettled ? 'settled' : 'waiting'}
              data-ball-color={special ? 'red' : 'white'} ref={el => { ballNodes.current[index] = el }}
              style={{ '--slot': index } as CSSProperties} role="img" aria-hidden={!isSettled || undefined}
              aria-label={`${special ? rules.specialName : 'White ball'} ${numberLabel(value)}`}>
              <span className="ball-face">{numberLabel(value)}</span>
            </div>
          })}
        </div>
      </div>
    </div>
    <div className="tube-legend">
      <div><i className="white-dot" aria-hidden="true" />White balls</div>
      <div><i className="red-dot" aria-hidden="true" />{rules.specialName}</div>
    </div>
    <p className="draw-status" role="status">
      {settled
        ? `Settled ${settled} of 6 · ${shownWhite.map(numberLabel).join(' · ')}${settled === 6 ? ` · ${rules.specialName} ${numberLabel(values[5])}` : ''}`
        : revealing ? 'Drawing in progress' : 'Ready to draw'}
    </p>
    {draw?.powerPlay !== undefined && <p className="draw-power">Power Play drawn <strong>{draw.powerPlay}×</strong></p>}
  </div>
}

export function DrawStage({ round, heading, send, busy, printingId }: {
  round: Round, heading: RefObject<HTMLHeadingElement | null>, send: (command: Command) => void,
  busy: boolean, printingId?: string,
}) {
  const ticket = round.ticket!
  const rules = RULES[ticket.scenario.game]
  const reduced = useReducedMotion()
  const [printed, setPrinted] = useState(false)
  const skip = useRef<HTMLButtonElement>(null)
  const attempt = round.drawAttempt ?? (round.draw ? 1 : 0)
  const printing = !reduced && !printed && printingId === ticket.id && round.phase === 'issued'
  useEffect(() => {
    if (!printing) return
    const timeout = window.setTimeout(() => setPrinted(true), 760)
    return () => window.clearTimeout(timeout)
  }, [printing])

  useLayoutEffect(() => {
    if (round.phase === 'revealing') {
      window.scrollTo(0, 0)
      skip.current?.focus({ preventScroll: true })
    }
    if (round.phase === 'complete' && document.activeElement === document.body) heading.current?.focus()
  }, [round.phase, attempt, heading])

  const result = round.phase === 'complete' ? scoreTicket(ticket, round.draw!, rules) : undefined
  return <main className={`draw-stage ${rules.game}`}>
    <section className="draw-side" aria-labelledby="draw-title">
      <div className="draw-heading">
        <h2 id="draw-title">Simulated draw</h2>
        <span>{rules.name}</span>
      </div>
      <Tube key={attempt} round={round} complete={() => send({ type: 'complete' })} reduced={reduced} />
    </section>
    <div className="ticket-column">
      <div className={`printer ${printing ? 'printing' : ''}`}>
        <div className="printer-slot" aria-hidden="true" />
        <div className="feed-mask">
          <div className="feed-paper"><Ticket ticket={ticket} result={result} heading={heading} /></div>
        </div>
      </div>
      <div className={`draw-controls ticket-controls${round.phase === 'revealing' ? ' can-skip' : ''}`}>
        {round.phase === 'issued' && <button type="button" className="primary" aria-disabled={busy}
          onClick={() => send({ type: 'start' })}>Start draw</button>}
        {round.phase === 'revealing' && <button type="button" className="primary" ref={skip} aria-disabled={busy}
          onClick={() => send({ type: 'complete' })}>Skip to results</button>}
        {round.phase === 'complete' && <>
          <button type="button" className="primary" aria-disabled={busy} onClick={() => send({ type: 'redraw' })}>
            Draw again
          </button>
          <button type="button" aria-disabled={busy} onClick={() => send({ type: 'again' })}>Play again</button>
        </>}
      </div>
    </div>
    <DrawCharts scenario={ticket.scenario} />
    {printing && <div className="review-away" inert aria-hidden="true">
      <Review round={round} send={() => {}} busy={true} />
    </div>}
  </main>
}
