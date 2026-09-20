export type LayerStatus = 'off' | 'loading' | 'live' | 'stale' | 'err'

/** GeoJSON geometry as returned by a public feed. Never invented. */
export interface FeedGeometry {
  type: string
  coordinates: unknown
}

export interface GeoPoint {
  id: string
  lat: number
  lng: number
  label: string
  mag?: number
  kind: 'quake' | 'event' | 'aircraft' | 'alert' | 'vessel' | 'fire'
  extra?: string
  /** Layer id that produced this point (`earthquakes`, `nws`, …). */
  layerId?: string
  /** NWS event name or EONET category id when the feed provided one. */
  eventType?: string
  headline?: string
  detail?: string
  severity?: string
  urgency?: string
  categories?: string[]
  geometry?: FeedGeometry
  sourceUrl?: string
  observedAt?: string
  areaDesc?: string
}

export interface LayerState {
  id: string
  label: string
  enabled: boolean
  status: LayerStatus
  updatedAt: number | null
  error: string | null
  points: GeoPoint[]
  note: string
}
