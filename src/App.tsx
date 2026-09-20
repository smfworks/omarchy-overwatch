import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EMPTY_FILTERS, filterTools, TOOLS, type CatalogFilters } from './catalog'
import type { OsintTool } from './catalog/types'
import { type Hotspot } from './data/hotspots'
import { fetchTicker, type FeedStatus, type TickerItem } from './feeds/rss'
import { OverwatchGlobe } from './globe/OverwatchGlobe'
import { classifyStatus, LAYER_DEFS, type GeoPoint, type LayerState } from './globe/layers'
import { DockLayout } from './layout/DockLayout'
import { loadLayout, saveLayout, sanitizeLayout, type LayoutState, type PanelId } from './layout/storage'
import { CatalogPanel } from './panels/CatalogPanel'
import { DetailPanel } from './panels/DetailPanel'
import { HelpOverlay } from './panels/HelpOverlay'
import { NewsTicker } from './panels/NewsTicker'
import { StatusStrip } from './panels/StatusStrip'
import { OverwatchContext, type Selection } from './state/context'

function initialLayers(): LayerState[] {
  return LAYER_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    enabled: def.id === 'earthquakes' || def.id === 'eonet',
    status: def.id === 'earthquakes' || def.id === 'eonet' ? 'loading' : 'off',
    updatedAt: null,
    error: null,
    points: [],
    note: def.note,
  }))
}

function Provider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutState>(() => loadLayout())
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS)
  const [selection, setSelection] = useState<Selection>(null)
  const [layers, setLayers] = useState<LayerState[]>(initialLayers)
  const [ticker, setTicker] = useState<TickerItem[]>([])
  const [tickerStatus, setTickerStatus] = useState<FeedStatus>('loading')
  const [tickerError, setTickerError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; altitude: number } | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const setLayout = useCallback((next: LayoutState | ((prev: LayoutState) => LayoutState)) => {
    setLayoutState((prev) => sanitizeLayout(typeof next === 'function' ? next(prev) : next))
  }, [])

  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  const visibleTools = useMemo(() => filterTools(TOOLS, filters), [filters])

  const togglePanel = useCallback(
    (id: PanelId) => {
      setLayout((prev) => ({ ...prev, [id]: !prev[id] }))
    },
    [setLayout],
  )

  const selectTool = useCallback((tool: OsintTool | null) => {
    setSelection(tool ? { kind: 'tool', tool } : null)
  }, [])

  const selectHotspot = useCallback((hotspot: Hotspot | null) => {
    if (!hotspot) {
      setSelection(null)
      return
    }
    setSelection({ kind: 'hotspot', hotspot })
    setFlyTo({ lat: hotspot.lat, lng: hotspot.lng, altitude: 1.55 })
  }, [])

  const selectPoint = useCallback((point: GeoPoint | null) => {
    if (!point) {
      setSelection(null)
      return
    }
    setSelection({ kind: 'point', point })
    setFlyTo({ lat: point.lat, lng: point.lng, altitude: 1.7 })
  }, [])

  const loadLayer = useCallback(async (id: string) => {
    const def = LAYER_DEFS.find((d) => d.id === id)
    if (!def) return
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, enabled: true, status: 'loading', error: null } : l)),
    )
    try {
      const points = await def.fetch()
      const updatedAt = Date.now()
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                enabled: true,
                points,
                updatedAt,
                error: null,
                status: classifyStatus({ enabled: true, updatedAt, error: null, points }),
              }
            : l,
        ),
      )
    } catch (err) {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                enabled: true,
                error: err instanceof Error ? err.message : 'fetch failed',
                status: classifyStatus({
                  enabled: true,
                  updatedAt: l.updatedAt,
                  error: 'err',
                  points: l.points,
                }),
              }
            : l,
        ),
      )
    }
  }, [])

  const toggleLayer = useCallback(
    (id: string) => {
      const current = layers.find((l) => l.id === id)
      if (!current) return
      if (current.enabled) {
        setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: false, status: 'off' } : l)))
        return
      }
      void loadLayer(id)
    },
    [layers, loadLayer],
  )

  const refreshLayers = useCallback(() => {
    for (const layer of layers) {
      if (layer.enabled) void loadLayer(layer.id)
    }
  }, [layers, loadLayer])

  useEffect(() => {
    void loadLayer('earthquakes')
    void loadLayer('eonet')
  }, [loadLayer])

  useEffect(() => {
    let cancelled = false
    fetchTicker()
      .then(({ items, errors }) => {
        if (cancelled) return
        if (!items.length) {
          setTicker([])
          setTickerStatus(errors.length ? 'err' : 'empty')
          setTickerError(errors.join(' · ') || null)
          return
        }
        setTicker(items)
        setTickerStatus('live')
        setTickerError(errors.length ? errors.join(' · ') : null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setTickerStatus('err')
        setTickerError(err instanceof Error ? err.message : 'feed failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const focusSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        focusSearch()
      }
      if (e.key === '?' && !typing) {
        e.preventDefault()
        setHelpOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false)
          return
        }
        if (selection) {
          setSelection(null)
          return
        }
        if (filters.query) {
          setFilters((p) => ({ ...p, query: '' }))
          return
        }
        target?.blur?.()
      }
      if (typing) return
      if (e.key === '1') togglePanel('left')
      if (e.key === '2') togglePanel('right')
      if (e.key === '3') togglePanel('top')
      if (e.key === '4') togglePanel('bottom')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filters.query, focusSearch, helpOpen, selection, togglePanel])

  const value = {
    layout,
    setLayout,
    togglePanel,
    filters,
    setFilters,
    visibleTools,
    selection,
    selectTool,
    selectHotspot,
    selectPoint,
    layers,
    toggleLayer,
    refreshLayers,
    ticker,
    tickerStatus,
    tickerError,
    helpOpen,
    setHelpOpen,
    searchRef,
    focusSearch,
    flyTo,
  }

  return <OverwatchContext.Provider value={value}>{children}</OverwatchContext.Provider>
}

export default function App() {
  return (
    <Provider>
      <div className="app">
        <DockLayout
          top={<StatusStrip />}
          left={<CatalogPanel />}
          right={<DetailPanel />}
          bottom={<NewsTicker />}
          center={<OverwatchGlobe />}
        />
        <HelpOverlay />
      </div>
    </Provider>
  )
}
