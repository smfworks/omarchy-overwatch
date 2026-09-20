import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { CatalogFilters } from '../catalog'
import type { OsintTool } from '../catalog/types'
import type { CaseStoreV1 } from '../cases/types'
import type { Hotspot } from '../data/hotspots'
import type { LayoutState, PanelId } from '../layout/storage'
import type { GeoPoint, LayerState } from '../globe/layers'
import type { FeedStatus, TickerItem } from '../feeds/rss'

export type Selection =
  | { kind: 'tool'; tool: OsintTool }
  | { kind: 'hotspot'; hotspot: Hotspot }
  | { kind: 'point'; point: GeoPoint }
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
  layers: LayerState[]
  toggleLayer: (id: string) => void
  refreshLayers: () => void
  ticker: TickerItem[]
  tickerStatus: FeedStatus
  tickerError: string | null
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  searchRef: RefObject<HTMLInputElement | null>
  focusSearch: () => void
  flyTo: { lat: number; lng: number; altitude: number } | null
  caseStore: CaseStoreV1
  setCaseStore: Dispatch<SetStateAction<CaseStoreV1>>
  casesDrawerOpen: boolean
  setCasesDrawerOpen: Dispatch<SetStateAction<boolean>>
  pinSelection: () => void
}

export const OverwatchContext = createContext<OverwatchState | null>(null)

export function useOverwatch(): OverwatchState {
  const ctx = useContext(OverwatchContext)
  if (!ctx) throw new Error('useOverwatch must be inside provider')
  return ctx
}
