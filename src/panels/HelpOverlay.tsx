import { PRODUCT_NAME } from '../branding'
import { HEAT_FORMULA_HELP } from '../heat/formula'
import { useOverwatch } from '../state/context'
import { BriefSettings } from './BriefSettings'

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
            <kbd>b</kbd> back to globe from map / storm / depth / brief
          </li>
          <li>
            <kbd>n</kbd> case notes drawer (local scratchpad)
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
          zoom, then open a locality map. Basemap pack: DEFAULT (OSM raster), SATELLITE (Esri World Imagery, attributed),
          NIGHT (OpenFreeMap dark vector; OSM raster fallback). NVG is an aesthetic tint only. Dangerous weather
          (NWS / EONET / NHC) opens a storm map with optional RainViewer radar. ADS-B/AIS trails are a client ring
          buffer of sampled polls — not full-sky coverage. Status is LIVE / STALE / ERR / OFF — never invented intel.
          Passive vs active OPSEC is labeled per tool.
        </p>
        <div className="count-line">HEAT (attention)</div>
        <p className="case-hint">{HEAT_FORMULA_HELP}</p>
        <BriefSettings />
        <button className="btn" onClick={() => setHelpOpen(false)}>
          Close
        </button>
      </div>
    </div>
  )
}
