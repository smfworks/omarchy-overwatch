import { useOverwatch } from '../state/context'

export function HelpOverlay() {
  const { helpOpen, setHelpOpen } = useOverwatch()
  if (!helpOpen) return null
  return (
    <div className="help-overlay" onClick={() => setHelpOpen(false)}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h2>OVERWATCH</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Catalog + globe for public OSINT sources. Not a scanner, not a C2, not a substitute for lawful process.
        </p>
        <ul>
          <li>
            <kbd>/</kbd> focus catalog search
          </li>
          <li>
            <kbd>Esc</kbd> clear selection / close help / clear query
          </li>
          <li>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> toggle left / right / top / bottom docks
          </li>
          <li>
            <kbd>?</kbd> this panel
          </li>
        </ul>
        <p className="disclaimer">
          Passive vs active OPSEC is labeled per tool. Active means your browser or the vendor contacts a third
          party. Completeness is not guaranteed. Use only on information you are allowed to access.
        </p>
        <button className="btn" onClick={() => setHelpOpen(false)}>
          Close
        </button>
      </div>
    </div>
  )
}
