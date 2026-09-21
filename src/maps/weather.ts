import type { GeoPoint } from '../globe/types'

/**
 * NWS event / EONET category strings that count as dangerous weather.
 * Matching is honest: only labels the feed actually sent.
 */
const DANGEROUS_PATTERNS = [
  /hurricane/,
  /typhoon/,
  /tropical\s+(storm|cyclone|depression)/,
  /tornado/,
  /blizzard/,
  /winter\s+storm/,
  /ice\s+storm/,
  /severe\s+thunderstorm/,
  /flash\s+flood/,
  /storm\s+surge/,
  /extreme\s+wind/,
]

const EONET_SEVERE = new Set(['severestorms', 'severe storms', 'severe-storms'])

function haystack(point: Pick<GeoPoint, 'kind' | 'eventType' | 'label' | 'headline' | 'categories'>): string {
  return [point.eventType, point.label, point.headline, ...(point.categories ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function isDangerousWeather(
  point: Pick<GeoPoint, 'kind' | 'eventType' | 'label' | 'headline' | 'categories'>,
): boolean {
  if (point.kind !== 'alert' && point.kind !== 'event' && point.kind !== 'hazard') return false
  const text = haystack(point)
  if (DANGEROUS_PATTERNS.some((re) => re.test(text))) return true
  const cats = (point.categories ?? []).map((c) => c.toLowerCase().replace(/[_-]+/g, ' ').trim())
  if (cats.some((c) => EONET_SEVERE.has(c.replace(/\s+/g, '')) || EONET_SEVERE.has(c))) return true
  return false
}

export function weatherKindLabel(point: GeoPoint): string {
  return point.eventType || point.label || 'weather event'
}
