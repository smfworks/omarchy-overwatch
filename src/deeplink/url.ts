import { decodeAoi, encodeAoi, type Aoi } from '../aoi/geo'
import { isMapStyleId, type MapStyleId } from '../maps/styles'

export const DEEP_LAYER_IDS = [
  'earthquakes',
  'eonet',
  'opensky',
  'nws',
  'ais',
  'firms',
  'gdacs',
  'celestrak',
  'nhc',
  'nifc',
  'reliefweb',
  'heat',
] as const

export type DeepLayerId = (typeof DEEP_LAYER_IDS)[number]

export interface DeepLinkState {
  lat?: number
  lon?: number
  z?: number
  layers?: string[]
  style?: MapStyleId
  aoi?: Aoi | null
}

function asFinite(n: unknown, min: number, max: number): number | undefined {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN
  if (!Number.isFinite(v) || v < min || v > max) return undefined
  return v
}

export function isDeepLayerId(id: string): id is DeepLayerId {
  return (DEEP_LAYER_IDS as readonly string[]).includes(id)
}

export function parseDeepLink(search: string): DeepLinkState {
  const q = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(q)
  const lat = asFinite(params.get('lat'), -90, 90)
  const lon = asFinite(params.get('lon') ?? params.get('lng'), -180, 180)
  const z = asFinite(params.get('z'), 0.2, 20)
  const styleRaw = params.get('style')
  const style = isMapStyleId(styleRaw) ? styleRaw : undefined
  const layersRaw = params.get('layers')
  const layers = layersRaw
    ? layersRaw
        .split(',')
        .map((s) => s.trim())
        .filter(isDeepLayerId)
    : undefined
  const aoi = decodeAoi(params.get('aoi'))
  const out: DeepLinkState = {}
  if (lat != null) out.lat = lat
  if (lon != null) out.lon = lon
  if (z != null) out.z = z
  if (layers?.length) out.layers = layers
  if (style) out.style = style
  if (aoi) out.aoi = aoi
  return out
}

export function writeDeepLink(state: DeepLinkState): string {
  const params = new URLSearchParams()
  if (state.lat != null && Number.isFinite(state.lat)) params.set('lat', trim(state.lat, 5))
  if (state.lon != null && Number.isFinite(state.lon)) params.set('lon', trim(state.lon, 5))
  if (state.z != null && Number.isFinite(state.z)) params.set('z', trim(state.z, 2))
  if (state.layers?.length) {
    const ids = state.layers.filter(isDeepLayerId)
    if (ids.length) params.set('layers', ids.join(','))
  }
  if (state.style && isMapStyleId(state.style)) params.set('style', state.style)
  const aoi = encodeAoi(state.aoi ?? null)
  if (aoi) params.set('aoi', aoi)
  return params.toString()
}

export function applyDeepLinkPath(pathname: string, search: string, hash = ''): string {
  const qs = search.replace(/^\?/, '')
  return qs ? `${pathname}?${qs}${hash}` : `${pathname}${hash}`
}

/** Globe altitude 2.4 ≈ world; 0.42 ≈ locality. Map zoom 2–12. */
export function altitudeToZoom(altitude: number): number {
  if (!Number.isFinite(altitude) || altitude <= 0) return 2
  const z = 12.4 - Math.log2(altitude * 8)
  return Math.min(12, Math.max(1.4, z))
}

export function zoomToAltitude(zoom: number): number {
  if (!Number.isFinite(zoom)) return 2.4
  const z = Math.min(12, Math.max(1.4, zoom))
  return Math.max(0.28, 2 ** (12.4 - z) / 8)
}

function trim(n: number, digits: number): string {
  return String(Math.round(n * 10 ** digits) / 10 ** digits)
}
