import { asFiniteNumber, asHeadingDeg } from './parse'
import type { FeedGeometry, GeoPoint } from './types'

export function centroidOfGeometry(geom: unknown): [number, number] | null {
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
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return [lat, lon]
}

export function polygonFromBbox(bbox: unknown): FeedGeometry | null {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const minLon = asFiniteNumber(bbox[0])
  const minLat = asFiniteNumber(bbox[1])
  const maxLon = asFiniteNumber(bbox[2])
  const maxLat = asFiniteNumber(bbox[3])
  if (minLon === null || minLat === null || maxLon === null || maxLat === null) return null
  if (maxLon - minLon < 0.05 && maxLat - minLat < 0.05) return null
  if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return null
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

function asHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t.startsWith('http://') || t.startsWith('https://') ? t : undefined
}

function firstPolygon(geojson: unknown): FeedGeometry | null {
  if (!geojson || typeof geojson !== 'object') return null
  const root = geojson as { type?: string; coordinates?: unknown; features?: unknown }
  if (root.type === 'Polygon' || root.type === 'MultiPolygon') {
    if (root.coordinates != null) return { type: root.type, coordinates: root.coordinates }
  }
  if (!Array.isArray(root.features)) return null
  for (const feat of root.features) {
    if (!feat || typeof feat !== 'object') continue
    const g = (feat as { geometry?: { type?: string; coordinates?: unknown } }).geometry
    if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') {
      if (g.coordinates != null) return { type: g.type, coordinates: g.coordinates }
    }
  }
  return null
}

export function rewriteGdacsProxyUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'www.gdacs.org' || u.hostname === 'gdacs.org') {
      return `/proxy/gdacs${u.pathname}${u.search}`
    }
  } catch {
    /* keep original — fetch will ERR honestly */
  }
  return url
}

export function parseGdacsFeatureCollection(
  data: unknown,
  limit = 60,
): { point: GeoPoint; geometryUrl?: string }[] {
  if (!data || typeof data !== 'object') return []
  const features = (data as { features?: unknown }).features
  if (!Array.isArray(features)) return []
  const rows: { point: GeoPoint; geometryUrl?: string }[] = []
  for (const [i, raw] of features.entries()) {
    if (!raw || typeof raw !== 'object') continue
    const feat = raw as {
      geometry?: unknown
      bbox?: unknown
      properties?: Record<string, unknown>
    }
    const pair = centroidOfGeometry(feat.geometry)
    if (!pair) continue
    const props = feat.properties ?? {}
    const eventtype = typeof props.eventtype === 'string' ? props.eventtype : ''
    const eventid = props.eventid != null ? String(props.eventid) : String(i)
    const name = typeof props.name === 'string' && props.name.trim() ? props.name.trim() : 'GDACS event'
    const alert = typeof props.alertlevel === 'string' ? props.alertlevel : ''
    const urls = props.url && typeof props.url === 'object' ? (props.url as Record<string, unknown>) : {}
    const point: GeoPoint = {
      id: `gdacs-${eventtype || 'ev'}-${eventid}`,
      lat: pair[0],
      lng: pair[1],
      label: alert ? `${alert} ${name}` : name,
      kind: 'hazard',
      eventType: eventtype || undefined,
      severity: alert || undefined,
      detail: typeof props.description === 'string' ? props.description.slice(0, 1200) : undefined,
      observedAt: typeof props.fromdate === 'string' ? props.fromdate : undefined,
      extra: [eventtype, alert ? `alert ${alert}` : undefined].filter(Boolean).join(' · ') || undefined,
    }
    const report = asHttpUrl(urls.report)
    if (report) point.sourceUrl = report
    const geom = polygonFromBbox(feat.bbox)
    if (geom) point.geometry = geom
    let geometryUrl: string | undefined
    if (typeof urls.geometry === 'string' && urls.geometry.startsWith('http')) {
      geometryUrl = rewriteGdacsProxyUrl(urls.geometry)
    }
    rows.push({ point, geometryUrl })
    if (rows.length >= limit) break
  }
  return rows
}

export function attachGdacsPolygon(point: GeoPoint, geojson: unknown): GeoPoint {
  const poly = firstPolygon(geojson)
  if (!poly) return point
  return { ...point, geometry: poly }
}

const NHC_CLASS: Record<string, string> = {
  HU: 'Hurricane',
  TS: 'Tropical Storm',
  TD: 'Tropical Depression',
  STS: 'Severe Tropical Storm',
  TY: 'Typhoon',
  TC: 'Tropical Cyclone',
  PT: 'Potential Tropical Cyclone',
  STD: 'Subtropical Depression',
  SS: 'Subtropical Storm',
}

export function parseNhcCurrentStorms(data: unknown, limit = 12): GeoPoint[] {
  if (!data || typeof data !== 'object') return []
  const storms = (data as { activeStorms?: unknown }).activeStorms
  if (!Array.isArray(storms)) return []
  const points: GeoPoint[] = []
  for (const [i, raw] of storms.entries()) {
    if (!raw || typeof raw !== 'object') continue
    const s = raw as Record<string, unknown>
    const lat = asFiniteNumber(s.latitudeNumeric)
    const lng = asFiniteNumber(s.longitudeNumeric)
    if (lat === null || lng === null) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `storm-${i}`
    const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'NHC storm'
    const cls = typeof s.classification === 'string' ? s.classification.trim() : ''
    const eventType = NHC_CLASS[cls] || (cls ? cls : 'Tropical cyclone')
    const advisory =
      s.publicAdvisory && typeof s.publicAdvisory === 'object'
        ? (s.publicAdvisory as { url?: unknown }).url
        : undefined
    const point: GeoPoint = {
      id: `nhc-${id}`,
      lat,
      lng,
      label: `${cls ? `${cls} ` : ''}${name}`.trim(),
      kind: 'alert',
      eventType,
      observedAt: typeof s.lastUpdate === 'string' ? s.lastUpdate : undefined,
      sourceUrl: asHttpUrl(advisory) ?? 'https://www.nhc.noaa.gov/',
    }
    const heading = asHeadingDeg(s.movementDir)
    if (heading !== null) {
      point.heading = heading
      point.course = heading
    }
    const speedKt = asFiniteNumber(s.movementSpeed)
    if (speedKt !== null && speedKt >= 0) point.speedKt = speedKt
    const intensity = asFiniteNumber(s.intensity)
    const pressure = asFiniteNumber(s.pressure)
    point.extra = [
      eventType,
      intensity !== null ? `${intensity} kt` : undefined,
      pressure !== null ? `${pressure} mb` : undefined,
    ]
      .filter(Boolean)
      .join(' · ')
    points.push(point)
    if (points.length >= limit) break
  }
  return points
}

export function parseNifcPerimeters(data: unknown, limit = 24): GeoPoint[] {
  if (!data || typeof data !== 'object') return []
  const features = (data as { features?: unknown }).features
  if (!Array.isArray(features)) return []
  const scored: { acres: number; point: GeoPoint }[] = []
  features.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return
    const feat = raw as { geometry?: unknown; properties?: Record<string, unknown> }
    const pair = centroidOfGeometry(feat.geometry)
    if (!pair) return
    const props = feat.properties ?? {}
    const name =
      (typeof props.poly_IncidentName === 'string' && props.poly_IncidentName.trim()) ||
      (typeof props.IncidentName === 'string' && props.IncidentName.trim()) ||
      'NIFC incident'
    const acres =
      asFiniteNumber(props.poly_GISAcres) ?? asFiniteNumber(props.GISAcres) ?? asFiniteNumber(props.attr_IncidentSize) ?? 0
    const g = feat.geometry as { type?: string; coordinates?: unknown } | undefined
    const point: GeoPoint = {
      id: `nifc-${props.OBJECTID ?? i}-${pair[0].toFixed(3)}-${pair[1].toFixed(3)}`,
      lat: pair[0],
      lng: pair[1],
      label: name,
      kind: 'fire',
      extra: acres ? `${Math.round(acres)} acres (NIFC perimeter)` : 'NIFC perimeter',
      observedAt: typeof props.poly_DateCurrent === 'string' ? props.poly_DateCurrent : undefined,
      sourceUrl: 'https://data-nifc.opendata.arcgis.com/',
    }
    if (g?.type && (g.type === 'Polygon' || g.type === 'MultiPolygon') && g.coordinates != null) {
      point.geometry = { type: g.type, coordinates: g.coordinates }
    }
    scored.push({ acres, point })
  })
  scored.sort((a, b) => b.acres - a.acres)
  return scored.slice(0, limit).map((s) => s.point)
}

function reliefLocation(fields: Record<string, unknown>): [number, number] | null {
  const primary = fields.primary_country
  const fromPrimary =
    primary && typeof primary === 'object'
      ? (primary as { location?: { lat?: unknown; lon?: unknown } }).location
      : undefined
  const lat = asFiniteNumber(fromPrimary?.lat)
  const lon = asFiniteNumber(fromPrimary?.lon)
  if (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    return [lat, lon]
  }
  const countries = fields.country
  if (!Array.isArray(countries)) return null
  for (const c of countries) {
    if (!c || typeof c !== 'object') continue
    const loc = (c as { location?: { lat?: unknown; lon?: unknown } }).location
    const clat = asFiniteNumber(loc?.lat)
    const clon = asFiniteNumber(loc?.lon)
    if (clat !== null && clon !== null && clat >= -90 && clat <= 90 && clon >= -180 && clon <= 180) {
      return [clat, clon]
    }
  }
  return null
}

export function parseReliefWebDisasters(data: unknown, limit = 40): GeoPoint[] {
  if (!data || typeof data !== 'object') return []
  const rows = (data as { data?: unknown }).data
  if (!Array.isArray(rows)) return []
  const points: GeoPoint[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as { id?: unknown; fields?: Record<string, unknown> }
    const fields = row.fields ?? {}
    const pair = reliefLocation(fields)
    if (!pair) continue
    const name = typeof fields.name === 'string' && fields.name.trim() ? fields.name.trim() : 'ReliefWeb disaster'
    const types = Array.isArray(fields.type)
      ? fields.type
          .map((t) => (t && typeof t === 'object' ? (t as { name?: unknown }).name : t))
          .filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
      : []
    const date =
      fields.date && typeof fields.date === 'object'
        ? (fields.date as { created?: unknown; event?: unknown }).created ??
          (fields.date as { event?: unknown }).event
        : undefined
    const url = asHttpUrl(fields.url) ?? asHttpUrl(fields['url_alias'])
    const point: GeoPoint = {
      id: `rw-${row.id ?? `${pair[0].toFixed(2)}-${pair[1].toFixed(2)}`}`,
      lat: pair[0],
      lng: pair[1],
      label: name,
      kind: 'event',
      eventType: types[0],
      categories: types.length ? types : undefined,
      sourceUrl: url,
      observedAt: typeof date === 'string' ? date : undefined,
      extra: types.join(' · ') || undefined,
      detail: typeof fields.status === 'string' ? `status ${fields.status}` : undefined,
    }
    points.push(point)
    if (points.length >= limit) break
  }
  return points
}
