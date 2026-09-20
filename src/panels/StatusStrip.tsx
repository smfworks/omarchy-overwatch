import { useEffect, useState } from 'react'
import { useOverwatch } from '../state/context'
import { resetLayout } from '../layout/storage'

function utcClock() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}

export function StatusStrip() {
  const { setLayout, togglePanel, filters, layers, toggleLayer, setHelpOpen, visibleTools } =
    useOverwatch()
  const [clock, setClock] = useState(utcClock)

  useEffect(() => {
    const id = window.setInterval(() => setClock(utcClock()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="status-strip">
      <div className="brand">
        <div className="brand-title">OMARCHY OVERWATCH</div>
        <div className="brand-sub">Public-source OSINT workbench</div>
      </div>
      <div className="clock">{clock}</div>
      <div className="chip-row">
        <span className="chip">{visibleTools.length} tools</span>
        {filters.categories.map((c) => (
          <span key={c} className="chip">
            {c}
          </span>
        ))}
        {filters.opsec !== 'any' && <span className="chip">{filters.opsec}</span>}
        {!filters.categories.length && filters.opsec === 'any' && (
          <span className="chip ghost">no domain filter</span>
        )}
      </div>
      <div className="layer-toggles">
        {layers.map((layer) => (
          <button
            key={layer.id}
            className={`layer-btn${layer.enabled ? ' on' : ''}`}
            onClick={() => toggleLayer(layer.id)}
            title={layer.note + (layer.error ? ` · ${layer.error}` : '')}
          >
            <span className={`status-dot ${layer.enabled ? layer.status : ''}`} />
            {layer.label}
            {layer.enabled && layer.status !== 'live' && layer.status !== 'off' ? ` ${layer.status.toUpperCase()}` : ''}
          </button>
        ))}
      </div>
      <button className="icon-btn" title="Toggle catalog" onClick={() => togglePanel('left')}>
        L
      </button>
      <button className="icon-btn" title="Toggle dossier" onClick={() => togglePanel('right')}>
        R
      </button>
      <button className="icon-btn" title="Toggle ticker" onClick={() => togglePanel('bottom')}>
        B
      </button>
      <button className="icon-btn" title="Reset layout" onClick={() => setLayout(resetLayout())}>
        ⌂
      </button>
      <button className="icon-btn" title="Help" onClick={() => setHelpOpen(true)}>
        ?
      </button>
    </div>
  )
}
