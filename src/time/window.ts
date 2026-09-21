import type { GeoPoint } from '../globe/types'

export const TIME_PRESETS = ['1h', '6h', '24h', 'all'] as const
export type TimePreset = (typeof TIME_PRESETS)[number]

export interface TimeWindow {
  preset: TimePreset
  /** Inclusive start, epoch ms. */
  start: number
  /** Inclusive end, epoch ms. */
  end: number
}

export const TIME_BEARING_LAYERS = [
  'earthquakes',
  'eonet',
  'nws',
  'firms',
  'gdacs',
  'nhc',
  'nifc',
  'reliefweb',
] as const

export function isTimeBearingLayer(id: string): boolean {
  return (TIME_BEARING_LAYERS as readonly string[]).includes(id)
}

export function windowForPreset(preset: TimePreset, now = Date.now(), customStart?: number): TimeWindow {
  if (preset === 'all') {
    return { preset, start: 0, end: now }
  }
  if (customStart != null && Number.isFinite(customStart) && customStart < now) {
    return { preset, start: customStart, end: now }
  }
  const hours = preset === '1h' ? 1 : preset === '6h' ? 6 : 24
  return { preset, start: now - hours * 60 * 60 * 1000, end: now }
}

export function parseObservedAt(value: string | number | undefined | null): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/**
 * Keep points whose observedAt falls in the window.
 * Points without a timestamp stay visible — we do not invent a time or drop live snapshots.
 */
export function filterPointsByWindow(points: GeoPoint[], window: TimeWindow): GeoPoint[] {
  return points.filter((p) => {
    const t = parseObservedAt(p.observedAt)
    if (t == null) return true
    return t >= window.start && t <= window.end
  })
}

export function playbackTimes(points: GeoPoint[], window: TimeWindow, bucketMs = 15 * 60 * 1000): number[] {
  const times = new Set<number>()
  for (const p of points) {
    const t = parseObservedAt(p.observedAt)
    if (t == null || t < window.start || t > window.end) continue
    times.add(Math.floor(t / bucketMs) * bucketMs)
  }
  return [...times].sort((a, b) => a - b)
}

/** Points whose observedAt is at or before the playhead (and in-window). Untimed points stay. */
export function filterPointsByPlayhead(points: GeoPoint[], window: TimeWindow, playhead: number | null): GeoPoint[] {
  const inWindow = filterPointsByWindow(points, window)
  if (playhead == null) return inWindow
  return inWindow.filter((p) => {
    const t = parseObservedAt(p.observedAt)
    if (t == null) return true
    return t <= playhead
  })
}
