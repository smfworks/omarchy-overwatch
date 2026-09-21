import { TOOLS } from '../catalog/tools'
import { CATEGORIES } from '../catalog/types'
import { HOTSPOTS } from '../data/hotspots'
import { isDangerousWeather } from '../maps/weather'
import { useOverwatch } from '../state/context'

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function DetailPanel() {
  const {
    selection,
    selectTool,
    selectHotspot,
    selectPoint,
    selectHeat,
    pinSelection,
    openStage,
    goBack,
    stage,
    displayLayers,
    heatEnabled,
    heatCells,
    heatNote,
    runBrief,
    briefPrefs,
    openTool,
    toggleFavorite,
    favorites,
  } = useOverwatch()

  const livePoints = displayLayers.flatMap((layer) =>
    layer.enabled && (layer.status === 'live' || layer.status === 'stale') ? layer.points.slice(0, 8) : [],
  )

  if (!selection) {
    return (
      <>
        <div className="panel-head">Dossier</div>
        <div className="panel-body">
          <div className="empty">
            Select a catalog card, ticker headline, demo beacon, live highlight, or attention cell. Overwatch OSINT for
            Omarchy is a public-source launcher — it does not collect targets or invent intelligence.
          </div>
          {heatEnabled && (
            <>
              <div className="count-line">Attention cells</div>
              <p className="case-hint">{heatNote}</p>
              {heatCells.slice(0, 12).map((cell) => (
                <button key={cell.id} className="tool-card selectable" onClick={() => selectHeat(cell)}>
                  <h3>
                    L={cell.layerCount} · {cell.pointCount} pts
                  </h3>
                  <p>
                    {cell.lat.toFixed(2)}°, {cell.lng.toFixed(2)}° · {cell.contributors.map((c) => c.layerLabel).join(' + ')}
                    {cell.z ? ` · z ${cell.z.toFixed(2)}` : ''}
                  </p>
                </button>
              ))}
              {!heatCells.length && <div className="empty">No overlapping cells in this poll.</div>}
            </>
          )}
          {livePoints.length > 0 && (
            <>
              <div className="count-line">Live highlights</div>
              {livePoints.map((pt) => (
                <button key={pt.id} className="tool-card selectable" onClick={() => selectPoint(pt)}>
                  <h3>{pt.label}</h3>
                  <p>
                    {pt.lat.toFixed(2)}°, {pt.lng.toFixed(2)}° · {pt.kind}
                    {pt.layerId ? ` · ${pt.layerId}` : ''}
                  </p>
                </button>
              ))}
            </>
          )}
          <div className="count-line">Demo beacons</div>
          {HOTSPOTS.map((hs) => (
            <button key={hs.id} className="tool-card selectable" onClick={() => selectHotspot(hs)}>
              <h3>{hs.name}</h3>
              <p>
                {hs.lat.toFixed(2)}°, {hs.lng.toFixed(2)}° · {hs.kind}
              </p>
            </button>
          ))}
        </div>
      </>
    )
  }

  if (selection.kind === 'ticker') {
    const item = selection.item
    return (
      <>
        <div className="panel-head">Headline</div>
        <div className="panel-body detail">
          <h2>{item.title}</h2>
          <dl className="kv">
            <dt>Source</dt>
            <dd>{item.source}</dd>
            <dt>Published</dt>
            <dd>{item.published ?? 'not provided'}</dd>
          </dl>
          <div className="actions">
            <button className="btn" disabled={!item.url} onClick={() => item.url && openUrl(item.url)}>
              Open headline
            </button>
            {stage !== 'depth' ? (
              <button className="btn ghost" onClick={() => openStage('depth')}>
                Inspect on stage
              </button>
            ) : (
              <button className="btn ghost" onClick={goBack}>
                Back to globe
              </button>
            )}
            <button className="btn ghost" onClick={pinSelection}>
              Pin to case
            </button>
          </div>
          <div className="disclaimer">Exactly the title/link/date the feed sent. No article body is fetched.</div>
        </div>
      </>
    )
  }

  if (selection.kind === 'tool') {
    const tool = selection.tool
    const cat = CATEGORIES.find((c) => c.id === tool.category)
    return (
      <>
        <div className="panel-head">Tool dossier</div>
        <div className="panel-body detail">
          <h2>{tool.name}</h2>
          <p>{tool.description}</p>
          <dl className="kv">
            <dt>Domain</dt>
            <dd>{cat?.label ?? tool.category}</dd>
            <dt>OPSEC</dt>
            <dd>
              {tool.opsec === 'passive'
                ? 'Passive — queries public indexes; still assume logging at the far end.'
                : 'Active — your client (or the vendor) contacts the target or third parties.'}
            </dd>
            <dt>Pricing</dt>
            <dd>{tool.pricing}</dd>
            <dt>Inputs</dt>
            <dd>{tool.inputs.join(', ')}</dd>
            <dt>Tags</dt>
            <dd>{tool.tags.join(' · ')}</dd>
          </dl>
          {tool.notes && <p>{tool.notes}</p>}
          <div className="actions">
            <button className="btn" onClick={() => openTool(tool)}>
              Open tool
            </button>
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(tool.url)}>
              Copy URL
            </button>
            <button className="btn ghost" onClick={() => toggleFavorite(tool.id)}>
              {favorites.pinned.includes(tool.id) ? 'Unpin favorite' : 'Pin favorite'}
            </button>
            <button className="btn ghost" onClick={pinSelection}>
              Pin to case
            </button>
            {stage !== 'depth' ? (
              <button className="btn ghost" onClick={() => openStage('depth')}>
                Inspect on stage
              </button>
            ) : (
              <button className="btn ghost" onClick={goBack}>
                Back to globe
              </button>
            )}
          </div>
          <div className="disclaimer">
            Confirm the destination yourself. Catalog metadata can lag; Overwatch OSINT for Omarchy does not vouch for
            third-party uptime, ToS, or legality in your jurisdiction.
          </div>
        </div>
      </>
    )
  }

  if (selection.kind === 'hotspot') {
    const hs = selection.hotspot
    const related = TOOLS.filter((t) => hs.relatedToolIds.includes(t.id))
    return (
      <>
        <div className="panel-head">Hotspot dossier</div>
        <div className="panel-body detail">
          <h2>{hs.name}</h2>
          <div className="coords">
            {hs.lat.toFixed(4)}°, {hs.lng.toFixed(4)}° · {hs.kind}
          </div>
          <p>{hs.summary}</p>
          <div className="meta-row" style={{ margin: '10px 0' }}>
            {hs.relatedCategories.map((c) => (
              <span key={c} className="badge">
                {c}
              </span>
            ))}
          </div>
          <div className="count-line">Related catalog</div>
          {related.map((tool) => (
            <button key={tool.id} className="tool-card selectable" onClick={() => selectTool(tool)}>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
            </button>
          ))}
          <div className="actions">
            {hs.links.map((link) => (
              <button key={link.url} className="btn ghost" onClick={() => openUrl(link.url)}>
                {link.label}
              </button>
            ))}
            <button
              className="btn ghost"
              onClick={() =>
                openUrl(`https://www.openstreetmap.org/?mlat=${hs.lat}&mlon=${hs.lng}#map=6/${hs.lat}/${hs.lng}`)
              }
            >
              OpenStreetMap
            </button>
            {stage !== 'map' ? (
              <button className="btn" onClick={() => openStage('map')}>
                Locality map
              </button>
            ) : (
              <button className="btn ghost" onClick={goBack}>
                Back to globe
              </button>
            )}
            {stage !== 'depth' && (
              <button className="btn ghost" onClick={() => openStage('depth')}>
                Inspect on stage
              </button>
            )}
            <button className="btn ghost" onClick={pinSelection}>
              Pin to case
            </button>
          </div>
          <div className="disclaimer">
            Hotspots are static demo geography for navigation, not live intel. Coordinates are approximate.
          </div>
        </div>
      </>
    )
  }

  if (selection.kind === 'heat') {
    const cell = selection.cell
    return (
      <>
        <div className="panel-head">Attention cell</div>
        <div className="panel-body detail">
          <h2>
            L={cell.layerCount} · {cell.pointCount} feed points
          </h2>
          <div className="coords">
            {cell.lat.toFixed(3)}°, {cell.lng.toFixed(3)}° · H3 r{cell.res} {cell.id}
          </div>
          <dl className="kv">
            <dt>Score L</dt>
            <dd>{cell.score} distinct live layers</dd>
            <dt>z vs local mean</dt>
            <dd>{cell.z.toFixed(3)} (population σ of L among attention cells; 0 if undefined)</dd>
          </dl>
          <div className="count-line">Contributing layers</div>
          {cell.contributors.map((c) => (
            <div key={c.layerId} className="tool-card">
              <h3>{c.layerLabel}</h3>
              <p>
                {c.count} point{c.count === 1 ? '' : 's'} · {c.layerId}
              </p>
            </div>
          ))}
          {cell.hotspots.length > 0 && (
            <>
              <div className="count-line">Demo geography in cell</div>
              {cell.hotspots.map((hs) => (
                <p key={hs.id} className="case-hint">
                  {hs.name} — navigation beacon, not counted in L
                </p>
              ))}
            </>
          )}
          <div className="count-line">Contributing events</div>
          {cell.events.map((ev) => (
            <button
              key={ev.id}
              className="tool-card selectable"
              onClick={() => {
                for (const layer of displayLayers) {
                  const pt = layer.points.find((p) => p.id === ev.id)
                  if (pt) {
                    selectPoint(pt)
                    return
                  }
                }
              }}
            >
              <h3>{ev.label}</h3>
              <p>
                {ev.layerLabel} · {ev.kind} · {ev.lat.toFixed(2)}°, {ev.lng.toFixed(2)}°
                {ev.observedAt ? ` · ${ev.observedAt}` : ''}
              </p>
            </button>
          ))}
          <div className="actions">
            {stage !== 'map' && (
              <button className="btn" onClick={() => openStage('map')}>
                Locality map
              </button>
            )}
            {stage !== 'globe' && (
              <button className="btn ghost" onClick={goBack}>
                Back to globe
              </button>
            )}
            {stage !== 'depth' && (
              <button className="btn ghost" onClick={() => openStage('depth')}>
                Inspect on stage
              </button>
            )}
            {briefPrefs.enabled && (
              <button className="btn ghost" onClick={runBrief}>
                On-screen brief
              </button>
            )}
          </div>
          <div className="disclaimer">
            L is a local count of distinct public layers with real points in this H3 cell. Not a threat score. Color
            maps from L only. Demo hotspots do not count toward L.
          </div>
        </div>
      </>
    )
  }

  const pt = selection.point
  const storm = isDangerousWeather(pt)
  return (
    <>
      <div className="panel-head">Live layer point</div>
      <div className="panel-body detail">
        <h2>{pt.label}</h2>
        <div className="coords">
          {pt.lat.toFixed(3)}°, {pt.lng.toFixed(3)}° · {pt.kind}
          {pt.layerId ? ` · ${pt.layerId}` : ''}
        </div>
        {pt.headline && <p>{pt.headline}</p>}
        {pt.extra && <p>{pt.extra}</p>}
        {pt.detail && <p>{pt.detail.slice(0, 400)}{pt.detail.length > 400 ? '…' : ''}</p>}
        {(pt.heading != null || pt.course != null || pt.speedMs != null || pt.speedKt != null || pt.altitudeM != null) && (
          <dl className="kv">
            {pt.heading != null && (
              <>
                <dt>Heading</dt>
                <dd>{pt.heading.toFixed(0)}°</dd>
              </>
            )}
            {pt.course != null && pt.course !== pt.heading && (
              <>
                <dt>Course</dt>
                <dd>{pt.course.toFixed(0)}°</dd>
              </>
            )}
            {pt.speedMs != null && (
              <>
                <dt>Speed</dt>
                <dd>{pt.speedMs.toFixed(1)} m/s{pt.speedMs >= 0 ? ` · ${(pt.speedMs * 1.94384).toFixed(0)} kt` : ''}</dd>
              </>
            )}
            {pt.speedKt != null && (
              <>
                <dt>Speed</dt>
                <dd>{pt.speedKt.toFixed(1)} kt</dd>
              </>
            )}
            {pt.altitudeM != null && (
              <>
                <dt>Altitude</dt>
                <dd>{Math.round(pt.altitudeM)} m{pt.onGround ? ' · on ground' : ''}</dd>
              </>
            )}
          </dl>
        )}
        <p>Fetched from a public feed. If a layer is STALE or ERR, treat this as unverified leftover data. ADS-B/AIS trails are sampled polls, not full-sky coverage.</p>
        <div className="actions">
          {storm && stage !== 'storm' && (
            <button className="btn" onClick={() => openStage('storm')}>
              Storm map
            </button>
          )}
          {stage !== 'map' && (
            <button className={storm ? 'btn ghost' : 'btn'} onClick={() => openStage('map')}>
              Locality map
            </button>
          )}
          {stage !== 'globe' && (
            <button className="btn ghost" onClick={goBack}>
              Back to globe
            </button>
          )}
          {stage !== 'depth' && (
            <button className="btn ghost" onClick={() => openStage('depth')}>
              Inspect on stage
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() =>
              openUrl(`https://www.openstreetmap.org/?mlat=${pt.lat}&mlon=${pt.lng}#map=7/${pt.lat}/${pt.lng}`)
            }
          >
            OpenStreetMap
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              const nearby = relatedHotspot(pt.lat, pt.lng)
              if (nearby) selectHotspot(nearby)
            }}
          >
            Nearest demo hotspot
          </button>
          <button className="btn ghost" onClick={pinSelection}>
            Pin to case
          </button>
        </div>
      </div>
    </>
  )
}

function relatedHotspot(lat: number, lng: number) {
  return [...HOTSPOTS].sort((a, b) => dist(a.lat, a.lng, lat, lng) - dist(b.lat, b.lng, lat, lng))[0]
}

function dist(aLat: number, aLng: number, bLat: number, bLng: number) {
  return (aLat - bLat) ** 2 + (aLng - bLng) ** 2
}
