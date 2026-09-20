export type LayerStatus = 'off' | 'loading' | 'live' | 'stale' | 'err'

export interface GeoPoint {
  id: string
  lat: number
  lng: number
  label: string
  mag?: number
  kind: 'quake' | 'event' | 'aircraft' | 'alert' | 'vessel' | 'fire'
  extra?: string
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
