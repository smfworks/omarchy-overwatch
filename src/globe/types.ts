export type LayerStatus = 'off' | 'loading' | 'live' | 'stale' | 'err'

/** GeoJSON geometry as returned by a public feed. Never invented. */
export interface FeedGeometry {
  type: string
  coordinates: unknown
}

export type GeoKind =
  | 'quake'
  | 'event'
  | 'aircraft'
  | 'alert'
  | 'vessel'
  | 'fire'
  | 'sat'
  | 'hazard'

export interface GeoPoint {
  id: string
  lat: number
  lng: number
  label: string
  mag?: number
  kind: GeoKind
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
  /** True heading / track, degrees clockwise from north, when the feed sent it. */
  heading?: number
  /** Course over ground (deg) when distinct from heading. */
  course?: number
  /** Speed in m/s when the feed sent SI units (OpenSky velocity). */
  speedMs?: number
  /** Speed in knots when the feed sent nautical units (AIS SOG, NHC movement). */
  speedKt?: number
  /** Barometric / geometric altitude in meters when present. */
  altitudeM?: number
  onGround?: boolean
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

export interface LayerDef {
  id: string
  label: string
  note: string
  /** Poll interval while the toggle is on. */
  pollMs: number
  defaultOn?: boolean
  /** Matching catalog tool id when one exists. */
  catalogId?: string
  fetch: () => Promise<GeoPoint[]>
}
