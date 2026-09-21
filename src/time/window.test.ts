import { describe, expect, it } from 'vitest'
import type { GeoPoint } from '../globe/types'
import { filterPointsByPlayhead, filterPointsByWindow, parseObservedAt, windowForPreset } from './window'

function pt(id: string, observedAt?: string): GeoPoint {
  const p: GeoPoint = { id, lat: 1, lng: 2, label: id, kind: 'quake' }
  if (observedAt) p.observedAt = observedAt
  return p
}

describe('time window', () => {
  it('builds 1h / 6h / 24h windows from now without inventing history', () => {
    const now = Date.parse('2026-09-21T12:00:00Z')
    expect(windowForPreset('1h', now).start).toBe(now - 3_600_000)
    expect(windowForPreset('6h', now).end).toBe(now)
    expect(windowForPreset('24h', now).start).toBe(now - 86_400_000)
    expect(windowForPreset('all', now).start).toBe(0)
  })

  it('keeps untimed live snapshots and drops out-of-window dated points', () => {
    const now = Date.parse('2026-09-21T12:00:00Z')
    const window = windowForPreset('1h', now)
    const points = [
      pt('fresh', '2026-09-21T11:30:00Z'),
      pt('old', '2026-09-21T08:00:00Z'),
      pt('snapshot'),
    ]
    const kept = filterPointsByWindow(points, window)
    expect(kept.map((p) => p.id)).toEqual(['fresh', 'snapshot'])
    expect(parseObservedAt('not-a-date')).toBeNull()
  })

  it('playhead only reveals dated points already received at or before that instant', () => {
    const now = Date.parse('2026-09-21T12:00:00Z')
    const window = windowForPreset('6h', now)
    const points = [
      pt('a', '2026-09-21T07:00:00Z'),
      pt('b', '2026-09-21T10:00:00Z'),
      pt('live'),
    ]
    const head = Date.parse('2026-09-21T08:00:00Z')
    expect(filterPointsByPlayhead(points, window, head).map((p) => p.id)).toEqual(['a', 'live'])
  })
})
