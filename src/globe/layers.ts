export type LayerStatus = 'off' | 'loading' | 'live' | 'stale' | 'err'

export interface GeoPoint {
  id: string
  lat: number
  lng: number
  label: string
  mag?: number
  kind: 'quake' | 'event' | 'aircraft' | 'alert'
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

const STALE_MS = 15 * 60 * 1000

export function classifyStatus(state: Pick<LayerState, 'enabled' | 'updatedAt' | 'error' | 'points'>): LayerStatus {
  if (!state.enabled) return 'off'
  if (state.error && !state.updatedAt) return 'err'
  if (state.error && state.updatedAt) return 'stale'
  if (state.updatedAt && Date.now() - state.updatedAt > STALE_MS) return 'stale'
  if (state.updatedAt) return 'live'
  return 'loading'
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

interface UsgsFeature {
  id?: string
  properties?: { mag?: number; place?: string; time?: number }
  geometry?: { coordinates?: number[] }
}

export async function fetchEarthquakes(): Promise<GeoPoint[]> {
  const data = (await fetchJson(
    '/proxy/usgs/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  )) as { features?: UsgsFeature[] }
  const points: GeoPoint[] = []
  for (const [i, f] of (data.features ?? []).entries()) {
    const coords = f.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    const mag = f.properties?.mag
    const point: GeoPoint = {
      id: `eq-${f.id ?? i}`,
      lat: coords[1],
      lng: coords[0],
      mag,
      label: `M${mag?.toFixed(1) ?? '?'} ${f.properties?.place ?? 'earthquake'}`,
      kind: 'quake',
    }
    if (f.properties?.time) point.extra = new Date(f.properties.time).toISOString()
    points.push(point)
    if (points.length >= 80) break
  }
  return points
}

interface EonetGeometry {
  coordinates?: unknown
  date?: string
}

interface EonetEvent {
  id?: string
  title?: string
  geometry?: EonetGeometry[]
}

function lastCoords(geometry: EonetGeometry[] | undefined): [number, number] | null {
  const g = geometry?.[geometry.length - 1]
  const c = g?.coordinates
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
    return [c[1], c[0]]
  }
  if (Array.isArray(c) && Array.isArray(c[0]) && typeof c[0][0] === 'number') {
    return [c[0][1] as number, c[0][0] as number]
  }
  return null
}

export async function fetchEonet(): Promise<GeoPoint[]> {
  const data = (await fetchJson('/proxy/eonet/api/v3/events?limit=40&status=open')) as {
    events?: EonetEvent[]
  }
  const points: GeoPoint[] = []
  for (const [i, ev] of (data.events ?? []).entries()) {
    const pair = lastCoords(ev.geometry)
    if (!pair) continue
    const point: GeoPoint = {
      id: `eonet-${ev.id ?? i}`,
      lat: pair[0],
      lng: pair[1],
      label: ev.title ?? 'EONET event',
      kind: 'event',
    }
    const date = ev.geometry?.[ev.geometry.length - 1]?.date
    if (date) point.extra = date
    points.push(point)
  }
  return points
}

type OpenSkyState = unknown[]

export async function fetchOpenSky(): Promise<GeoPoint[]> {
  const data = (await fetchJson('/proxy/opensky/api/states/all')) as { states?: OpenSkyState[] }
  const states = data.states ?? []
  const sampled = states.filter((_, i) => i % 18 === 0).slice(0, 90)
  const points: GeoPoint[] = []
  sampled.forEach((row, i) => {
    const lon = row[5]
    const lat = row[6]
    const callsign = typeof row[1] === 'string' ? row[1].trim() : ''
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    const point: GeoPoint = {
      id: `ac-${typeof row[0] === 'string' ? row[0] : i}`,
      lat,
      lng: lon,
      label: callsign || 'aircraft',
      kind: 'aircraft',
    }
    if (typeof row[2] === 'string') point.extra = row[2]
    points.push(point)
  })
  return points
}

interface NwsAlert {
  id?: string
  properties?: {
    event?: string
    headline?: string
    areaDesc?: string
  }
  geometry?: { coordinates?: unknown }
}

function centroid(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== 'object') return null
  const g = geom as { type?: string; coordinates?: unknown }
  const walk = (c: unknown): number[][] => {
    if (!Array.isArray(c)) return []
    if (typeof c[0] === 'number' && typeof c[1] === 'number') return [[c[0], c[1]]]
    return c.flatMap(walk)
  }
  const pts = walk(g.coordinates)
  if (!pts.length) return null
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return [lat, lon]
}

export async function fetchNwsAlerts(): Promise<GeoPoint[]> {
  const data = (await fetchJson('/proxy/nws/alerts/active?status=actual&limit=50')) as {
    features?: NwsAlert[]
  }
  const points: GeoPoint[] = []
  for (const [i, f] of (data.features ?? []).entries()) {
    const pair = centroid(f.geometry)
    if (!pair) continue
    const point: GeoPoint = {
      id: `nws-${f.id ?? i}`,
      lat: pair[0],
      lng: pair[1],
      label: f.properties?.event ?? 'NWS alert',
      kind: 'alert',
    }
    if (f.properties?.areaDesc) point.extra = f.properties.areaDesc
    points.push(point)
    if (points.length >= 60) break
  }
  return points
}

export const LAYER_DEFS = [
  {
    id: 'earthquakes',
    label: 'USGS earthquakes',
    note: 'M2.5+ past 24h via earthquake.usgs.gov (no key).',
    fetch: fetchEarthquakes,
  },
  {
    id: 'eonet',
    label: 'NASA EONET',
    note: 'Open natural events (fires, storms, volcanoes).',
    fetch: fetchEonet,
  },
  {
    id: 'opensky',
    label: 'OpenSky ADS-B',
    note: 'Sampled public aircraft states. Rate-limited; may ERR without auth.',
    fetch: fetchOpenSky,
  },
  {
    id: 'nws',
    label: 'NWS alerts (US)',
    note: 'api.weather.gov active alerts. US-only, no key.',
    fetch: fetchNwsAlerts,
  },
] as const
