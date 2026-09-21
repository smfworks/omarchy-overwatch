import { describe, expect, it, beforeEach } from 'vitest'
import {
  TRACK_MAX_IDS,
  TRACK_MAX_SAMPLES,
  clearTracksForLayer,
  ingestTrackPoints,
  resetTracks,
  splitAntimeridian,
  trackBufferSize,
  trailsFromBuffer,
} from './tracks'
import type { GeoPoint } from './types'

function ac(id: string, lat: number, lng: number, heading?: number): GeoPoint {
  const p: GeoPoint = { id, lat, lng, label: id, kind: 'aircraft' }
  if (heading != null) p.heading = heading
  return p
}

describe('track ring buffer', () => {
  beforeEach(() => resetTracks())

  it('builds a polyline only from successive real samples', () => {
    ingestTrackPoints('opensky', [ac('ac-1', 10, 20, 90)], 1_000)
    expect(trailsFromBuffer(1_000)).toEqual([])
    ingestTrackPoints('opensky', [ac('ac-1', 10.2, 20.1, 91)], 2_000)
    const trails = trailsFromBuffer(2_000)
    expect(trails).toHaveLength(1)
    expect(trails[0].coords).toEqual([
      [10, 20],
      [10.2, 20.1],
    ])
    expect(trails[0].id).toBe('ac-1')
  })

  it('caps samples per id and ids overall', () => {
    for (let i = 0; i < TRACK_MAX_SAMPLES + 6; i++) {
      ingestTrackPoints('opensky', [ac('ac-cap', 1 + i * 0.01, 2)], 1_000 + i * 60_000)
    }
    const trail = trailsFromBuffer(1_000 + TRACK_MAX_SAMPLES * 60_000)[0]
    expect(trail.coords.length).toBeLessThanOrEqual(TRACK_MAX_SAMPLES)

    for (let i = 0; i < TRACK_MAX_IDS + 40; i++) {
      ingestTrackPoints('opensky', [ac(`ac-x-${i}`, 3, 4 + i * 0.01)], 50_000_000 + i)
    }
    expect(trackBufferSize()).toBeLessThanOrEqual(TRACK_MAX_IDS)
  })

  it('clears a layer without inventing leftover tracks', () => {
    ingestTrackPoints('opensky', [ac('ac-1', 1, 2)], 1)
    ingestTrackPoints('opensky', [ac('ac-1', 1.2, 2.1)], 2)
    ingestTrackPoints('ais', [{ id: 'ais-9', lat: 5, lng: 6, label: 'ship', kind: 'vessel' }], 2)
    ingestTrackPoints('ais', [{ id: 'ais-9', lat: 5.1, lng: 6.1, label: 'ship', kind: 'vessel' }], 3)
    clearTracksForLayer('opensky')
    const trails = trailsFromBuffer(3)
    expect(trails.every((t) => t.id.startsWith('ais-'))).toBe(true)
  })

  it('splits antimeridian jumps instead of drawing a fake world-spanning line', () => {
    const parts = splitAntimeridian([
      [0, 179],
      [0, 179.4],
      [0, -179.5],
      [0, -179],
    ])
    expect(parts).toHaveLength(2)
    expect(parts[0]).toEqual([
      [0, 179],
      [0, 179.4],
    ])
    expect(parts[1]).toEqual([
      [0, -179.5],
      [0, -179],
    ])
  })
})
