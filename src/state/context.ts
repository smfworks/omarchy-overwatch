import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { CatalogFilters } from '../catalog'
import type { OsintTool } from '../catalog/types'
import type { CaseStoreV1 } from '../cases/types'
import type { Hotspot } from '../data/hotspots'
import type { FeedPrefsV1 } from '../feeds/storage'
import type { FeedRuntime, FeedStatus, TickerItem } from '../feeds/rss'
import type { LayoutState, PanelId } from '../layout/storage'
import type { GeoPoint, LayerState, LayerStatus } from '../globe/layers'
import type { TrackTrail } from '../globe/tracks'
import type { HeatCell } from '../heat/types'
import type { BriefPrefsV1, BriefResult } from '../brief/types'
import type { MapStyleId } from '../maps/styles'

export type StageMode = 'globe' | 'map' | 'storm' | 'depth' | 'brief'

export type CameraPov = { lat: number; lng: number; altitude: number }

export type Selection =
  | { kind: 'tool'; tool: OsintTool }
  | { kind: 'hotspot'; hotspot: Hotspot }
  | { kind: 'point'; point: GeoPoint }
  | { kind: 'ticker'; item: TickerItem }
  | { kind: 'heat'; cell: HeatCell }
  | null

export interface OverwatchState {
  layout: LayoutState
  setLayout: (next: LayoutState | ((prev: LayoutState) => LayoutState)) => void
  togglePanel: (id: PanelId) => void
  filters: CatalogFilters
  setFilters: (next: CatalogFilters | ((prev: CatalogFilters) => CatalogFilters)) => void
  visibleTools: OsintTool[]
  selection: Selection
  selectTool: (tool: OsintTool | null) => void
  selectHotspot: (hotspot: Hotspot | null) => void
  selectPoint: (point: GeoPoint | null) => void
  selectTicker: (item: TickerItem | null) => void
  selectHeat: (cell: HeatCell | null) => void
  layers: LayerState[]
  toggleLayer: (id: string) => void
  refreshLayers: () => void
  heatEnabled: boolean
  toggleHeat: () => void
  heatStatus: LayerStatus
  heatCells: HeatCell[]
  heatNote: string
  ticker: TickerItem[]
  tickerStatus: FeedStatus
  tickerError: string | null
  tickerFeeds: FeedRuntime[]
  feedPrefs: FeedPrefsV1
  setFeedPrefs: Dispatch<SetStateAction<FeedPrefsV1>>
  refreshTicker: () => void
  briefPrefs: BriefPrefsV1
  setBriefPrefs: Dispatch<SetStateAction<BriefPrefsV1>>
  brief: BriefResult
  runBrief: () => void
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  searchRef: RefObject<HTMLInputElement | null>
  focusSearch: () => void
  flyTo: CameraPov | null
  stage: StageMode
  openStage: (mode: StageMode) => void
  goBack: () => void
  reportGlobePov: (pov: CameraPov) => void
  caseStore: CaseStoreV1
  setCaseStore: Dispatch<SetStateAction<CaseStoreV1>>
  casesDrawerOpen: boolean
  setCasesDrawerOpen: Dispatch<SetStateAction<boolean>>
  pinSelection: () => void
  mapStyle: MapStyleId
  setMapStyle: (id: MapStyleId) => void
  mapNvg: boolean
  setMapNvg: (on: boolean) => void
  cycleMapStyle: (dir: 1 | -1) => void
  trails: TrackTrail[]
}

export const OverwatchContext = createContext<OverwatchState | null>(null)

export function useOverwatch(): OverwatchState {
  const ctx = useContext(OverwatchContext)
  if (!ctx) throw new Error('useOverwatch must be inside provider')
  return ctx
}
