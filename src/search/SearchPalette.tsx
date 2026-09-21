import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { searchWorkspace, type SearchHit } from './query'
import { useOverwatch } from '../state/context'
import { TOOLS } from '../catalog/tools'
import { activeCase } from '../cases/storage'

export function SearchPalette() {
  const {
    searchOpen,
    setSearchOpen,
    selectTool,
    selectPoint,
    selectHeat,
    selectTicker,
    displayLayers,
    heatCells,
    ticker,
    caseStore,
    openStage,
  } = useOverwatch()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const points = useMemo(
    () => displayLayers.flatMap((l) => (l.enabled && (l.status === 'live' || l.status === 'stale') ? l.points : [])),
    [displayLayers],
  )
  const pins = activeCase(caseStore)?.pins ?? []
  const hits = useMemo(
    () => searchWorkspace(query, { tools: TOOLS, points, cells: heatCells, ticker, pins, limit: 20 }),
    [query, points, heatCells, ticker, pins],
  )

  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setActive(0)
      const t = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(t)
    }
  }, [searchOpen])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!searchOpen) return null

  const activate = (hit: SearchHit) => {
    setSearchOpen(false)
    if (hit.kind === 'tool' && hit.tool) {
      selectTool(hit.tool)
      return
    }
    if (hit.kind === 'point' && hit.point) {
      selectPoint(hit.point)
      return
    }
    if (hit.kind === 'heat' && hit.cell) {
      selectHeat(hit.cell)
      return
    }
    if (hit.kind === 'ticker' && hit.ticker) {
      selectTicker(hit.ticker)
      return
    }
    if (hit.kind === 'pin' && hit.pin) {
      if (hit.pin.type === 'tool') {
        const tool = TOOLS.find((t) => t.id === hit.pin!.id)
        if (tool) selectTool(tool)
        return
      }
      if (hit.pin.type === 'hotspot' || hit.pin.type === 'point') {
        selectPoint({
          id: hit.pin.id,
          lat: hit.pin.lat,
          lng: hit.pin.lng,
          label: hit.pin.label,
          kind: hit.pin.type === 'point' ? (hit.pin.kind as 'event') : 'event',
        })
        return
      }
      if (hit.pin.type === 'ticker') {
        selectTicker({
          id: hit.pin.id,
          title: hit.pin.label,
          url: hit.pin.url,
          source: hit.pin.source,
          published: hit.pin.published ?? null,
          feedId: hit.pin.feedId ?? 'pinned',
        })
        openStage('depth')
      }
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSearchOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(hits.length - 1, i + 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    }
    if (e.key === 'Enter' && hits[active]) {
      e.preventDefault()
      activate(hits[active])
    }
  }

  return (
    <div className="palette-overlay" onClick={() => setSearchOpen(false)}>
      <div
        className="palette-card"
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="search palette-input"
          placeholder="Search tools, live points, HEAT, headlines, pins…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          aria-autocomplete="list"
        />
        <div className="palette-hint">⌘K / Ctrl+K · Enter to focus · Esc to close · public catalog + currently loaded feeds only</div>
        <ul className="palette-list" role="listbox">
          {hits.map((hit, i) => (
            <li key={hit.id}>
              <button
                type="button"
                className={`palette-hit${i === active ? ' active' : ''}`}
                onClick={() => activate(hit)}
                onMouseEnter={() => setActive(i)}
                role="option"
                aria-selected={i === active}
              >
                <span className="palette-kind">{hit.kind}</span>
                <span className="palette-title">{hit.title}</span>
                <span className="palette-sub">{hit.subtitle}</span>
              </button>
            </li>
          ))}
          {query.trim() && !hits.length && (
            <li className="palette-empty">No matches in the catalog or currently loaded public feeds. Nothing was invented.</li>
          )}
          {!query.trim() && <li className="palette-empty">Type to search. Results are catalog rows and on-screen public data only.</li>}
        </ul>
      </div>
    </div>
  )
}
