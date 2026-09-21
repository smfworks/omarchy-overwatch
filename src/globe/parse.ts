import type { GeoPoint } from './types'

export function describeLayerHttpError(status: number, layer?: string, detail?: string): string {
  const hint = detail?.trim()
  if (layer === 'opensky' && status === 401) {
    return (
      hint ||
      'HTTP 401 unauthorized — OpenSky rejected this client. Anonymous access is often blocked. Set OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET (OAuth2) or OPENSKY_USERNAME / OPENSKY_PASSWORD (legacy Basic Auth, often rejected).'
    )
  }
  if (layer === 'opensky' && status === 403) {
    return hint || 'HTTP 403 forbidden — OpenSky denied this request.'
  }
  if (layer === 'opensky' && status === 429) {
    return hint || 'HTTP 429 rate limited — OpenSky quota exhausted. Wait, or authenticate to raise limits. No aircraft were invented.'
  }
  if (layer === 'ais' && (status === 401 || status === 403)) {
    return (
      hint ||
      'HTTP 401 — AISSTREAM_API_KEY is not set or was rejected. Get a free key at https://aisstream.io. Overwatch will not invent vessel positions.'
    )
  }
  if (layer === 'firms' && (status === 401 || status === 403)) {
    return (
      hint ||
      'HTTP 401 — FIRMS public CSV blocked and FIRMS_MAP_KEY is missing or invalid. Request a key at https://firms.modaps.eosdis.nasa.gov/api/map_key/'
    )
  }
  if (status === 401) return hint || `HTTP 401 unauthorized`
  if (status === 403) return hint || `HTTP 403 forbidden`
  if (status === 429) return hint || `HTTP 429 rate limited`
  return hint ? `HTTP ${status} — ${hint}` : `HTTP ${status}`
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** Degrees 0–360 when the feed sent a real heading/course; drops AIS 511 / 360 sentinels. */
export function asHeadingDeg(value: unknown): number | null {
  const n = asFiniteNumber(value)
  if (n === null) return null
  if (n < 0 || n > 360) return null
  if (n === 511 || n === 360) return null
  return n
}

function asLabel(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const t = value.trim()
    if (t) return t
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function parseOpenSkyStates(
  data: unknown,
  opts: { stride?: number; limit?: number } = {},
): GeoPoint[] {
  const stride = opts.stride ?? 18
  const limit = opts.limit ?? 90
  if (!data || typeof data !== 'object') return []
  const states = (data as { states?: unknown }).states
  if (!Array.isArray(states)) return []
  const sampled = states.filter((_, i) => i % stride === 0)
  const points: GeoPoint[] = []
  for (const [i, row] of sampled.entries()) {
    if (!Array.isArray(row)) continue
    const lon = asFiniteNumber(row[5])
    const lat = asFiniteNumber(row[6])
    if (lat === null || lon === null) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue
    const callsign = typeof row[1] === 'string' ? row[1].trim() : ''
    const icao = typeof row[0] === 'string' ? row[0].trim() : ''
    const point: GeoPoint = {
      id: `ac-${icao || i}`,
      lat,
      lng: lon,
      label: callsign || icao || 'aircraft',
      kind: 'aircraft',
    }
    if (typeof row[2] === 'string' && row[2].trim()) point.extra = row[2].trim()
    const heading = asHeadingDeg(row[10])
    if (heading !== null) point.heading = heading
    const speedMs = asFiniteNumber(row[9])
    if (speedMs !== null && speedMs >= 0) point.speedMs = speedMs
    const alt = asFiniteNumber(row[7]) ?? asFiniteNumber(row[13])
    if (alt !== null) point.altitudeM = alt
    if (typeof row[8] === 'boolean') point.onGround = row[8]
    const ts = asFiniteNumber(row[4]) ?? asFiniteNumber(row[3])
    if (ts !== null && ts > 1_000_000_000) point.observedAt = new Date(ts * 1000).toISOString()
    points.push(point)
    if (points.length >= limit) break
  }
  return points
}

export interface AisVesselRecord {
  mmsi?: string
  name?: string
  lat: number
  lng: number
  extra?: string
  heading?: number
  course?: number
  speedKt?: number
}

export function extractAisVessel(message: unknown): AisVesselRecord | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as {
    error?: unknown
    MessageType?: unknown
    MetaData?: Record<string, unknown>
    Metadata?: Record<string, unknown>
    Message?: Record<string, Record<string, unknown>>
  }
  if (typeof msg.error === 'string' && msg.error.trim()) return null
  const meta = (msg.MetaData ?? msg.Metadata ?? {}) as Record<string, unknown>
  const type = typeof msg.MessageType === 'string' ? msg.MessageType : ''
  const body = type && msg.Message ? msg.Message[type] : undefined
  const lat = asFiniteNumber(meta.Latitude ?? meta.latitude ?? body?.Latitude ?? body?.latitude)
  const lng = asFiniteNumber(meta.Longitude ?? meta.longitude ?? body?.Longitude ?? body?.longitude)
  if (lat === null || lng === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const mmsi = asLabel(meta.MMSI ?? meta.mmsi ?? body?.UserID ?? body?.UserId, '')
  const name = asLabel(meta.ShipName ?? meta.shipName ?? meta.Ship_Name, '')
  const extra = [type || undefined, mmsi ? `MMSI ${mmsi}` : undefined].filter(Boolean).join(' · ')
  const heading = asHeadingDeg(body?.TrueHeading ?? body?.trueHeading ?? body?.Heading ?? meta.TrueHeading)
  const course = asHeadingDeg(body?.Cog ?? body?.COG ?? body?.Course ?? meta.Cog)
  const speedKt = asFiniteNumber(body?.Sog ?? body?.SOG ?? body?.Speed ?? meta.Sog)
  return {
    mmsi: mmsi || undefined,
    name: name || undefined,
    lat,
    lng,
    extra: extra || undefined,
    heading: heading ?? course ?? undefined,
    course: course ?? undefined,
    speedKt: speedKt !== null && speedKt >= 0 && speedKt < 102.3 ? speedKt : undefined,
  }
}

export function parseAisSnapshot(data: unknown, limit = 80): GeoPoint[] {
  if (!data || typeof data !== 'object') return []
  const root = data as { vessels?: unknown; messages?: unknown; error?: unknown }
  if (typeof root.error === 'string' && root.error.trim() && !root.vessels && !root.messages) {
    return []
  }
  const records: AisVesselRecord[] = []
  if (Array.isArray(root.vessels)) {
    for (const row of root.vessels) {
      if (!row || typeof row !== 'object') continue
      const v = row as Record<string, unknown>
      const lat = asFiniteNumber(v.lat)
      const lng = asFiniteNumber(v.lng)
      if (lat === null || lng === null) continue
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
      const heading = asHeadingDeg(v.heading)
      const course = asHeadingDeg(v.course)
      const speedKt = asFiniteNumber(v.speedKt)
      records.push({
        mmsi: typeof v.mmsi === 'string' ? v.mmsi : undefined,
        name: typeof v.name === 'string' ? v.name.trim() : undefined,
        lat,
        lng,
        extra: typeof v.extra === 'string' ? v.extra : undefined,
        heading: heading ?? undefined,
        course: course ?? undefined,
        speedKt: speedKt !== null && speedKt >= 0 ? speedKt : undefined,
      })
    }
  } else if (Array.isArray(root.messages)) {
    for (const message of root.messages) {
      const vessel = extractAisVessel(message)
      if (vessel) records.push(vessel)
    }
  }
  const seen = new Set<string>()
  const points: GeoPoint[] = []
  for (const rec of records) {
    const key = rec.mmsi || `${rec.lat.toFixed(4)},${rec.lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    const point: GeoPoint = {
      id: `ais-${rec.mmsi || `${rec.lat.toFixed(3)}-${rec.lng.toFixed(3)}`}`,
      lat: rec.lat,
      lng: rec.lng,
      label: rec.name || (rec.mmsi ? `MMSI ${rec.mmsi}` : 'vessel'),
      kind: 'vessel',
      extra: rec.extra,
    }
    if (rec.heading != null) point.heading = rec.heading
    if (rec.course != null) point.course = rec.course
    if (rec.speedKt != null) point.speedKt = rec.speedKt
    points.push(point)
    if (points.length >= limit) break
  }
  return points
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(',')
    const row: Record<string, string> = {}
    header.forEach((key, idx) => {
      row[key] = (cols[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

export function parseFirmsCsv(text: string, limit = 80): GeoPoint[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (/invalid map[_ ]?key/i.test(trimmed)) {
    throw new Error('FIRMS rejected MAP_KEY')
  }
  if (/^\s*</.test(trimmed)) {
    throw new Error('FIRMS returned HTML instead of CSV')
  }
  const headerLine = trimmed.split(/\r?\n/, 1)[0]?.toLowerCase() ?? ''
  if (!headerLine.includes('latitude') || !headerLine.includes('longitude')) {
    throw new Error('FIRMS CSV missing latitude/longitude columns')
  }
  const rows = parseCsvRows(trimmed)
  const scored: { frp: number; point: GeoPoint }[] = []
  rows.forEach((row, i) => {
    const lat = asFiniteNumber(row.latitude)
    const lng = asFiniteNumber(row.longitude)
    if (lat === null || lng === null) return
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    const frp = asFiniteNumber(row.frp) ?? 0
    const sat = row.satellite || row.instrument || 'VIIRS'
    const conf = row.confidence || ''
    const when = [row.acq_date, row.acq_time].filter(Boolean).join(' ')
    const extra = [sat, conf ? `conf ${conf}` : undefined, frp ? `FRP ${frp}` : undefined, when || undefined]
      .filter(Boolean)
      .join(' · ')
    scored.push({
      frp,
      point: {
        id: `fire-${row.acq_date || 'd'}-${row.acq_time || i}-${lat.toFixed(3)}-${lng.toFixed(3)}`,
        lat,
        lng,
        label: `Fire ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
        kind: 'fire',
        extra: extra || undefined,
      },
    })
  })
  scored.sort((a, b) => b.frp - a.frp)
  const seen = new Set<string>()
  const points: GeoPoint[] = []
  for (const item of scored) {
    const key = `${item.point.lat.toFixed(3)},${item.point.lng.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    points.push(item.point)
    if (points.length >= limit) break
  }
  return points
}
