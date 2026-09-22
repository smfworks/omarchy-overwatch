import { describe, expect, it, beforeEach } from 'vitest'
import type { GeoPoint } from '../globe/types'
import { historySize, ingestHistory, mergeHistory, resetHistory } from './history'

function quake(id: string, observedAt: string): GeoPoint {
  return {
    id,
    lat: 35,
    lng: -120,
    label: id,
    kind: 'quake',
    layerId: 'earthquakes',
    observedAt,
  }
}

describe('time history ring buffer', () => {
  beforeEach(() => resetHistory())

  it('keeps previously polled dated points when a later poll omits them', () => {
    ingestHistory('earthquakes', [quake('eq-1', '2026-09-21T10:00:00Z')], Date.parse('2026-09-21T11:00:00Z'))
    ingestHistory('earthquakes', [quake('eq-2', '2026-09-21T11:30:00Z')], Date.parse('2026-09-21T12:00:00Z'))
    const merged = mergeHistory(
      'earthquakes',
      [quake('eq-2', '2026-09-21T11:30:00Z')],
      Date.parse('2026-09-21T12:00:00Z'),
    )
    expect(merged.map((p) => p.id).sort()).toEqual(['eq-1', 'eq-2'])
  })

  it('does not ingest ADS-B snapshots as fabricated history', () => {
    ingestHistory('opensky', [
      { id: 'ac-1', lat: 1, lng: 2, label: 'ac', kind: 'aircraft', layerId: 'opensky' },
    ])
    expect(historySize()).toBe(0)
    expect(mergeHistory('opensky', [])).toEqual([])
  })
})
