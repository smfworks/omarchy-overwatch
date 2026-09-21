import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EMPTY_FILTERS, filterTools, TOOLS, type CatalogFilters } from './catalog'
import type { OsintTool } from './catalog/types'
import { pinFromHotspot, pinFromPoint, pinFromTicker, pinFromTool } from './cases/pins'
import {
  activeCase,
  addPin,
  createEmptyCase,
  loadCases,
  saveCases,
  sanitizeStore,
  upsertCase,
} from './cases/storage'
import type { CaseStoreV1 } from './cases/types'
import { HOTSPOTS, type Hotspot } from './data/hotspots'
import { fetchTicker, type FeedRuntime, type FeedStatus, type TickerItem } from './feeds/rss'
import { loadFeedPrefs, saveFeedPrefs, sanitizeFeedPrefs, type FeedPrefsV1 } from './feeds/storage'
import { classifyStatus, LAYER_DEFS, type GeoPoint, type LayerState } from './globe/layers'
import { DockLayout } from './layout/DockLayout'
import { loadLayout, saveLayout, sanitizeLayout, type LayoutState, type PanelId } from './layout/storage'
import { isDangerousWeather } from './maps/weather'
import { briefConfigError, loadBriefPrefs, saveBriefPrefs, sanitizeBriefPrefs } from './brief/storage'
import { requestBrief } from './brief/client'
import { buildBriefSnapshot } from './brief/snapshot'
import type { BriefPrefsV1, BriefResult } from './brief/types'
import { loadHeatPrefs, saveHeatPrefs } from './heat/storage'
import { classifyHeatStatus, heatStatusNote } from './heat/status'
import type { HeatCell } from './heat/types'
import { CaseNotesDrawer } from './panels/CaseNotesDrawer'
import { CatalogPanel } from './panels/CatalogPanel'
import { DetailPanel } from './panels/DetailPanel'
import { HelpOverlay } from './panels/HelpOverlay'
import { NewsTicker } from './panels/NewsTicker'
import { StatusStrip } from './panels/StatusStrip'
import { CenterStage } from './stage/CenterStage'
import {
  OverwatchContext,
  type CameraPov,
  type Selection,
  type StageMode,
} from './state/context'

const LAYER_POLL_MS = 120_000
const LAYER_STALE_CHECK_MS = 30_000
const TICKER_POLL_MS = 180_000
const LOCALITY_ALTITUDE = 0.42
const STAGE_AFTER_FLY_MS = 980

const EMPTY_BRIEF: BriefResult = {
  status: 'err',
  text: null,
  error: null,
  model: null,
  provider: null,
  generatedAt: null,
}

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
  const [tickerFeeds, setTickerFeeds] = useState<FeedRuntime[]>([])
  const [feedPrefs, setFeedPrefsState] = useState<FeedPrefsV1>(() => loadFeedPrefs())
  const [heatEnabled, setHeatEnabled] = useState(() => loadHeatPrefs().enabled)
  const [heatCells, setHeatCells] = useState<HeatCell[]>([])
  const [briefPrefs, setBriefPrefsState] = useState<BriefPrefsV1>(() => loadBriefPrefs())
  const [brief, setBrief] = useState<BriefResult>(EMPTY_BRIEF)
  const [helpOpen, setHelpOpen] = useState(false)
  const [flyTo, setFlyTo] = useState<CameraPov | null>(null)
  const [stage, setStage] = useState<StageMode>('globe')
  const [caseStore, setCaseStoreState] = useState<CaseStoreV1>(() => loadCases())
  const [casesDrawerOpen, setCasesDrawerOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const layersRef = useRef(layers)
  const globePovRef = useRef<CameraPov | null>(null)
  const restorePovRef = useRef<CameraPov | null>(null)
  const stageTimerRef = useRef<number>(0)
  const selectionRef = useRef<Selection>(null)
  const heatEnabledRef = useRef(heatEnabled)
  const briefPrefsRef = useRef(briefPrefs)
  const briefRunRef = useRef(0)

  layersRef.current = layers
  selectionRef.current = selection
  heatEnabledRef.current = heatEnabled
  briefPrefsRef.current = briefPrefs

  const setLayout = useCallback((next: LayoutState | ((prev: LayoutState) => LayoutState)) => {
    setLayoutState((prev) => sanitizeLayout(typeof next === 'function' ? next(prev) : next))
  }, [])

  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  const setCaseStore = useCallback((next: CaseStoreV1 | ((prev: CaseStoreV1) => CaseStoreV1)) => {
    setCaseStoreState((prev) => sanitizeStore(typeof next === 'function' ? next(prev) : next))
  }, [])

  useEffect(() => {
    saveCases(caseStore)
  }, [caseStore])

  const setFeedPrefs = useCallback((next: FeedPrefsV1 | ((prev: FeedPrefsV1) => FeedPrefsV1)) => {
    setFeedPrefsState((prev) => sanitizeFeedPrefs(typeof next === 'function' ? next(prev) : next))
  }, [])

  useEffect(() => {
    saveFeedPrefs(feedPrefs)
  }, [feedPrefs])

  const setBriefPrefs = useCallback((next: BriefPrefsV1 | ((prev: BriefPrefsV1) => BriefPrefsV1)) => {
    setBriefPrefsState((prev) => sanitizeBriefPrefs(typeof next === 'function' ? next(prev) : next))
  }, [])

  useEffect(() => {
    saveBriefPrefs(briefPrefs)
  }, [briefPrefs])

  useEffect(() => {
    saveHeatPrefs({ version: 1, enabled: heatEnabled })
  }, [heatEnabled])

  const visibleTools = useMemo(() => filterTools(TOOLS, filters), [filters])

  const heatStatus = useMemo(() => classifyHeatStatus(heatEnabled, layers), [heatEnabled, layers])
  const heatNote = useMemo(() => heatStatusNote(heatStatus, heatCells.length), [heatStatus, heatCells.length])

  useEffect(() => {
    if (!heatEnabled) {
      setHeatCells([])
      return
    }
    let cancelled = false
    void import('./heat/score').then(({ computeHeat, pointsFromLayers }) => {
      if (cancelled) return
      setHeatCells(
        computeHeat(pointsFromLayers(layersRef.current), {
          hotspots: HOTSPOTS.map((hs) => ({ id: hs.id, name: hs.name, lat: hs.lat, lng: hs.lng })),
        }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [heatEnabled, layers])

  useEffect(() => {
    if (selection?.kind !== 'heat') return
    const next = heatCells.find((c) => c.id === selection.cell.id)
    if (!next) {
      if (!heatEnabled || heatStatus === 'err') setSelection(null)
      return
    }
    if (next !== selection.cell) setSelection({ kind: 'heat', cell: next })
  }, [heatCells, heatEnabled, heatStatus, selection])

  const togglePanel = useCallback(
    (id: PanelId) => {
      setLayout((prev) => ({ ...prev, [id]: !prev[id] }))
    },
    [setLayout],
  )

  const reportGlobePov = useCallback((pov: CameraPov) => {
    if (!Number.isFinite(pov.lat) || !Number.isFinite(pov.lng) || !Number.isFinite(pov.altitude)) return
    if (pov.altitude <= 0) return
    globePovRef.current = pov
  }, [])

  const openStage = useCallback((mode: StageMode) => {
    window.clearTimeout(stageTimerRef.current)
    if (mode !== 'globe' && !restorePovRef.current && globePovRef.current) {
      restorePovRef.current = globePovRef.current
    }
    setStage(mode)
  }, [])

  const goBack = useCallback(() => {
    window.clearTimeout(stageTimerRef.current)
    setStage('globe')
    const pov = restorePovRef.current
    restorePovRef.current = null
    if (pov) setFlyTo({ ...pov })
  }, [])

  const scheduleLocality = useCallback(
    (target: CameraPov, mode: StageMode, key: string) => {
      window.clearTimeout(stageTimerRef.current)
      if (stage !== 'globe' && !restorePovRef.current && globePovRef.current) {
        restorePovRef.current = globePovRef.current
      }
      setStage('globe')
      setFlyTo(target)
      stageTimerRef.current = window.setTimeout(() => {
        const sel = selectionRef.current
        const still =
          (sel?.kind === 'hotspot' && sel.hotspot.id === key) ||
          (sel?.kind === 'point' && sel.point.id === key) ||
          (sel?.kind === 'heat' && sel.cell.id === key)
        if (still) {
          if (!restorePovRef.current && globePovRef.current) restorePovRef.current = globePovRef.current
          setStage(mode)
        }
      }, STAGE_AFTER_FLY_MS)
    },
    [stage],
  )

  const selectTool = useCallback(
    (tool: OsintTool | null) => {
      window.clearTimeout(stageTimerRef.current)
      if (!tool) {
        setSelection(null)
        return
      }
      setSelection({ kind: 'tool', tool })
      openStage('depth')
    },
    [openStage],
  )

  const selectHotspot = useCallback(
    (hotspot: Hotspot | null) => {
      if (!hotspot) {
        setSelection(null)
        return
      }
      setSelection({ kind: 'hotspot', hotspot })
      scheduleLocality({ lat: hotspot.lat, lng: hotspot.lng, altitude: LOCALITY_ALTITUDE }, 'map', hotspot.id)
    },
    [scheduleLocality],
  )

  const selectPoint = useCallback(
    (point: GeoPoint | null) => {
      if (!point) {
        setSelection(null)
        return
      }
      setSelection({ kind: 'point', point })
      const mode: StageMode = isDangerousWeather(point) ? 'storm' : 'map'
      scheduleLocality({ lat: point.lat, lng: point.lng, altitude: LOCALITY_ALTITUDE }, mode, point.id)
    },
    [scheduleLocality],
  )

  const selectTicker = useCallback(
    (item: TickerItem | null) => {
      window.clearTimeout(stageTimerRef.current)
      if (!item) {
        setSelection(null)
        return
      }
      setSelection({ kind: 'ticker', item })
      openStage('depth')
    },
    [openStage],
  )

  const selectHeat = useCallback(
    (cell: HeatCell | null) => {
      if (!cell) {
        setSelection(null)
        return
      }
      setSelection({ kind: 'heat', cell })
      if (stage === 'map' || stage === 'storm') {
        window.clearTimeout(stageTimerRef.current)
        setStage('map')
        return
      }
      scheduleLocality({ lat: cell.lat, lng: cell.lng, altitude: LOCALITY_ALTITUDE }, 'map', cell.id)
    },
    [scheduleLocality, stage],
  )

  const toggleHeat = useCallback(() => {
    setHeatEnabled((prev) => !prev)
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
    for (const layer of layersRef.current) {
      if (layer.enabled) void loadLayer(layer.id)
    }
  }, [loadLayer])

  useEffect(() => {
    void loadLayer('earthquakes')
    void loadLayer('eonet')
  }, [loadLayer])

  useEffect(() => {
    const poll = window.setInterval(() => {
      for (const layer of layersRef.current) {
        if (layer.enabled) void loadLayer(layer.id)
      }
    }, LAYER_POLL_MS)
    const stale = window.setInterval(() => {
      setLayers((prev) =>
        prev.map((l) =>
          l.enabled
            ? {
                ...l,
                status: classifyStatus({
                  enabled: l.enabled,
                  updatedAt: l.updatedAt,
                  error: l.error,
                  points: l.points,
                }),
              }
            : l,
        ),
      )
    }, LAYER_STALE_CHECK_MS)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(stale)
    }
  }, [loadLayer])

  useEffect(() => {
    if (selection?.kind !== 'point') return
    for (const layer of layers) {
      const pt = layer.points.find((p) => p.id === selection.point.id)
      if (pt && (pt.extra !== selection.point.extra || pt.headline !== selection.point.headline || pt.lat !== selection.point.lat)) {
        setSelection({ kind: 'point', point: pt })
        return
      }
    }
  }, [layers, selection])

  const loadTicker = useCallback(() => {
    fetchTicker(feedPrefs)
      .then(({ items, errors, feeds }) => {
        setTickerFeeds(feeds)
        if (!items.length) {
          setTicker([])
          setTickerStatus(errors.length ? 'err' : feeds.some((f) => f.enabled) ? 'empty' : 'off')
          setTickerError(errors.join(' · ') || null)
          return
        }
        setTicker(items)
        setTickerStatus(errors.length ? 'stale' : 'live')
        setTickerError(errors.length ? errors.join(' · ') : null)
      })
      .catch((err: unknown) => {
        setTickerStatus('err')
        setTickerError(err instanceof Error ? err.message : 'feed failed')
      })
  }, [feedPrefs])

  useEffect(() => {
    loadTicker()
    const id = window.setInterval(loadTicker, TICKER_POLL_MS)
    return () => window.clearInterval(id)
  }, [loadTicker])

  const runBrief = useCallback(() => {
    const prefs = briefPrefsRef.current
    const cfgErr = briefConfigError(prefs)
    if (cfgErr) {
      setBrief({
        status: 'err',
        text: null,
        error: cfgErr,
        model: prefs.model || null,
        provider: prefs.provider,
        generatedAt: Date.now(),
      })
      openStage('brief')
      if (!prefs.enabled) setHelpOpen(true)
      return
    }
    const runId = ++briefRunRef.current
    setBrief({
      status: 'loading',
      text: null,
      error: null,
      model: prefs.model,
      provider: prefs.provider,
      generatedAt: Date.now(),
    })
    openStage('brief')
    const snapshot = buildBriefSnapshot({
      stage: stage === 'brief' ? 'globe' : stage,
      layers: layersRef.current,
      heatEnabled: heatEnabledRef.current,
      heatStatus: classifyHeatStatus(heatEnabledRef.current, layersRef.current),
      heatCells,
      selection: selectionRef.current,
      ticker,
    })
    void requestBrief(prefs, snapshot).then((result) => {
      if (briefRunRef.current !== runId) return
      if (result.ok) {
        setBrief({
          status: 'live',
          text: result.text,
          error: null,
          model: result.model,
          provider: prefs.provider,
          generatedAt: Date.now(),
        })
        return
      }
      setBrief({
        status: 'err',
        text: null,
        error: result.error,
        model: prefs.model,
        provider: prefs.provider,
        generatedAt: Date.now(),
      })
    })
  }, [heatCells, openStage, stage, ticker])

  const pinSelection = useCallback(() => {
    setCaseStore((prev) => {
      const pin =
        selection?.kind === 'tool'
          ? pinFromTool(selection.tool)
          : selection?.kind === 'hotspot'
            ? pinFromHotspot(selection.hotspot)
            : selection?.kind === 'point'
              ? pinFromPoint(selection.point)
              : selection?.kind === 'ticker'
                ? pinFromTicker(selection.item)
                : null
      if (!pin) return prev
      const rec = activeCase(prev) ?? createEmptyCase('Untitled case')
      return upsertCase(prev, addPin(rec, pin))
    })
    if (selection && selection.kind !== 'heat') setCasesDrawerOpen(true)
  }, [selection, setCaseStore])

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
          e.preventDefault()
          setHelpOpen(false)
          return
        }
        if (casesDrawerOpen) {
          e.preventDefault()
          setCasesDrawerOpen(false)
          return
        }
        if (stage !== 'globe') {
          e.preventDefault()
          e.stopPropagation()
          goBack()
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
      if ((e.key === 'b' || e.key === 'B') && stage !== 'globe') {
        e.preventDefault()
        e.stopPropagation()
        goBack()
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setCasesDrawerOpen((v) => !v)
      }
      if (e.key === '1') togglePanel('left')
      if (e.key === '2') togglePanel('right')
      if (e.key === '3') togglePanel('top')
      if (e.key === '4') togglePanel('bottom')
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [casesDrawerOpen, filters.query, focusSearch, goBack, helpOpen, selection, stage, togglePanel])

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
    selectTicker,
    selectHeat,
    layers,
    toggleLayer,
    refreshLayers,
    heatEnabled,
    toggleHeat,
    heatStatus,
    heatCells,
    heatNote,
    ticker,
    tickerStatus,
    tickerError,
    tickerFeeds,
    feedPrefs,
    setFeedPrefs,
    refreshTicker: loadTicker,
    briefPrefs,
    setBriefPrefs,
    brief,
    runBrief,
    helpOpen,
    setHelpOpen,
    searchRef,
    focusSearch,
    flyTo,
    stage,
    openStage,
    goBack,
    reportGlobePov,
    caseStore,
    setCaseStore,
    casesDrawerOpen,
    setCasesDrawerOpen,
    pinSelection,
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
          center={<CenterStage />}
        />
        <HelpOverlay />
        <CaseNotesDrawer />
      </div>
    </Provider>
  )
}
