import { LAYER_LEGEND } from './rows'
import { useOverwatch } from '../state/context'

export function LayerLegend() {
  const { legendOpen, setLegendOpen } = useOverwatch()
  return (
    <div className={`layer-legend${legendOpen ? ' open' : ''}`}>
      <button
        type="button"
        className="map-style-btn"
        aria-expanded={legendOpen}
        onClick={() => setLegendOpen(!legendOpen)}
      >
        LEGEND
      </button>
      {legendOpen && (
        <ul>
          {LAYER_LEGEND.map((row) => (
            <li key={row.id}>
              <span className="legend-swatch" style={{ background: row.color }} />
              {row.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
