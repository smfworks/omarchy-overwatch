import { CATEGORIES } from '../catalog/types'
import { TOOLS } from '../catalog/tools'
import { useOverwatch } from '../state/context'

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function DepthView() {
  const { selection, selectTool, pinSelection, openStage } = useOverwatch()

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
