import type { LayerStatus } from '../globe/types'

/** One public-feed point considered for attention binning. Never invented. */
export interface HeatPointInput {
  id: string
  lat: number
  lng: number
  label: string
  kind: string
  layerId: string
  layerLabel: string
  extra?: string
  observedAt?: string
}

export interface HeatHotspotInput {
  id: string
  name: string
  lat: number
  lng: number
}

export interface HeatContributor {
  layerId: string
  layerLabel: string
  count: number
}

export interface HeatEventRef {
  id: string
  layerId: string
  layerLabel: string
  label: string
  lat: number
  lng: number
  kind: string
  extra?: string
  observedAt?: string
}

export interface HeatCell {
  /** H3 index at HEAT_RES. */
  id: string
  res: number
  lat: number
  lng: number
  /** Closed GeoJSON ring [lng, lat][]. */
  ring: [number, number][]
  /** Distinct contributing live-layer ids. Primary score. */
  layerCount: number
  pointCount: number
  /** Distinct-layer count (alias of layerCount, documented as L). */
  score: number
  /** z of L vs mean L among attention cells; 0 when undefined. */
  z: number
  contributors: HeatContributor[]
  events: HeatEventRef[]
  /** Demo beacons in the same cell — geography only, not part of L. */
  hotspots: { id: string; name: string }[]
}

export interface HeatState {
  enabled: boolean
  status: LayerStatus
  cells: HeatCell[]
  error: string | null
}

export const HEAT_KEY = 'omarchy-overwatch.heat.v1'
export const HEAT_RES = 4
export const HEAT_MIN_LAYERS = 2
export const HEAT_EVENTS_CAP = 32
export const HEAT_GLOBE_CAP = 48
