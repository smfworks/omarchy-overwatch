import { describe, expect, it } from 'vitest'
import { latLngToCell } from 'h3-js'
import { HEAT_RES } from './types'
import { computeHeat, pointsFromLayers } from './score'
import type { LayerState } from '../globe/types'

function pt(
  id: string,
  layerId: string,
  layerLabel: string,
  lat: number,
  lng: number,
  extra?: Partial<{ kind: string; label: string; extra: string; observedAt: string }>,
) {
  return {
    id,
    lat,
    lng,
    label: extra?.label ?? id,
    kind: extra?.kind ?? 'event',
    layerId,
    layerLabel,
    extra: extra?.extra,
    observedAt: extra?.observedAt,
  }
}

describe('heat binning', () => {
  it('emits a cell only when two independent layers share an H3 res-4 hex', () => {
    const lat = 34.05
    const lng = -118.25
    const cells = computeHeat([
      pt('eq-1', 'earthquakes', 'USGS', lat, lng, { kind: 'quake', label: 'M4.1 Los Angeles' }),
      pt('fire-1', 'firms', 'FIRMS', lat, lng, { kind: 'fire', label: 'VIIRS detection' }),
    ])
    expect(cells).toHaveLength(1)
    expect(cells[0].id).toBe(latLngToCell(lat, lng, HEAT_RES))
    expect(cells[0].layerCount).toBe(2)
    expect(cells[0].score).toBe(2)
    expect(cells[0].pointCount).toBe(2)
    expect(cells[0].contributors.map((c) => c.layerId).sort()).toEqual(['earthquakes', 'firms'])
    expect(cells[0].events.map((e) => e.id).sort()).toEqual(['eq-1', 'fire-1'])
    expect(cells[0].z).toBe(0)
  })

  it('does not create heat from a single layer even with many points', () => {
    const cells = computeHeat([
      pt('eq-1', 'earthquakes', 'USGS', 10, 10),
      pt('eq-2', 'earthquakes', 'USGS', 10.01, 10.01),
      pt('eq-3', 'earthquakes', 'USGS', 10.02, 10.02),
    ])
    expect(cells).toEqual([])
  })

  it('keeps distant points in separate cells and skips invalid coordinates', () => {
    const cells = computeHeat([
      pt('a', 'earthquakes', 'USGS', 0, 0),
      pt('b', 'eonet', 'EONET', 0, 0),
      pt('c', 'earthquakes', 'USGS', 40, 40),
      pt('d', 'eonet', 'EONET', 40, 40),
      pt('bad', 'nws', 'NWS', 999, 0),
      pt('bad2', 'ais', 'AIS', 0, 999),
    ])
    expect(cells).toHaveLength(2)
    const ids = new Set(cells.map((c) => c.id))
    expect(ids.size).toBe(2)
    expect(cells.every((c) => c.layerCount === 2)).toBe(true)
  })

  it('lists demo hotspots in-cell without counting them toward L', () => {
    const cells = computeHeat(
      [pt('eq-1', 'earthquakes', 'USGS', 50.4501, 30.5234), pt('ev-1', 'eonet', 'EONET', 50.4501, 30.5234)],
      { hotspots: [{ id: 'kyiv', name: 'Kyiv', lat: 50.4501, lng: 30.5234 }] },
    )
    expect(cells).toHaveLength(1)
    expect(cells[0].layerCount).toBe(2)
    expect(cells[0].hotspots).toEqual([{ id: 'kyiv', name: 'Kyiv' }])
  })

  it('computes a transparent population z of L among attention cells', () => {
    const cells = computeHeat([
      pt('a1', 'earthquakes', 'USGS', 0, 0),
      pt('a2', 'eonet', 'EONET', 0, 0),
      pt('b1', 'earthquakes', 'USGS', 40, 40),
      pt('b2', 'eonet', 'EONET', 40, 40),
      pt('c1', 'earthquakes', 'USGS', -30, 150),
      pt('c2', 'eonet', 'EONET', -30, 150),
      pt('c3', 'nws', 'NWS', -30, 150),
      pt('c4', 'firms', 'FIRMS', -30, 150),
    ])
    expect(cells).toHaveLength(3)
    const four = cells.find((c) => c.layerCount === 4)
    const twos = cells.filter((c) => c.layerCount === 2)
    expect(four).toBeTruthy()
    expect(twos).toHaveLength(2)
    expect(four!.z).toBeGreaterThan(0)
    expect(twos[0].z).toBeLessThan(0)
    expect(twos[0].z).toBeCloseTo(twos[1].z, 8)
    const mean = (2 + 2 + 4) / 3
    const sigma = Math.sqrt(((2 - mean) ** 2 + (2 - mean) ** 2 + (4 - mean) ** 2) / 3)
    expect(four!.z).toBeCloseTo((4 - mean) / sigma, 8)
  })

  it('caps listed events and never invents ids', () => {
    const points = [
      pt('eq-1', 'earthquakes', 'USGS', 1, 2, { label: 'real quake' }),
      pt('ev-1', 'eonet', 'EONET', 1, 2, { label: 'real event' }),
      ...Array.from({ length: 40 }, (_, i) => pt(`nws-${i}`, 'nws', 'NWS', 1, 2)),
    ]
    const cells = computeHeat(points, { eventsCap: 10 })
    expect(cells[0].events).toHaveLength(10)
    expect(cells[0].pointCount).toBe(42)
    expect(cells[0].events.every((e) => points.some((p) => p.id === e.id))).toBe(true)
  })
})

describe('pointsFromLayers', () => {
  it('uses live/stale/loading leftovers and skips off/err', () => {
    const layers: LayerState[] = [
      {
        id: 'earthquakes',
        label: 'USGS',
        enabled: true,
        status: 'live',
        updatedAt: 1,
        error: null,
        points: [{ id: 'eq-1', lat: 1, lng: 2, label: 'q', kind: 'quake' }],
        note: '',
      },
      {
        id: 'eonet',
        label: 'EONET',
        enabled: true,
        status: 'stale',
        updatedAt: 1,
        error: 'timeout',
        points: [{ id: 'ev-1', lat: 1, lng: 2, label: 'e', kind: 'event' }],
        note: '',
      },
      {
        id: 'nws',
        label: 'NWS',
        enabled: true,
        status: 'err',
        updatedAt: null,
        error: 'HTTP 500',
        points: [{ id: 'ghost', lat: 1, lng: 2, label: 'nope', kind: 'alert' }],
        note: '',
      },
      {
        id: 'ais',
        label: 'AIS',
        enabled: false,
        status: 'off',
        updatedAt: null,
        error: null,
        points: [{ id: 'ship', lat: 1, lng: 2, label: 'nope', kind: 'vessel' }],
        note: '',
      },
    ]
    const pts = pointsFromLayers(layers)
    expect(pts.map((p) => p.id).sort()).toEqual(['eq-1', 'ev-1'])
  })
})
