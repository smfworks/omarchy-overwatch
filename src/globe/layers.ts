import { describeLayerHttpError, parseAisSnapshot, parseFirmsCsv, parseOpenSkyStates } from './parse'
import { attachGdacsPolygon, parseGdacsFeatureCollection, parseNhcCurrentStorms, parseNifcPerimeters, parseReliefWebDisasters } from './parse-geo'
import { parseTleCatalog, propagateTleRecords } from './sgp4'
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
      layerId: 'earthquakes',
    }
    if (f.properties?.time) {
      point.observedAt = new Date(f.properties.time).toISOString()
      point.extra = point.observedAt
    }
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
  description?: string
  link?: string
  categories?: { id?: string; title?: string }[]
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
    const cats = (ev.categories ?? [])
      .map((c) => c.title || c.id)
      .filter((c): c is string => Boolean(c))
    const point: GeoPoint = {
      id: `eonet-${ev.id ?? i}`,
      lat: pair[0],
      lng: pair[1],
      label: ev.title ?? 'EONET event',
      kind: 'event',
      layerId: 'eonet',
    }
    if (cats.length) {
      point.categories = cats
      point.eventType = cats[0]
    }
    if (typeof ev.description === 'string' && ev.description.trim()) point.detail = ev.description.trim()
    if (typeof ev.link === 'string' && ev.link.startsWith('http')) point.sourceUrl = ev.link
    const date = ev.geometry?.[ev.geometry.length - 1]?.date
    if (date) {
      point.observedAt = date
      point.extra = date
    }
    points.push(point)
  }
  return points
}

export async function fetchOpenSky(): Promise<GeoPoint[]> {
  const data = await fetchJson('/proxy/opensky/api/states/all', 15000, 'opensky')
  return parseOpenSkyStates(data).map((p) => ({ ...p, layerId: 'opensky' }))
}

interface NwsAlert {
  id?: string
  properties?: {
    event?: string
    headline?: string
    description?: string
    areaDesc?: string
    severity?: string
    urgency?: string
    sent?: string
    effective?: string
    expires?: string
  }
  geometry?: { type?: string; coordinates?: unknown }
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
    const props = f.properties
    const point: GeoPoint = {
      id: `nws-${f.id ?? i}`,
      lat: pair[0],
      lng: pair[1],
      label: props?.event ?? 'NWS alert',
      kind: 'alert',
      layerId: 'nws',
    }
    if (props?.event) point.eventType = props.event
    if (props?.headline) point.headline = props.headline
    if (props?.description) point.detail = props.description.slice(0, 1200)
    if (props?.severity) point.severity = props.severity
    if (props?.urgency) point.urgency = props.urgency
    if (props?.areaDesc) {
      point.areaDesc = props.areaDesc
      point.extra = props.areaDesc
    }
    const when = props?.effective || props?.sent
    if (when) point.observedAt = when
    const geom = f.geometry
    if (geom?.type && geom.coordinates != null) {
      point.geometry = { type: geom.type, coordinates: geom.coordinates }
    }
    points.push(point)
    if (points.length >= 60) break
  }
  return points
}

export async function fetchAis(): Promise<GeoPoint[]> {
  const data = await fetchJson('/proxy/ais/snapshot', 20000, 'ais')
  return parseAisSnapshot(data).map((p) => ({ ...p, layerId: 'ais' }))
}

const FIRMS_PUBLIC_CSV =
  '/proxy/firms/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv'

export async function fetchFirms(): Promise<GeoPoint[]> {
  const errors: string[] = []
  try {
    const csv = await fetchText(FIRMS_PUBLIC_CSV, 25000, 'firms')
    return parseFirmsCsv(csv).map((p) => ({ ...p, layerId: 'firms' }))
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'public FIRMS CSV failed')
  }
  try {
    const csv = await fetchText('/proxy/firms/api/active', 25000, 'firms')
    return parseFirmsCsv(csv).map((p) => ({ ...p, layerId: 'firms' }))
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'FIRMS MAP_KEY API failed')
  }
  throw new Error(errors.join(' · ') || 'FIRMS unavailable')
}

export async function fetchGdacs(): Promise<GeoPoint[]> {
  const data = await fetchJson(
    '/proxy/gdacs/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,DR,WF',
    15000,
    'gdacs',
  )
  const rows = parseGdacsFeatureCollection(data)
  const sample = rows.filter((r) => r.geometryUrl && (r.point.eventType === 'TC' || r.point.eventType === 'FL')).slice(0, 5)
  const attached = await Promise.all(
    sample.map(async (row) => {
      try {
        const gj = await fetchJson(row.geometryUrl!, 10000, 'gdacs')
        return attachGdacsPolygon(row.point, gj)
      } catch {
        return row.point
      }
    }),
  )
  const byId = new Map(attached.map((p) => [p.id, p]))
  return rows.map((r) => byId.get(r.point.id) ?? r.point).map((p) => ({ ...p, layerId: 'gdacs' }))
}

async function propagateTleCatalog(records: ReturnType<typeof parseTleCatalog>): Promise<GeoPoint[]> {
  const epochMs = Date.now()
  if (typeof Worker === 'undefined') return propagateTleRecords(records, epochMs)
  try {
    const worker = new Worker(new URL('./sgp4.worker.ts', import.meta.url), { type: 'module' })
    return await new Promise<GeoPoint[]>((resolve, reject) => {
      const t = setTimeout(() => {
        worker.terminate()
        resolve(propagateTleRecords(records, epochMs))
      }, 8000)
      worker.onmessage = (ev: MessageEvent<{ ok?: boolean; points?: GeoPoint[]; error?: string }>) => {
        clearTimeout(t)
        worker.terminate()
        if (ev.data?.ok && Array.isArray(ev.data.points)) resolve(ev.data.points)
        else reject(new Error(ev.data?.error || 'SGP4 worker failed'))
      }
      worker.onerror = () => {
        clearTimeout(t)
        worker.terminate()
        resolve(propagateTleRecords(records, epochMs))
      }
      worker.postMessage({ records, epochMs })
    })
  } catch {
    return propagateTleRecords(records, epochMs)
  }
}

export async function fetchCelestrak(): Promise<GeoPoint[]> {
  const stations = await fetchText('/proxy/celestrak/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', 15000, 'celestrak')
  let visual = ''
  try {
    visual = await fetchText('/proxy/celestrak/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle', 15000, 'celestrak')
  } catch {
    /* stations-only sample is still honest */
  }
  const records = [...parseTleCatalog(stations, 24), ...parseTleCatalog(visual, 36)]
  if (!records.length) throw new Error('CelesTrak returned no TLEs — no satellite positions were invented.')
  const points = await propagateTleCatalog(records)
  return points.map((p) => ({ ...p, layerId: 'celestrak' }))
}

export async function fetchNhc(): Promise<GeoPoint[]> {
  const data = await fetchJson('/proxy/nhc/CurrentStorms.json', 12000, 'nhc')
  return parseNhcCurrentStorms(data).map((p) => ({ ...p, layerId: 'nhc' }))
}

const NIFC_QUERY =
  '/proxy/nifc/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,poly_IncidentName,poly_GISAcres,poly_DateCurrent&orderByFields=poly_GISAcres%20DESC&resultRecordCount=24&f=geojson&outSR=4326'

const NIFC_QUERY_PLAIN =
  '/proxy/nifc/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,poly_IncidentName,poly_GISAcres,poly_DateCurrent&resultRecordCount=24&f=geojson&outSR=4326'

export async function fetchNifc(): Promise<GeoPoint[]> {
  try {
    const data = await fetchJson(NIFC_QUERY, 20000, 'nifc')
    const points = parseNifcPerimeters(data)
    if (points.length) return points.map((p) => ({ ...p, layerId: 'nifc' }))
  } catch {
    /* retry without orderBy */
  }
  const data = await fetchJson(NIFC_QUERY_PLAIN, 20000, 'nifc')
  return parseNifcPerimeters(data).map((p) => ({ ...p, layerId: 'nifc' }))
}

export async function fetchReliefWeb(): Promise<GeoPoint[]> {
  const data = await fetchJson(
    '/proxy/rwapi/v1/disasters?appname=omarchy-overwatch&profile=full&limit=40&sort%5B%5D=date%3Adesc',
    15000,
    'reliefweb',
  )
  const points = parseReliefWebDisasters(data)
  return points.map((p) => ({ ...p, layerId: 'reliefweb' }))
}
