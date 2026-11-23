import { useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/dm-sans/latin-800.css'
import '@fontsource/dm-serif-text/latin-400.css'
import '@fontsource/courier-prime/latin-400.css'
import '@fontsource/courier-prime/latin-700.css'
import { useRound } from './round/useRound'
import { Playslip } from './ui/Playslip'
import { Review } from './ui/Review'
import { DrawStage } from './ui/DrawStage'
import './ui/base.css'
import './ui/playslip.css'
import './ui/draw.css'

function App() {
  const { round, failure, busy, notice, send, printingId, replaceUnreadable } = useRound()
  const heading = useRef<HTMLHeadingElement>(null)
  const phase = round?.phase
  const active = round?.phase === 'edit' && round.game ? round.drafts[round.game].active : undefined

  useLayoutEffect(() => {
    if (phase === 'revealing' || phase === 'complete') return
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [phase, round?.game, active])

  return <>
    <header className="site-header">
      <span className="brand"><span className="symbol" aria-hidden="true" />Live Lotto</span>
      <div className="header-right">
        <span className="header-meta">Lottery simulator</span>
        {phase === 'edit' && <button type="button" className="back" onClick={() => void send({ type: 'chooser' })}>
          ← Choose a game
        </button>}
      </div>
    </header>
    {failure && <section className="storage-message" aria-label="Saving the round">
      <div role="alert">
        <p><strong>{failure.unreadable ? 'Saved round unavailable' :
          failure.operation === 'read' ? 'The saved round could not be read' : 'The round could not be saved'}</strong></p>
        <p>{failure.detail} {failure.unreadable
          ? 'You can start a fresh round.'
          : 'The last saved screen is preserved. Retry to continue.'}</p>
      </div>
      <button type="button" disabled={busy} onClick={failure.retry}>Retry</button>
      {failure.unreadable && <button type="button" disabled={busy} onClick={replaceUnreadable}>Start a fresh round</button>}
    </section>}
    {notice && <p className="storage-notice" role="status">{notice}</p>}
    {!round && !failure && <p className="storage-notice" role="status">Opening the saved round…</p>}
    {round && (phase === 'choose' || phase === 'edit') && <Playslip {...{ round, send, heading }} />}
    {round && phase === 'review' && <main><Review {...{ round, send, busy, heading }} /></main>}
    {round?.ticket && <DrawStage key={round.id} {...{ round, send, busy, heading, printingId }} />}
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
