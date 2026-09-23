import { LAYER_SHORTCUTS } from '../legend/shortcuts'
import { SIGNAL_GUIDE } from '../legend/guide'
import { useOverwatch } from '../state/context'

export function SignalGuide() {
  const { signalGuideOpen, setSignalGuideOpen, setHelpOpen } = useOverwatch()
  if (!signalGuideOpen) return null
  return (
    <div className="help-overlay" data-testid="signal-guide" onClick={() => setSignalGuideOpen(false)}>
      <div
        className="help-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="signal-guide-title">SIGNAL GUIDE</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          What the HUD marks mean, and what they do not. Counts and deltas come from public payloads already fetched.
        </p>
        {SIGNAL_GUIDE.map((entry) => (
          <section key={entry.id} className="guide-entry">
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
          </section>
        ))}
        <div className="count-line">Layer keys</div>
        <ul>
          {LAYER_SHORTCUTS.map((row) => (
            <li key={row.key}>
              <kbd>{row.key}</kbd> toggle {row.label}
            </li>
          ))}
          <li>
            <kbd>g</kbd> this guide
          </li>
          <li>
            <kbd>Esc</kbd> close this guide, then the other panels listed in Help
          </li>
          <li>
            <kbd>?</kbd> keyboard and layout help
          </li>
        </ul>
        <div className="actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setSignalGuideOpen(false)
              setHelpOpen(true)
            }}
          >
            Open help
          </button>
          <button type="button" className="btn" onClick={() => setSignalGuideOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
