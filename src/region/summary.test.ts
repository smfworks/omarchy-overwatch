import { describe, expect, it } from 'vitest'
import type { GeoPoint } from '../globe/types'
import { summarizeRegion } from './summary'

function pt(id: string, lat: number, lng: number, layerId: string): GeoPoint {
  return { id, lat, lng, label: id, kind: 'event', layerId }
}

describe('region dossier', () => {
  it('counts only currently loaded points in the AOI and marks empty as UNKNOWN', () => {
    const points = [
      pt('in', 26.6, 56.3, 'ais'),
      pt('out', 10, 10, 'ais'),
      pt('quake', 26.55, 56.2, 'earthquakes'),
    ]
    const summary = summarizeRegion({
      points,
      origin: { lat: 26.56, lng: 56.25 },
      aoi: { kind: 'rect', minLat: 26, minLng: 56, maxLat: 27, maxLng: 57 },
      layerLabels: { ais: 'AIS', earthquakes: 'USGS' },
    })
    expect(summary.unknown).toBe(false)
    expect(summary.pointCount).toBe(2)
    expect(summary.nearest[0].id).toBe('quake')
    expect(summary.scope).toBe('aoi')
  })

  it('returns UNKNOWN with zero counts when the view is empty — never a sitrep', () => {
    const summary = summarizeRegion({
      points: [],
      origin: { lat: 0, lng: 0 },
      bounds: { minLat: -1, minLng: -1, maxLat: 1, maxLng: 1 },
    })
    expect(summary.unknown).toBe(true)
    expect(summary.pointCount).toBe(0)
    expect(summary.nearest).toEqual([])
  })
})
