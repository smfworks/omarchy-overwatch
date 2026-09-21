import { useEffect, useState } from 'react'
import { PRODUCT_HUD_SUB, PRODUCT_HUD_TITLE } from '../branding'
import { useOverwatch } from '../state/context'
import { resetLayout } from '../layout/storage'
import { statusCountsLabel } from '../status/counts'
import { ViewsMenu } from '../views/ViewsMenu'
import { TOOLS } from '../catalog/tools'

function utcClock() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}

export function StatusStrip() {
  const {
    setLayout,
    togglePanel,
    filters,
    layers,
    toggleLayer,
    setHelpOpen,
    visibleTools,
    setCasesDrawerOpen,
    casesDrawerOpen,
    caseStore,
    refreshLayers,
    heatEnabled,
    toggleHeat,
    heatStatus,
    heatNote,
    heatCells,
    briefPrefs,
    brief,
    runBrief,
    mapStyle,
    cycleMapStyle,
    setSearchOpen,
    statusCounts,
    cycleHudDensity,
    hudDensity,
    favorites,
    selectTool,
    overlay,
    setOverlay,
  } = useOverwatch()

  const briefDot = !briefPrefs.enabled ? '' : brief.status === 'loading' ? 'loading' : brief.status
  const briefLabel =
    !briefPrefs.enabled
      ? 'BRIEF'
      : brief.status === 'loading'
        ? 'BRIEF LOADING'
        : brief.status === 'err'
          ? 'BRIEF ERR'
          : 'BRIEF'
  const [clock, setClock] = useState(utcClock)
  const pinnedTools = favorites.pinned
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .slice(0, 6)

  useEffect(() => {
    const id = window.setInterval(() => setClock(utcClock()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="status-strip">
      <div className="brand">
        <div className="brand-title">{PRODUCT_HUD_TITLE}</div>
        <div className="brand-sub">{PRODUCT_HUD_SUB}</div>
      </div>
      <div className="clock">{clock}</div>
      <div className="chip-row">
        <span className="chip">{visibleTools.length} tools</span>
        <span className="chip" title="Enabled live-layer honesty counts">
          {statusCountsLabel(statusCounts)}
        </span>
        {filters.categories.map((c) => (
          <span key={c} className="chip">
            {c}
          </span>
        ))}
        {filters.opsec !== 'any' && <span className="chip">{filters.opsec}</span>}
        {!filters.categories.length && filters.opsec === 'any' && (
          <span className="chip ghost">no domain filter</span>
        )}
        {pinnedTools.map((tool) => (
          <button key={tool.id} type="button" className="chip" onClick={() => selectTool(tool)} title={tool.name}>
            ★ {tool.name}
          </button>
        ))}
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
        <button
          className={`layer-btn${heatEnabled ? ' on' : ''}`}
          onClick={toggleHeat}
          title={heatNote}
        >
          <span className={`status-dot ${heatEnabled ? heatStatus : ''}`} />
          HEAT
          {heatEnabled && heatStatus !== 'live' && heatStatus !== 'off' ? ` ${heatStatus.toUpperCase()}` : ''}
          {heatEnabled && heatStatus === 'live' && heatCells.length ? ` ${heatCells.length}` : ''}
        </button>
        <button
          className={`layer-btn${briefPrefs.enabled ? ' on' : ''}`}
          onClick={runBrief}
          title={
            briefPrefs.enabled
              ? brief.error || 'On-screen brief from public feeds currently shown. Off-by-default BYOK / Ollama.'
              : 'On-screen brief is off. Enable it in Help (?). No bundled cloud key.'
          }
        >
          <span className={`status-dot ${briefDot}`} />
          {briefLabel}
        </button>
        <button className="icon-btn" title="Refresh live layers" aria-label="Refresh live layers" onClick={refreshLayers}>
          ↻
        </button>
        <button
          className="layer-btn on"
          onClick={() => cycleMapStyle(1)}
          title={`Basemap ${mapStyle.toUpperCase()}. [ and ] cycle DEFAULT / SATELLITE / NIGHT. Attribution on the map.`}
        >
          MAP {mapStyle.toUpperCase()}
        </button>
        <button
          type="button"
          className={`layer-btn${overlay !== 'off' ? ' on' : ''}`}
          title="Aesthetic overlay only — NVG / FLIR / CRT are not sensors."
          onClick={() =>
            setOverlay(overlay === 'off' ? 'nvg' : overlay === 'nvg' ? 'flir' : overlay === 'flir' ? 'crt' : 'off')
          }
        >
          FX {overlay === 'off' ? 'OFF' : overlay.toUpperCase()}
        </button>
        <ViewsMenu />
        <button type="button" className="layer-btn" title="Global search (⌘K)" onClick={() => setSearchOpen(true)}>
          ⌘K
        </button>
        <button
          type="button"
          className="layer-btn"
          title={`HUD density: ${hudDensity} (d)`}
          onClick={cycleHudDensity}
        >
          HUD {hudDensity.toUpperCase()}
        </button>
      </div>
      <button
        className={`icon-btn cases-btn${casesDrawerOpen ? ' on' : ''}`}
        title="Case notes (n)"
        aria-label="Open case notes"
        aria-expanded={casesDrawerOpen}
        aria-controls="case-drawer-title"
        onClick={() => setCasesDrawerOpen((open) => !open)}
      >
        N
        {caseStore.cases.length > 0 && <span className="cases-count">{caseStore.cases.length}</span>}
      </button>
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
