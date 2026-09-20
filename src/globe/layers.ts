import { describeLayerHttpError, parseAisSnapshot, parseFirmsCsv, parseOpenSkyStates } from './parse'
import type { GeoPoint, LayerState, LayerStatus } from './types'

export type { GeoPoint, LayerState, LayerStatus } from './types'

const STALE_MS = 15 * 60 * 1000

export function classifyStatus(state: Pick<LayerState, 'enabled' | 'updatedAt' | 'error' | 'points'>): LayerStatus {
  if (!state.enabled) return 'off'
  if (state.error && !state.updatedAt) return 'err'
  if (state.error && state.updatedAt) return 'stale'
  if (state.updatedAt && Date.now() - state.updatedAt > STALE_MS) return 'stale'
  if (state.updatedAt) return 'live'
  return 'loading'
}

async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('json')) {
      const body = (await res.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) return body.error.trim()
    } else {
      const text = (await res.text()).trim()
      if (text) return text.slice(0, 220)
    }
  } catch {
    return undefined
  }
  return undefined
}

export async function fetchJson(url: string, timeoutMs = 12000, layer?: string): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      const detail = await readErrorDetail(res)
      throw new Error(describeLayerHttpError(res.status, layer, detail))
    }
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function fetchText(url: string, timeoutMs = 20000, layer?: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      const detail = await readErrorDetail(res)
      throw new Error(describeLayerHttpError(res.status, layer, detail))
    }
    return await res.text()
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

export async function fetchOpenSky(): Promise<GeoPoint[]> {
  const data = await fetchJson('/proxy/opensky/api/states/all', 15000, 'opensky')
  return parseOpenSkyStates(data)
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

export async function fetchAis(): Promise<GeoPoint[]> {
  const data = await fetchJson('/proxy/ais/snapshot', 20000, 'ais')
  return parseAisSnapshot(data)
}

const FIRMS_PUBLIC_CSV =
  '/proxy/firms/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv'

export async function fetchFirms(): Promise<GeoPoint[]> {
  const errors: string[] = []
  try {
    const csv = await fetchText(FIRMS_PUBLIC_CSV, 25000, 'firms')
    return parseFirmsCsv(csv)
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'public FIRMS CSV failed')
  }
  try {
    const csv = await fetchText('/proxy/firms/api/active', 25000, 'firms')
    return parseFirmsCsv(csv)
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'FIRMS MAP_KEY API failed')
  }
  throw new Error(errors.join(' · ') || 'FIRMS unavailable')
}

export const LAYER_DEFS = [
  {
    id: 'earthquakes',
    label: 'USGS',
    note: 'USGS earthquakes M2.5+ past 24h via earthquake.usgs.gov (no key).',
    fetch: fetchEarthquakes,
  },
  {
    id: 'eonet',
    label: 'EONET',
    note: 'NASA EONET open natural events (fires, storms, volcanoes).',
    fetch: fetchEonet,
  },
  {
    id: 'opensky',
    label: 'ADS-B',
    note: 'OpenSky sampled aircraft states. Optional OPENSKY_CLIENT_ID/SECRET (OAuth2) or OPENSKY_USERNAME/PASSWORD (legacy). Rate-limited; 401/429 are ERR, not fake tracks.',
    fetch: fetchOpenSky,
  },
  {
    id: 'nws',
    label: 'NWS',
    note: 'api.weather.gov active alerts. US-only, no key.',
    fetch: fetchNwsAlerts,
  },
  {
    id: 'ais',
    label: 'AIS',
    note: 'AISStream maritime snapshot. Requires AISSTREAM_API_KEY in .env. Sampled live positions only — never invented.',
    fetch: fetchAis,
  },
  {
    id: 'firms',
    label: 'FIRMS',
    note: 'NASA FIRMS VIIRS detections (public 24h CSV, or FIRMS_MAP_KEY API). Sampled by FRP; no invented fires.',
    fetch: fetchFirms,
  },
] as const
