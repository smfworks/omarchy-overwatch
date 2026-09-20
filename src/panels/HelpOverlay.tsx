import { PRODUCT_NAME } from '../branding'
import { useOverwatch } from '../state/context'

export function HelpOverlay() {
  const { helpOpen, setHelpOpen } = useOverwatch()
  if (!helpOpen) return null
  return (
    <div className="help-overlay" onClick={() => setHelpOpen(false)}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h2>{PRODUCT_NAME.toUpperCase()}</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Catalog + globe for public OSINT sources. Not a scanner, not a C2, not a substitute for lawful process.
          Product name is {PRODUCT_NAME}. CLI and install path stay <code>omarchy-overwatch</code>.
        </p>
        <ul>
          <li>
            <kbd>/</kbd> focus catalog search
          </li>
          <li>
            <kbd>Esc</kbd> close help → close case notes → back to globe → clear selection → clear query
          </li>
          <li>
            <kbd>b</kbd> back to globe from map / storm / depth
          </li>
          <li>
            <kbd>n</kbd> case notes drawer (local scratchpad)
          </li>
          <li>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> toggle left / right / top / bottom docks
          </li>
          <li>
            <kbd>?</kbd> this panel
          </li>
        </ul>
        <p className="disclaimer">
          Select a catalog card or ticker headline for an in-depth center view. Select a hotspot or live point to
          zoom, then open a locality map (OpenFreeMap / OSM). Dangerous weather (NWS / EONET) opens a storm map
          with optional RainViewer radar. Status is LIVE / STALE / ERR / OFF — never invented intel. Passive vs
          active OPSEC is labeled per tool.
        </p>
        <button className="btn" onClick={() => setHelpOpen(false)}>
          Close
        </button>
      </div>
    </div>
  )
}
