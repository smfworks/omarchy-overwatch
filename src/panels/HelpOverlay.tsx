import { PRODUCT_NAME } from '../branding'
import { HEAT_FORMULA_HELP } from '../heat/formula'
import { useOverwatch } from '../state/context'
import { BriefSettings } from './BriefSettings'
import { WorkspaceBackup } from '../workspace/WorkspaceBackup'

export function HelpOverlay() {
  const { helpOpen, setHelpOpen, startTour } = useOverwatch()
  if (!helpOpen) return null
  return (
    <div className="help-overlay" onClick={() => setHelpOpen(false)}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h2>{PRODUCT_NAME.toUpperCase()} · v3.1</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Catalog + globe for public OSINT sources. Not a scanner, not a C2, not a substitute for lawful process.
          Product name is {PRODUCT_NAME}. CLI and install path stay <code>omarchy-overwatch</code>.
        </p>
        <ul>
          <li>
            <kbd>/</kbd> focus catalog search
          </li>
          <li>
            <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd> / <kbd>k</kbd> global search palette (tools, live points, HEAT, headlines, pins)
          </li>
          <li>
            <kbd>Esc</kbd> close search → guided open → region summary → tour → help → case notes → clear AOI → back to globe → clear selection → clear query
          </li>
          <li>
            <kbd>b</kbd> back to globe from map / storm / depth / brief
          </li>
          <li>
            <kbd>n</kbd> case notes drawer (local scratchpad)
          </li>
          <li>
            <kbd>d</kbd> cycle HUD density Operator / Minimal / Presentation
          </li>
          <li>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> toggle left / right / top / bottom docks
          </li>
          <li>
            <kbd>[</kbd> <kbd>]</kbd> cycle locality/storm basemap DEFAULT / SATELLITE / NIGHT
          </li>
          <li>
            <kbd>?</kbd> this panel
          </li>
        </ul>
        <p className="disclaimer">
          Select a catalog card or ticker headline for an in-depth center view. Select a hotspot or live point to
          zoom, then open a locality map. Draw a rectangle or polygon AOI on the map to clip visible points and HEAT.
          Time scrubber 1h / 6h / 24h filters dated public points already polled — history is never invented. Right-click
          the map or globe for an on-screen summary of currently loaded public points (UNKNOWN if empty; not a sitrep).
          Shareable <code>?lat=&lon=&z=&layers=&style=&aoi=</code> updates via replaceState. Basemap pack: DEFAULT (OSM
          raster), SATELLITE (Esri World Imagery, attributed), NIGHT (OpenFreeMap dark vector; OSM raster fallback). NVG /
          FLIR / CRT are aesthetic tints only. Dangerous weather (NWS / EONET / NHC) opens a storm map with optional
          RainViewer radar. ADS-B/AIS trails are a client ring buffer of sampled polls — not full-sky coverage. Status is
          LIVE / STALE / ERR / OFF — never invented intel. Passive vs active OPSEC is labeled per tool. Open tool may
          prompt for optional domain/email/hash fields and an OPSEC reminder; the catalog URL is not turned into a scanner.
        </p>
        <div className="count-line">HEAT (attention)</div>
        <p className="case-hint">{HEAT_FORMULA_HELP}</p>
        <BriefSettings />
        <WorkspaceBackup />
        <div className="actions">
          <button className="btn ghost" onClick={startTour}>
            Replay tour
          </button>
          <button className="btn" onClick={() => setHelpOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
