import { useOverwatch } from '../state/context'

export function RegionDossier() {
  const { regionSummary, closeRegion, selectPoint } = useOverwatch()
  if (!regionSummary) return null

  return (
    <aside className="region-dossier" role="dialog" aria-label="On-screen summary">
      <div className="storm-kicker">On-screen summary · not a classified sitrep</div>
      <h2>{regionSummary.unknown ? 'UNKNOWN' : `${regionSummary.pointCount} public points`}</h2>
      <p className="case-hint">
        {regionSummary.scope === 'aoi'
          ? 'Counts from currently loaded public feed points inside the AOI only.'
          : 'Counts from currently loaded public feed points in this view only.'}{' '}
        Empty is UNKNOWN — nothing is inferred.
      </p>
      {regionSummary.layerCounts.map((row) => (
        <div key={row.layerId} className="region-count">
          <span>{row.layerLabel}</span>
          <span>{row.count}</span>
        </div>
      ))}
      {regionSummary.nearest.map((item) => (
        <button
          key={item.id}
          type="button"
          className="tool-card selectable"
          onClick={() =>
            selectPoint({
              id: item.id,
              lat: item.lat,
              lng: item.lng,
              label: item.label,
              kind: item.kind as 'event',
              layerId: item.layerId,
              observedAt: item.observedAt,
            })
          }
        >
          <h3>{item.label}</h3>
          <p>
            {item.layerLabel} · {item.km.toFixed(0)} km · {item.lat.toFixed(2)}°, {item.lng.toFixed(2)}°
          </p>
        </button>
      ))}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={closeRegion}>
          Close
        </button>
      </div>
    </aside>
  )
}
