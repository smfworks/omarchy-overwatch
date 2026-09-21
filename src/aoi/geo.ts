/** Area of interest drawn on the locality map. Never invented from a feed. */

export type AoiRect = {
  kind: 'rect'
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

export type AoiPoly = {
  kind: 'poly'
  /** Closed or open ring in [lng, lat] GeoJSON order. */
  ring: [number, number][]
}

export type Aoi = AoiRect | AoiPoly

export type MapBounds = {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

function finiteCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function sanitizeAoi(raw: unknown): Aoi | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (row.kind === 'rect') {
    const minLat = Number(row.minLat)
    const minLng = Number(row.minLng)
    const maxLat = Number(row.maxLat)
    const maxLng = Number(row.maxLng)
    if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) return null
    if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null
    if (maxLat < minLat || maxLng < minLng) return null
    const area = (maxLat - minLat) * (maxLng - minLng)
    if (area <= 0) return null
    return { kind: 'rect', minLat, minLng, maxLat, maxLng }
  }
  if (row.kind === 'poly' && Array.isArray(row.ring)) {
    const ring: [number, number][] = []
    for (const pt of row.ring) {
      if (!Array.isArray(pt) || pt.length < 2) continue
      const lng = Number(pt[0])
      const lat = Number(pt[1])
      if (!finiteCoord(lat, lng)) continue
      ring.push([lng, lat])
    }
    if (ring.length < 3) return null
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
    return { kind: 'poly', ring }
  }
  return null
}

export function aoiToRect(aoi: Aoi): AoiRect {
  if (aoi.kind === 'rect') return aoi
  let minLat = 90
  let maxLat = -90
  let minLng = 180
  let maxLng = -180
  for (const [lng, lat] of aoi.ring) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }
  return { kind: 'rect', minLat, minLng, maxLat, maxLng }
}

/** Ray-casting point-in-polygon. Ring is [lng, lat]. */
export function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInAoi(lat: number, lng: number, aoi: Aoi | null | undefined): boolean {
  if (!aoi) return true
  if (!finiteCoord(lat, lng)) return false
  if (aoi.kind === 'rect') {
    return lat >= aoi.minLat && lat <= aoi.maxLat && lng >= aoi.minLng && lng <= aoi.maxLng
  }
  return pointInRing(lng, lat, aoi.ring)
}

export function pointInBounds(lat: number, lng: number, bounds: MapBounds | null | undefined): boolean {
  if (!bounds) return true
  if (!finiteCoord(lat, lng)) return false
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
}

export function aoiToGeoJSON(aoi: Aoi): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] =
    aoi.kind === 'rect'
      ? [
          [aoi.minLng, aoi.minLat],
          [aoi.maxLng, aoi.minLat],
          [aoi.maxLng, aoi.maxLat],
          [aoi.minLng, aoi.maxLat],
          [aoi.minLng, aoi.minLat],
        ]
      : aoi.ring
  return {
    type: 'Feature',
    properties: { kind: aoi.kind },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

/** Compact query encoding: `rect:minLng,minLat,maxLng,maxLat` or `poly:lng,lat,...` */
export function encodeAoi(aoi: Aoi | null | undefined): string {
  if (!aoi) return ''
  if (aoi.kind === 'rect') {
    return `rect:${trimNum(aoi.minLng)},${trimNum(aoi.minLat)},${trimNum(aoi.maxLng)},${trimNum(aoi.maxLat)}`
  }
  const pts = aoi.ring
    .map(([lng, lat]) => `${trimNum(lng)},${trimNum(lat)}`)
    .join(',')
  return `poly:${pts}`
}

export function decodeAoi(raw: string | null | undefined): Aoi | null {
  if (!raw || typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.startsWith('rect:')) {
    const parts = t.slice(5).split(',').map(Number)
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
    return sanitizeAoi({
      kind: 'rect',
      minLng: Math.min(parts[0], parts[2]),
      minLat: Math.min(parts[1], parts[3]),
      maxLng: Math.max(parts[0], parts[2]),
      maxLat: Math.max(parts[1], parts[3]),
    })
  }
  if (t.startsWith('poly:')) {
    const nums = t.slice(5).split(',').map(Number)
    if (nums.length < 6 || nums.length % 2 !== 0 || nums.some((n) => !Number.isFinite(n))) return null
    const ring: [number, number][] = []
    for (let i = 0; i < nums.length; i += 2) ring.push([nums[i], nums[i + 1]])
    return sanitizeAoi({ kind: 'poly', ring })
  }
  return null
}

function trimNum(n: number): string {
  return String(Math.round(n * 1e5) / 1e5)
}
