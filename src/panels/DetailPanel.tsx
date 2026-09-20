import { TOOLS } from '../catalog/tools'
import { CATEGORIES } from '../catalog/types'
import { HOTSPOTS } from '../data/hotspots'
import { useOverwatch } from '../state/context'

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function DetailPanel() {
  const { selection, selectTool, selectHotspot, pinSelection } = useOverwatch()

  if (!selection) {
    return (
      <>
        <div className="panel-head">Dossier</div>
        <div className="panel-body">
          <div className="empty">
            Select a catalog card or a globe beacon. Overwatch is a public-source launcher — it does not collect
            targets or invent intelligence.
          </div>
          <div className="count-line">Demo beacons</div>
          {HOTSPOTS.map((hs) => (
            <button key={hs.id} className="tool-card" onClick={() => selectHotspot(hs)}>
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
            <button className="btn" onClick={() => openUrl(tool.url)}>
              Open tool
            </button>
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(tool.url)}>
              Copy URL
            </button>
            <button className="btn ghost" onClick={pinSelection}>
              Pin to case
            </button>
          </div>
          <div className="disclaimer">
            Confirm the destination yourself. Catalog metadata can lag; Overwatch does not vouch for third-party
            uptime, ToS, or legality in your jurisdiction.
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
            <button key={tool.id} className="tool-card" onClick={() => selectTool(tool)}>
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

  const pt = selection.point
  return (
    <>
      <div className="panel-head">Live layer point</div>
      <div className="panel-body detail">
        <h2>{pt.label}</h2>
        <div className="coords">
          {pt.lat.toFixed(3)}°, {pt.lng.toFixed(3)}° · {pt.kind}
        </div>
        {pt.extra && <p>{pt.extra}</p>}
        <p>Fetched from a public feed. If a layer is STALE or ERR, treat this as unverified leftover data.</p>
        <div className="actions">
          <button
            className="btn"
            onClick={() =>
              openUrl(`https://www.openstreetmap.org/?mlat=${pt.lat}&mlon=${pt.lng}#map=7/${pt.lat}/${pt.lng}`)
            }
          >
            Open map
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
