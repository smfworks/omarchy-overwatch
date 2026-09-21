import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js'
import type { GeoPoint } from './types'

export interface TleRecord {
  name: string
  line1: string
  line2: string
  norad?: string
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number | undefined {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return (Math.atan2(y, x) * 180) / Math.PI + 360
}

function wrap360(n: number): number {
  const v = n % 360
  return v < 0 ? v + 360 : v
}

/** Parse CelesTrak 3-line TLE / 2-line groups. Drops malformed sets — never invents a satellite. */
export function parseTleCatalog(text: string, limit = 48): TleRecord[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
  const records: TleRecord[] = []
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]?.trim() ?? ''
    const b = lines[i + 1]?.trim() ?? ''
    const c = lines[i + 2]?.trim() ?? ''
    let name = ''
    let line1 = ''
    let line2 = ''
    if (a.startsWith('1 ') && b.startsWith('2 ')) {
      name = `NORAD ${a.slice(2, 7).trim()}`
      line1 = a
      line2 = b
      i += 1
    } else if (b.startsWith('1 ') && c.startsWith('2 ')) {
      name = a.trim() || `NORAD ${b.slice(2, 7).trim()}`
      line1 = b
      line2 = c
      i += 2
    } else {
      continue
    }
    if (line1.length < 60 || line2.length < 60) continue
    const norad = line1.slice(2, 7).trim()
    records.push({ name, line1, line2, norad: norad || undefined })
    if (records.length >= limit) break
  }
  return records
}

function geodeticAt(satrec: ReturnType<typeof twoline2satrec>, when: Date): { lat: number; lng: number; altKm: number } | null {
  try {
    const pv = propagate(satrec, when)
    const pos = pv.position
    if (!pos || typeof pos === 'boolean') return null
    const geo = eciToGeodetic(pos, gstime(when))
    const lat = degreesLat(geo.latitude)
    const lng = degreesLong(geo.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    const altKm = typeof geo.height === 'number' && Number.isFinite(geo.height) ? geo.height : 0
    return { lat, lng, altKm }
  } catch {
    return null
  }
}

export function propagateTleRecords(records: TleRecord[], epochMs = Date.now()): GeoPoint[] {
  const when = new Date(epochMs)
  const later = new Date(epochMs + 30_000)
  const points: GeoPoint[] = []
  for (const rec of records) {
    let satrec: ReturnType<typeof twoline2satrec>
    try {
      satrec = twoline2satrec(rec.line1, rec.line2)
    } catch {
      continue
    }
    if (satrec.error) continue
    const now = geodeticAt(satrec, when)
    if (!now) continue
    const next = geodeticAt(satrec, later)
    const rawHeading = next ? bearingDeg(now.lat, now.lng, next.lat, next.lng) : undefined
    const norad = rec.norad || rec.name
    const point: GeoPoint = {
      id: `sat-${norad}`,
      lat: now.lat,
      lng: now.lng,
      label: rec.name,
      kind: 'sat',
      altitudeM: now.altKm * 1000,
      extra: `CelesTrak TLE · sampled`,
      observedAt: when.toISOString(),
      sourceUrl: 'https://celestrak.org/NORAD/elements/',
    }
    if (rawHeading != null && Number.isFinite(rawHeading)) point.heading = wrap360(rawHeading)
    points.push(point)
  }
  return points
}
