import { shortcutForLayer } from './shortcuts'
import { HEAT_LEGEND, swatchForLayer } from './rows'
import { formatEntityCount, layerEntityCounts } from './stats'
import { useOverwatch } from '../state/context'

export function LayerLegend() {
  const {
    legendOpen,
    setLegendOpen,
    displayLayers,
    toggleLayer,
    heatEnabled,
    toggleHeat,
    heatStatus,
    heatCells,
    heatNote,
    setSignalGuideOpen,
  } = useOverwatch()
  const counts = layerEntityCounts(displayLayers)

  return (
    <div className={`layer-legend sensor-grid${legendOpen ? ' open' : ''}`} data-testid="layer-legend">
      <div className="sensor-grid-head">
        <button
          type="button"
          className="map-style-btn"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen(!legendOpen)}
        >
          SENSORS
        </button>
        <button
          type="button"
          className="map-style-btn"
          data-testid="signal-guide-open"
          onClick={() => setSignalGuideOpen(true)}
        >
          GUIDE
        </button>
      </div>
      {legendOpen && (
        <ul>
          {displayLayers.map((layer) => {
            const count = counts.find((row) => row.id === layer.id)
            const shortcut = shortcutForLayer(layer.id)
            const shown = formatEntityCount({
              enabled: layer.enabled,
              status: layer.status,
              count: count?.count ?? 0,
              hasPayload: layer.updatedAt != null,
            })
            return (
              <li key={layer.id}>
                <button
                  type="button"
                  className={`sensor-row${layer.enabled ? ' on' : ''}`}
                  data-testid={`layer-toggle-${layer.id}`}
                  aria-pressed={layer.enabled}
                  title={`${layer.note}${layer.error ? ` · ${layer.error}` : ''}${shortcut ? ` · key ${shortcut}` : ''}`}
                  onClick={() => toggleLayer(layer.id)}
                >
                  <span className="legend-swatch" style={{ background: swatchForLayer(layer.id) }} />
                  <span className="sensor-label">{layer.label}</span>
                  <span className="sensor-count" data-testid={`layer-count-${layer.id}`}>
                    {shown}
                  </span>
                  <span className={`sensor-status ${layer.enabled ? layer.status : 'off'}`}>
                    {layer.enabled ? layer.status.toUpperCase() : 'OFF'}
                  </span>
                  {shortcut ? <kbd>{shortcut}</kbd> : <span />}
                </button>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              className={`sensor-row${heatEnabled ? ' on' : ''}`}
              data-testid="layer-toggle-heat"
              aria-pressed={heatEnabled}
              title={heatNote}
              onClick={toggleHeat}
            >
              <span className="legend-swatch" style={{ background: HEAT_LEGEND[1].color }} />
              <span className="sensor-label">HEAT</span>
              <span className="sensor-count" data-testid="layer-count-heat">
                {formatEntityCount({
                  enabled: heatEnabled,
                  status: heatStatus,
                  count: heatCells.length,
                  hasPayload: heatStatus === 'live' || heatStatus === 'stale',
                })}
              </span>
              <span className={`sensor-status ${heatEnabled ? heatStatus : 'off'}`}>
                {heatEnabled ? heatStatus.toUpperCase() : 'OFF'}
              </span>
              <span />
            </button>
          </li>
          <li className="heat-key">
            {HEAT_LEGEND.map((row) => (
              <span key={row.id}>
                <span className="legend-swatch" style={{ background: row.color }} /> {row.label}
              </span>
            ))}
          </li>
        </ul>
      )}
    </div>
  )
}
