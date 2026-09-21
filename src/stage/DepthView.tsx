import { CATEGORIES } from '../catalog/types'
import { TOOLS } from '../catalog/tools'
import { useOverwatch } from '../state/context'

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function DepthView() {
  const { selection, selectTool, selectPoint, pinSelection, openStage, displayLayers, openTool } = useOverwatch()

  if (!selection) {
    return (
      <div className="depth-view">
        <div className="empty">Nothing selected. Choose a catalog card, ticker headline, or globe point.</div>
      </div>
    )
  }

  if (selection.kind === 'tool') {
    const tool = selection.tool
    const cat = CATEGORIES.find((c) => c.id === tool.category)
    return (
      <div className="depth-view">
        <div className="depth-kicker">Catalog tool</div>
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
          <dt>URL</dt>
          <dd>{tool.url}</dd>
        </dl>
        {tool.notes && <p>{tool.notes}</p>}
        <div className="actions">
          <button className="btn" onClick={() => openTool(tool)}>
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
          Catalog metadata can lag. Overwatch OSINT for Omarchy does not vouch for third-party uptime, ToS, or
          legality in your jurisdiction. Nothing here is invented intel.
        </div>
      </div>
    )
  }

  if (selection.kind === 'ticker') {
    const item = selection.item
    return (
      <div className="depth-view">
        <div className="depth-kicker">Headline · {item.source}</div>
        <h2>{item.title}</h2>
        <dl className="kv">
          <dt>Source</dt>
          <dd>{item.source}</dd>
          <dt>Published</dt>
          <dd>{item.published ?? 'not provided by feed'}</dd>
          <dt>URL</dt>
          <dd>{item.url || 'not provided by feed'}</dd>
        </dl>
        <div className="actions">
          <button className="btn" disabled={!item.url} onClick={() => item.url && openUrl(item.url)}>
            Open headline
          </button>
          <button className="btn ghost" onClick={pinSelection}>
            Pin to case
          </button>
        </div>
        <div className="disclaimer">
          Title, link, and date are exactly what the RSS/Atom feed sent. No article body is fetched or summarized.
        </div>
      </div>
    )
  }

  if (selection.kind === 'hotspot') {
    const hs = selection.hotspot
    const related = TOOLS.filter((t) => hs.relatedToolIds.includes(t.id))
    return (
      <div className="depth-view">
        <div className="depth-kicker">Demo hotspot</div>
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
          <button className="btn ghost" onClick={() => openStage('map')}>
            Locality map
          </button>
          <button className="btn ghost" onClick={pinSelection}>
            Pin to case
          </button>
        </div>
        <div className="disclaimer">
          Hotspots are static demo geography for navigation, not live intel. Coordinates are approximate.
        </div>
      </div>
    )
  }

  if (selection.kind === 'heat') {
    const cell = selection.cell
    return (
      <div className="depth-view">
        <div className="depth-kicker">Attention cell · H3 r{cell.res}</div>
        <h2>
          L={cell.layerCount} distinct layers · {cell.pointCount} points
        </h2>
        <div className="coords">
          {cell.lat.toFixed(4)}°, {cell.lng.toFixed(4)}° · {cell.id}
        </div>
        <dl className="kv">
          <dt>Score L</dt>
          <dd>{cell.score} = count of distinct enabled live/stale layers with a real point in this cell</dd>
          <dt>z</dt>
          <dd>{cell.z.toFixed(3)} = (L − mean L) / population σ among attention cells</dd>
        </dl>
        <div className="count-line">Layers</div>
        {cell.contributors.map((c) => (
          <p key={c.layerId}>
            {c.layerLabel} ({c.layerId}): {c.count}
          </p>
        ))}
        {cell.hotspots.length > 0 && (
          <p>Demo geography in cell: {cell.hotspots.map((h) => h.name).join(', ')} (not counted in L).</p>
        )}
        <div className="count-line">Events from public feeds</div>
        {cell.events.map((ev) => (
          <button
            key={ev.id}
            className="tool-card"
            onClick={() => {
              for (const layer of displayLayers) {
                const pt = layer.points.find((p) => p.id === ev.id)
                if (pt) selectPoint(pt)
              }
            }}
          >
            <h3>{ev.label}</h3>
            <p>
              {ev.layerLabel} · {ev.id} · {ev.lat.toFixed(3)}°, {ev.lng.toFixed(3)}°
            </p>
          </button>
        ))}
        <div className="actions">
          <button className="btn" onClick={() => openStage('map')}>
            Locality map
          </button>
        </div>
        <div className="disclaimer">
          Transparent local overlay. No ML score. Coordinates and labels are copied from the current poll only.
        </div>
      </div>
    )
  }

  const pt = selection.point
  return (
    <div className="depth-view">
      <div className="depth-kicker">Live layer point{pt.layerId ? ` · ${pt.layerId}` : ''}</div>
      <h2>{pt.label}</h2>
      <div className="coords">
        {pt.lat.toFixed(3)}°, {pt.lng.toFixed(3)}° · {pt.kind}
      </div>
      <dl className="kv">
        {pt.eventType && (
          <>
            <dt>Event</dt>
            <dd>{pt.eventType}</dd>
          </>
        )}
        {pt.severity && (
          <>
            <dt>Severity</dt>
            <dd>{pt.severity}</dd>
          </>
        )}
        {pt.urgency && (
          <>
            <dt>Urgency</dt>
            <dd>{pt.urgency}</dd>
          </>
        )}
        {pt.observedAt && (
          <>
            <dt>Observed</dt>
            <dd>{pt.observedAt}</dd>
          </>
        )}
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
            <dd>{pt.speedMs.toFixed(1)} m/s · {(pt.speedMs * 1.94384).toFixed(0)} kt</dd>
          </>
        )}
        {pt.speedKt != null && (
          <>
            <dt>Speed (SOG)</dt>
            <dd>{pt.speedKt.toFixed(1)} kt</dd>
          </>
        )}
        {pt.altitudeM != null && (
          <>
            <dt>Altitude</dt>
            <dd>{Math.round(pt.altitudeM)} m{pt.onGround ? ' · on ground' : ''}</dd>
          </>
        )}
        {pt.areaDesc && (
          <>
            <dt>Area</dt>
            <dd>{pt.areaDesc}</dd>
          </>
        )}
        {pt.categories?.length ? (
          <>
            <dt>Categories</dt>
            <dd>{pt.categories.join(' · ')}</dd>
          </>
        ) : null}
        {pt.sourceUrl && (
          <>
            <dt>Source</dt>
            <dd>{pt.sourceUrl}</dd>
          </>
        )}
      </dl>
      {pt.headline && <p>{pt.headline}</p>}
      {pt.detail && <p>{pt.detail}</p>}
      {pt.extra && <p>{pt.extra}</p>}
      <p>Fetched from a public feed. If the layer is STALE or ERR, treat this as unverified leftover data.</p>
      <div className="actions">
        <button className="btn" onClick={() => openStage('map')}>
          Locality map
        </button>
        <button className="btn ghost" onClick={pinSelection}>
          Pin to case
        </button>
        {pt.sourceUrl && (
          <button className="btn ghost" onClick={() => openUrl(pt.sourceUrl!)}>
            Open source
          </button>
        )}
      </div>
    </div>
  )
}
