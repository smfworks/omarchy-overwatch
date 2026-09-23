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
import { captureRestorePov } from './globe/camera'
import { classifyStatus, type GeoPoint, type LayerState } from './globe/layers'
import { LAYER_DEFS } from './globe/registry'
import { clearTracksForLayer, ingestTrackPoints, trailsFromBuffer, type TrackTrail } from './globe/tracks'
import { DockLayout } from './layout/DockLayout'
import { loadLayout, saveLayout, sanitizeLayout, type LayoutState, type PanelId } from './layout/storage'
import { isDangerousWeather } from './maps/weather'
import { cycleMapStyleId, type MapStyleId } from './maps/styles'
import { loadMapStylePrefs, saveMapStylePrefs } from './maps/storage'
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
import { GuidedOpenModal, toolNeedsGuide } from './panels/GuidedOpenModal'
import { CenterStage } from './stage/CenterStage'
import {
  OverwatchContext,
  type CameraPov,
  type DrawMode,
  type Selection,
  type StageMode,
} from './state/context'
import { pointInAoi, type Aoi, type MapBounds } from './aoi/geo'
import { altitudeToZoom, parseDeepLink, writeDeepLink, zoomToAltitude } from './deeplink/url'
import { ingestHistory, mergeHistory, persistHistory, restoreHistory } from './time/history'
import {
  filterPointsByPlayhead,
  playbackTimes as collectPlaybackTimes,
  windowForPreset,
  type TimePreset,
} from './time/window'
import {
  createView,
  loadViews,
  removeView,
  saveViews,
  sanitizeViewStore,
  upsertView,
  type ViewStoreV1,
} from './views/storage'
import { loadFavorites, recordRecent, saveFavorites, togglePinned, type FavoritesV1 } from './favorites/storage'
import {
  cycleDensity,
  loadHudPrefs,
  saveHudPrefs,
  type HudDensity,
  type MapOverlay,
} from './hud/density'
import { prefersReducedMotion } from './hud/motion'
import { summarizeRegion, type RegionSummary } from './region/summary'
import { countLayerStatuses } from './status/counts'
import { diffEntityIds, type PollDeltaRecord } from './legend/stats'
import { layerIdForShortcut } from './legend/shortcuts'
import { theaterById } from './legend/theaters'
import { SignalGuide } from './panels/SignalGuide'
import { buildWorkspaceBackup, parseWorkspaceBackup, workspaceFilename } from './workspace/backup'
import { loadTourCompleted, saveTourCompleted, TOUR_STEPS } from './tour/storage'
import { SearchPalette } from './search/SearchPalette'
import { FirstRunTour } from './tour/FirstRunTour'

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

function landingLink() {
  if (typeof window === 'undefined') return parseDeepLink('')
  return parseDeepLink(window.location.search)
}

function initialLayers(): LayerState[] {
  const parsed = landingLink()
  const wanted = parsed.layers?.filter((id) => id !== 'heat')
  return LAYER_DEFS.map((def) => {
    const enabled = wanted ? wanted.includes(def.id) : Boolean(def.defaultOn)
    return {
      id: def.id,
      label: def.label,
      enabled,
      status: enabled ? 'loading' : 'off',
      updatedAt: null,
      error: null,
      points: [],
      note: def.note,
    }
  })
}

function download(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
  const [heatEnabled, setHeatEnabled] = useState(() => {
    const parsed = landingLink()
    if (parsed.layers) return parsed.layers.includes('heat')
    return loadHeatPrefs().enabled
  })
  const [heatCells, setHeatCells] = useState<HeatCell[]>([])
  const [briefPrefs, setBriefPrefsState] = useState<BriefPrefsV1>(() => loadBriefPrefs())
  const [brief, setBrief] = useState<BriefResult>(EMPTY_BRIEF)
  const [helpOpen, setHelpOpen] = useState(false)
  const [flyTo, setFlyTo] = useState<CameraPov | null>(() => {
    const parsed = landingLink()
    if (parsed.lat == null || parsed.lon == null) return null
    return { lat: parsed.lat, lng: parsed.lon, altitude: parsed.z != null ? zoomToAltitude(parsed.z) : LOCALITY_ALTITUDE }
  })
  const [stage, setStage] = useState<StageMode>('globe')
  const [caseStore, setCaseStoreState] = useState<CaseStoreV1>(() => loadCases())
  const [casesDrawerOpen, setCasesDrawerOpen] = useState(false)
  const [mapStyle, setMapStyleState] = useState<MapStyleId>(() => landingLink().style ?? loadMapStylePrefs().style)
  const [mapNvg, setMapNvgState] = useState(() => loadMapStylePrefs().nvg)
  const [trails, setTrails] = useState<TrackTrail[]>([])
  const [aoi, setAoi] = useState<Aoi | null>(() => landingLink().aoi ?? null)
  const [drawMode, setDrawMode] = useState<DrawMode>('off')
  const [timePreset, setTimePreset] = useState<TimePreset>('24h')
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [playbackPlaying, setPlaybackPlaying] = useState(false)
  const [viewStore, setViewStore] = useState<ViewStoreV1>(() => loadViews())
  const [searchOpen, setSearchOpen] = useState(false)
  const [regionSummary, setRegionSummary] = useState<RegionSummary | null>(null)
  const [favorites, setFavorites] = useState<FavoritesV1>(() => loadFavorites())
  const [guidedTool, setGuidedTool] = useState<OsintTool | null>(null)
  const [hudDensity, setHudDensity] = useState<HudDensity>(() => loadHudPrefs().density)
  const [overlay, setOverlay] = useState<MapOverlay>(() => {
    const hud = loadHudPrefs()
    if (hud.overlay !== 'off') return hud.overlay
    return loadMapStylePrefs().nvg ? 'nvg' : 'off'
  })
  const [legendOpen, setLegendOpen] = useState(() => loadHudPrefs().legendOpen)
  const [pollDeltas, setPollDeltas] = useState<Record<string, PollDeltaRecord>>({})
  const [activeTheater, setActiveTheater] = useState<string | null>(null)
  const [signalGuideOpen, setSignalGuideOpen] = useState(false)
  const pollIdsRef = useRef<Record<string, string[]>>({})
  const [tourOpen, setTourOpen] = useState(() => !loadTourCompleted())
  const [tourStep, setTourStep] = useState(0)
  const [mapView, setMapView] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion())
  const searchRef = useRef<HTMLInputElement | null>(null)
  const layersRef = useRef(layers)
  const globePovRef = useRef<CameraPov | null>(null)
  const restorePovRef = useRef<CameraPov | null>(null)
  const stageTimerRef = useRef<number>(0)
  const selectionRef = useRef<Selection>(null)
  const heatEnabledRef = useRef(heatEnabled)
  const briefPrefsRef = useRef(briefPrefs)
  const briefRunRef = useRef(0)
  const deepLinkReady = useRef(false)
  const sharePovRef = useRef<{ lat: number; lng: number; z: number } | null>(null)
  const urlLayersRef = useRef<string[] | null>(
    (() => {
      const listed = landingLink().layers
      return listed ? listed.filter((id) => id !== 'heat') : null
    })(),
  )

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

  useEffect(() => {
    saveMapStylePrefs({ version: 1, style: mapStyle, nvg: overlay === 'nvg' || mapNvg })
  }, [mapStyle, mapNvg, overlay])

  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  useEffect(() => {
    saveViews(viewStore)
  }, [viewStore])

  useEffect(() => {
    saveHudPrefs({ version: 1, density: hudDensity, overlay, legendOpen })
  }, [hudDensity, overlay, legendOpen])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const setMapStyle = useCallback((id: MapStyleId) => {
    setMapStyleState(id)
  }, [])

  const setMapNvg = useCallback((on: boolean) => {
    setMapNvgState(on)
    setOverlay(on ? 'nvg' : 'off')
  }, [])

  const cycleMapStyle = useCallback((dir: 1 | -1) => {
    setMapStyleState((prev) => cycleMapStyleId(prev, dir))
  }, [])

  const visibleTools = useMemo(() => filterTools(TOOLS, filters), [filters])

  const timeWindow = useMemo(() => windowForPreset(timePreset), [timePreset])

  const timedLayers = useMemo(() => {
    return layers.map((layer) => {
      const merged = mergeHistory(layer.id, layer.points)
      return { ...layer, points: filterPointsByPlayhead(merged, timeWindow, playhead) }
    })
  }, [layers, timeWindow, playhead])

  const displayLayers = useMemo(() => {
    if (!aoi) return timedLayers
    return timedLayers.map((layer) => ({
      ...layer,
      points: layer.points.filter((p) => pointInAoi(p.lat, p.lng, aoi)),
    }))
  }, [timedLayers, aoi])

  const displayPoints = useMemo(
    () =>
      displayLayers.flatMap((layer) =>
        layer.enabled && (layer.status === 'live' || layer.status === 'stale') ? layer.points : [],
      ),
    [displayLayers],
  )

  const playbackStampTimes = useMemo(() => {
    const pts = timedLayers.flatMap((l) => (l.enabled ? l.points : []))
    return collectPlaybackTimes(pts, timeWindow)
  }, [timedLayers, timeWindow])

  const heatStatus = useMemo(() => classifyHeatStatus(heatEnabled, timedLayers), [heatEnabled, timedLayers])
  const heatNote = useMemo(() => heatStatusNote(heatStatus, heatCells.length), [heatStatus, heatCells.length])

  const statusCounts = useMemo(
    () =>
      countLayerStatuses(layers, [
        { enabled: heatEnabled, status: heatStatus },
        { enabled: tickerStatus !== 'off', status: tickerStatus },
        { enabled: briefPrefs.enabled, status: brief.status },
      ]),
    [layers, heatEnabled, heatStatus, tickerStatus, briefPrefs.enabled, brief.status],
  )

  useEffect(() => {
    if (!heatEnabled) {
      setHeatCells([])
      return
    }
    let cancelled = false
    void import('./heat/score').then(({ computeHeat, pointsFromLayers }) => {
      if (cancelled) return
      const cells = computeHeat(pointsFromLayers(timedLayers), {
        hotspots: HOTSPOTS.map((hs) => ({ id: hs.id, name: hs.name, lat: hs.lat, lng: hs.lng })),
      })
      setHeatCells(aoi ? cells.filter((c) => pointInAoi(c.lat, c.lng, aoi)) : cells)
    })
    return () => {
      cancelled = true
    }
  }, [heatEnabled, timedLayers, aoi])

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

  const reportMapView = useCallback((view: { lat: number; lng: number; zoom: number }) => {
    setMapView(view)
    sharePovRef.current = { lat: view.lat, lng: view.lng, z: view.zoom }
  }, [])

  const flyDuration = reducedMotion ? 0 : STAGE_AFTER_FLY_MS

  const openStage = useCallback((mode: StageMode) => {
    window.clearTimeout(stageTimerRef.current)
    if (mode !== 'globe') {
      restorePovRef.current = captureRestorePov(restorePovRef.current, globePovRef.current ?? flyTo)
    }
    setStage(mode)
  }, [flyTo])

  const goBack = useCallback(() => {
    window.clearTimeout(stageTimerRef.current)
    const pov = captureRestorePov(restorePovRef.current, globePovRef.current ?? flyTo)
    restorePovRef.current = null
    globePovRef.current = { ...pov }
    setActiveTheater(null)
    setStage('globe')
    setFlyTo({ ...pov })
  }, [flyTo])

  const cancelLocalityFly = useCallback(() => {
    window.clearTimeout(stageTimerRef.current)
    if (!restorePovRef.current) return
    const pov = captureRestorePov(restorePovRef.current, null)
    restorePovRef.current = null
    globePovRef.current = { ...pov }
    setFlyTo({ ...pov })
  }, [])

  const scheduleLocality = useCallback(
    (target: CameraPov, mode: StageMode, key: string) => {
      window.clearTimeout(stageTimerRef.current)
      // Snapshot before the fly. The zoomed camera must not become the restore POV.
      restorePovRef.current = captureRestorePov(restorePovRef.current, globePovRef.current ?? flyTo)
      setStage('globe')
      setFlyTo(target)
      sharePovRef.current = { lat: target.lat, lng: target.lng, z: altitudeToZoom(target.altitude) }
      stageTimerRef.current = window.setTimeout(() => {
        const sel = selectionRef.current
        const still =
          (sel?.kind === 'hotspot' && sel.hotspot.id === key) ||
          (sel?.kind === 'point' && sel.point.id === key) ||
          (sel?.kind === 'heat' && sel.cell.id === key)
        if (still) setStage(mode)
      }, flyDuration)
    },
    [flyTo, flyDuration],
  )

  const selectTool = useCallback(
    (tool: OsintTool | null) => {
      window.clearTimeout(stageTimerRef.current)
      if (!tool) {
        setSelection(null)
        return
      }
      setFavorites((prev) => recordRecent(prev, tool.id))
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
      const previousIds = pollIdsRef.current[def.id] ?? null
      const delta = diffEntityIds(previousIds, points.map((point) => point.id))
      pollIdsRef.current[def.id] = points.map((point) => point.id)
      setPollDeltas((prev) => ({
        ...prev,
        [def.id]: { layerId: def.id, label: def.label, at: updatedAt, delta },
      }))
      ingestHistory(def.id, points, updatedAt)
      persistHistory()
      if (def.id === 'opensky' || def.id === 'ais') {
        ingestTrackPoints(def.id, points, updatedAt)
        setTrails(trailsFromBuffer(updatedAt))
      }
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
      const current = layersRef.current.find((l) => l.id === id)
      if (!current) return
      if (current.enabled) {
        setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: false, status: 'off' } : l)))
        if (id === 'opensky' || id === 'ais') {
          clearTracksForLayer(id)
          setTrails(trailsFromBuffer())
        }
        return
      }
      void loadLayer(id)
    },
    [loadLayer],
  )

  const flyTheater = useCallback(
    (id: string) => {
      const theater = theaterById(id)
      if (!theater) return
      window.clearTimeout(stageTimerRef.current)
      restorePovRef.current = captureRestorePov(restorePovRef.current, globePovRef.current ?? flyTo)
      setActiveTheater(theater.id)
      setSelection(null)
      setStage('globe')
      setFlyTo({ ...theater.pov })
      sharePovRef.current = {
        lat: theater.pov.lat,
        lng: theater.pov.lng,
        z: altitudeToZoom(theater.pov.altitude),
      }
    },
    [flyTo],
  )

  const refreshLayers = useCallback(() => {
    for (const layer of layersRef.current) {
      if (layer.enabled) void loadLayer(layer.id)
    }
  }, [loadLayer])

  useEffect(() => {
    void restoreHistory()
    const specified = urlLayersRef.current
    if (specified?.length) {
      for (const id of specified) void loadLayer(id)
      return
    }
    for (const def of LAYER_DEFS) {
      if (def.defaultOn) void loadLayer(def.id)
    }
  }, [loadLayer])

  useEffect(() => {
    const timers = LAYER_DEFS.map((def) =>
      window.setInterval(() => {
        if (document.hidden) return
        const layer = layersRef.current.find((l) => l.id === def.id)
        if (layer?.enabled) void loadLayer(def.id)
      }, def.pollMs),
    )
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
      timers.forEach((id) => window.clearInterval(id))
      window.clearInterval(stale)
    }
  }, [loadLayer])

  useEffect(() => {
    if (selection?.kind !== 'point') return
    for (const layer of displayLayers) {
      const pt = layer.points.find((p) => p.id === selection.point.id)
      if (
        pt &&
        (pt.extra !== selection.point.extra ||
          pt.headline !== selection.point.headline ||
          pt.lat !== selection.point.lat ||
          pt.heading !== selection.point.heading ||
          pt.speedMs !== selection.point.speedMs ||
          pt.speedKt !== selection.point.speedKt ||
          pt.altitudeM !== selection.point.altitudeM)
      ) {
        setSelection({ kind: 'point', point: pt })
        return
      }
    }
  }, [displayLayers, selection])

  const loadTicker = useCallback(() => {
    if (document.hidden) return
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

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) loadTicker()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
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

  const requestRegion = useCallback(
    (origin: { lat: number; lng: number }, bounds?: MapBounds | null) => {
      const labels: Record<string, string> = {}
      for (const def of LAYER_DEFS) labels[def.id] = def.label
      setRegionSummary(
        summarizeRegion({
          points: displayPoints,
          origin,
          aoi,
          bounds: aoi ? null : bounds,
          layerLabels: labels,
        }),
      )
    },
    [displayPoints, aoi],
  )

  const closeRegion = useCallback(() => setRegionSummary(null), [])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => togglePinned(prev, id))
  }, [])

  const openTool = useCallback((tool: OsintTool) => {
    setFavorites((prev) => recordRecent(prev, tool.id))
    if (toolNeedsGuide(tool)) {
      setGuidedTool(tool)
      return
    }
    window.open(tool.url, '_blank', 'noopener,noreferrer')
  }, [])

  const cycleHudDensity = useCallback(() => {
    setHudDensity((prev) => cycleDensity(prev))
  }, [])

  const nextTour = useCallback(() => {
    setTourStep((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        saveTourCompleted(true)
        setTourOpen(false)
        return 0
      }
      return i + 1
    })
  }, [])

  const skipTour = useCallback(() => {
    saveTourCompleted(true)
    setTourOpen(false)
  }, [])

  const startTour = useCallback(() => {
    setTourStep(0)
    setTourOpen(true)
  }, [])

  const saveCurrentView = useCallback(
    (name: string) => {
      const pov = mapView ?? (globePovRef.current
        ? {
            lat: globePovRef.current.lat,
            lng: globePovRef.current.lng,
            zoom: altitudeToZoom(globePovRef.current.altitude),
          }
        : sharePovRef.current
          ? { lat: sharePovRef.current.lat, lng: sharePovRef.current.lng, zoom: sharePovRef.current.z }
          : { lat: 18, lng: 25, zoom: 2.2 })
      const view = createView({
        name,
        lat: pov.lat,
        lng: pov.lng,
        zoom: pov.zoom,
        altitude: globePovRef.current?.altitude,
        stage: stage === 'map' || stage === 'storm' ? 'map' : 'globe',
        layers: layers.filter((l) => l.enabled).map((l) => l.id),
        heatEnabled,
        mapStyle,
        nvg: overlay === 'nvg',
        aoi,
        overlay,
      })
      setViewStore((prev) => upsertView(prev, view))
    },
    [aoi, heatEnabled, layers, mapStyle, mapView, overlay, stage],
  )

  const loadView = useCallback(
    (id: string) => {
      const view = viewStore.views.find((v) => v.id === id)
      if (!view) return
      setMapStyleState(view.mapStyle)
      setOverlay(view.overlay ?? (view.nvg ? 'nvg' : 'off'))
      setMapNvgState(view.nvg)
      setHeatEnabled(view.heatEnabled)
      setAoi(view.aoi)
      setLayers((prev) =>
        prev.map((l) => {
          const on = view.layers.includes(l.id)
          if (on && !l.enabled) void loadLayer(l.id)
          if (!on && l.enabled) return { ...l, enabled: false, status: 'off' }
          return l
        }),
      )
      sharePovRef.current = { lat: view.lat, lng: view.lng, z: view.zoom }
      if (view.stage === 'map') {
        const point: GeoPoint = {
          id: `view-${view.id}`,
          lat: view.lat,
          lng: view.lng,
          label: view.name,
          kind: 'event',
          extra: 'Saved named view camera — not a live feed point.',
        }
        setSelection({ kind: 'point', point })
        scheduleLocality(
          { lat: view.lat, lng: view.lng, altitude: view.altitude ?? zoomToAltitude(view.zoom) },
          'map',
          point.id,
        )
      } else {
        setFlyTo({ lat: view.lat, lng: view.lng, altitude: view.altitude ?? zoomToAltitude(view.zoom) })
        setStage('globe')
      }
    },
    [loadLayer, scheduleLocality, viewStore.views],
  )

  const deleteView = useCallback((id: string) => {
    setViewStore((prev) => removeView(prev, id))
  }, [])

  const togglePlayback = useCallback(() => {
    setPlaybackPlaying((prev) => {
      if (prev) {
        setPlayhead(null)
        return false
      }
      if (playbackStampTimes.length < 2) return false
      setPlayhead(playbackStampTimes[0])
      return true
    })
  }, [playbackStampTimes])

  useEffect(() => {
    if (!playbackPlaying) return
    if (playbackStampTimes.length < 2) {
      setPlaybackPlaying(false)
      return
    }
    let i = 0
    const step = reducedMotion ? 1200 : 650
    const id = window.setInterval(() => {
      i += 1
      if (i >= playbackStampTimes.length) {
        setPlaybackPlaying(false)
        setPlayhead(null)
        return
      }
      setPlayhead(playbackStampTimes[i])
    }, step)
    return () => window.clearInterval(id)
  }, [playbackPlaying, playbackStampTimes, reducedMotion])

  const exportWorkspace = useCallback(() => {
    const backup = buildWorkspaceBackup({
      layout,
      feeds: feedPrefs,
      cases: caseStore,
      mapStyle: { version: 1, style: mapStyle, nvg: overlay === 'nvg' },
      heat: { version: 1, enabled: heatEnabled },
      views: viewStore,
      favorites,
      hud: { version: 1, density: hudDensity, overlay, legendOpen },
      brief: briefPrefs,
    })
    download(workspaceFilename(), `${JSON.stringify(backup, null, 2)}\n`)
  }, [
    layout,
    feedPrefs,
    caseStore,
    mapStyle,
    overlay,
    heatEnabled,
    viewStore,
    favorites,
    hudDensity,
    legendOpen,
    briefPrefs,
  ])

  const importWorkspace = useCallback((text: string) => {
    const parsed = parseWorkspaceBackup(text)
    if (!parsed.ok) return parsed
    const b = parsed.backup
    setLayoutState(b.layout)
    setFeedPrefsState(b.feeds)
    setCaseStoreState(b.cases)
    setMapStyleState(b.mapStyle.style)
    setMapNvgState(b.mapStyle.nvg)
    setHeatEnabled(b.heat.enabled)
    setViewStore(sanitizeViewStore(b.views))
    setFavorites(b.favorites)
    setHudDensity(b.hud.density)
    setOverlay(b.hud.overlay)
    setLegendOpen(b.hud.legendOpen)
    setBriefPrefsState(
      sanitizeBriefPrefs({
        ...b.brief,
        apiKey: briefPrefsRef.current.apiKey,
      }),
    )
    return { ok: true as const }
  }, [])

  useEffect(() => {
    const parsed = parseDeepLink(window.location.search)
    if (parsed.style) setMapStyleState(parsed.style)
    if (parsed.aoi) setAoi(parsed.aoi)
    if (parsed.layers?.length) {
      const wantHeat = parsed.layers.includes('heat')
      setHeatEnabled(wantHeat)
      urlLayersRef.current = parsed.layers.filter((id) => id !== 'heat')
      const wanted = new Set(urlLayersRef.current)
      setLayers((prev) =>
        prev.map((l) => {
          const on = wanted.has(l.id)
          return on ? { ...l, enabled: true, status: 'loading' } : { ...l, enabled: false, status: 'off' }
        }),
      )
    }
    if (parsed.lat != null && parsed.lon != null) {
      const altitude = parsed.z != null ? zoomToAltitude(parsed.z) : LOCALITY_ALTITUDE
      sharePovRef.current = { lat: parsed.lat, lng: parsed.lon, z: parsed.z ?? altitudeToZoom(altitude) }
      setFlyTo({ lat: parsed.lat, lng: parsed.lon, altitude })
      if (parsed.z != null && parsed.z >= 5) {
        const point: GeoPoint = {
          id: 'deeplink',
          lat: parsed.lat,
          lng: parsed.lon,
          label: `${parsed.lat.toFixed(2)}°, ${parsed.lon.toFixed(2)}°`,
          kind: 'event',
          extra: 'Opened from a shareable URL. Public feeds only — not a sitrep.',
        }
        setSelection({ kind: 'point', point })
        setStage('map')
      }
    }
    deepLinkReady.current = true
    // apply once from the landing URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!deepLinkReady.current) return
    const enabled = layers.filter((l) => l.enabled).map((l) => l.id)
    if (heatEnabled) enabled.push('heat')
    const share = sharePovRef.current
    const qs = writeDeepLink({
      lat: share?.lat,
      lon: share?.lng,
      z: share?.z,
      layers: enabled,
      style: mapStyle,
      aoi,
    })
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const cur = `${window.location.pathname}${window.location.search}`
    if (next !== cur) window.history.replaceState(null, '', next)
  }, [aoi, heatEnabled, layers, mapStyle, mapView, selection, stage])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (e.key === '/' && !typing) {
        e.preventDefault()
        focusSearch()
      }
      if (e.key === '?' && !typing) {
        e.preventDefault()
        setHelpOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        if (searchOpen) {
          e.preventDefault()
          setSearchOpen(false)
          return
        }
        if (guidedTool) {
          e.preventDefault()
          setGuidedTool(null)
          return
        }
        if (regionSummary) {
          e.preventDefault()
          setRegionSummary(null)
          return
        }
        if (tourOpen) {
          e.preventDefault()
          skipTour()
          return
        }
        if (signalGuideOpen) {
          e.preventDefault()
          setSignalGuideOpen(false)
          return
        }
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
        if (drawMode !== 'off') {
          e.preventDefault()
          setDrawMode('off')
          return
        }
        if (aoi) {
          e.preventDefault()
          setAoi(null)
          return
        }
        if (stage !== 'globe' || activeTheater) {
          e.preventDefault()
          e.stopPropagation()
          goBack()
          return
        }
        if (selection) {
          cancelLocalityFly()
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
      if ((e.key === 'b' || e.key === 'B') && (stage !== 'globe' || activeTheater)) {
        e.preventDefault()
        e.stopPropagation()
        goBack()
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setCasesDrawerOpen((v) => !v)
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        cycleHudDensity()
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === '1') togglePanel('left')
      if (e.key === '2') togglePanel('right')
      if (e.key === '3') togglePanel('top')
      if (e.key === '4') togglePanel('bottom')
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !signalGuideOpen && !helpOpen && !searchOpen && !tourOpen) {
        const shortcutLayer = layerIdForShortcut(e.key)
        if (shortcutLayer) {
          e.preventDefault()
          toggleLayer(shortcutLayer)
          return
        }
        if (e.key === 'g' || e.key === 'G') {
          e.preventDefault()
          setSignalGuideOpen(true)
          return
        }
      }
      if (e.key === '[') {
        e.preventDefault()
        cycleMapStyle(-1)
      }
      if (e.key === ']') {
        e.preventDefault()
        cycleMapStyle(1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    aoi,
    casesDrawerOpen,
    cancelLocalityFly,
    cycleHudDensity,
    cycleMapStyle,
    drawMode,
    filters.query,
    focusSearch,
    goBack,
    guidedTool,
    activeTheater,
    helpOpen,
    regionSummary,
    searchOpen,
    selection,
    signalGuideOpen,
    skipTour,
    stage,
    toggleLayer,
    togglePanel,
    tourOpen,
  ])

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
    displayLayers,
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
    mapStyle,
    setMapStyle,
    mapNvg: overlay === 'nvg' || mapNvg,
    setMapNvg,
    cycleMapStyle,
    trails,
    aoi,
    setAoi,
    drawMode,
    setDrawMode,
    timePreset,
    setTimePreset,
    playhead,
    setPlayhead,
    playbackPlaying,
    togglePlayback,
    playbackTimes: playbackStampTimes,
    views: viewStore.views,
    saveCurrentView,
    loadView,
    deleteView,
    searchOpen,
    setSearchOpen,
    regionSummary,
    requestRegion,
    closeRegion,
    favorites,
    toggleFavorite,
    guidedTool,
    setGuidedTool,
    openTool,
    hudDensity,
    cycleHudDensity,
    overlay,
    setOverlay,
    legendOpen,
    setLegendOpen,
    pollDeltas,
    activeTheater,
    flyTheater,
    signalGuideOpen,
    setSignalGuideOpen,
    tourOpen,
    tourStep,
    nextTour,
    skipTour,
    startTour,
    mapView,
    reportMapView,
    statusCounts,
    exportWorkspace,
    importWorkspace,
    reducedMotion,
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
        <SignalGuide />
        <CaseNotesDrawer />
        <SearchPalette />
        <GuidedOpenModal />
        <FirstRunTour />
      </div>
    </Provider>
  )
}
