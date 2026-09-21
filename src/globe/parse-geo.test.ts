import { describe, expect, it } from 'vitest'
import {
  attachGdacsPolygon,
  parseGdacsFeatureCollection,
  parseNhcCurrentStorms,
  parseNifcPerimeters,
  parseReliefWebDisasters,
  polygonFromBbox,
} from './parse-geo'

describe('GDACS parser', () => {
  it('keeps feed points and bbox envelopes, skips invalid coords', () => {
    const rows = parseGdacsFeatureCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          bbox: [10, 20, 12, 22],
          geometry: { type: 'Point', coordinates: [11, 21] },
          properties: {
            eventtype: 'FL',
            eventid: 1,
            name: 'Flood in Example',
            alertlevel: 'Orange',
            description: 'feed text',
            fromdate: '2026-01-01T00:00:00',
            url: { report: 'https://www.gdacs.org/report.aspx?eventid=1', geometry: 'https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=FL&eventid=1' },
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [999, 0] },
          properties: { eventid: 2, name: 'bad' },
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].point).toMatchObject({
      id: 'gdacs-FL-1',
      kind: 'hazard',
      lat: 21,
      lng: 11,
      severity: 'Orange',
    })
    expect(rows[0].point.geometry?.type).toBe('Polygon')
    expect(rows[0].geometryUrl).toBe(
      '/proxy/gdacs/gdacsapi/api/polygons/getgeometry?eventtype=FL&eventid=1',
    )
  })

  it('attaches a real polygon from getgeometry and ignores point-only collections', () => {
    const base = {
      id: 'gdacs-FL-1',
      lat: 21,
      lng: 11,
      label: 'Flood',
      kind: 'hazard' as const,
    }
    const withPoly = attachGdacsPolygon(base, {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [11, 21] } },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [10, 20],
                [12, 20],
                [12, 22],
                [10, 22],
                [10, 20],
              ],
            ],
          },
        },
      ],
    })
    expect(withPoly.geometry?.type).toBe('Polygon')
    expect(attachGdacsPolygon(base, { type: 'FeatureCollection', features: [] }).geometry).toBeUndefined()
  })

  it('does not invent a bbox polygon from a degenerate envelope', () => {
    expect(polygonFromBbox([11, 21, 11, 21])).toBeNull()
    expect(parseGdacsFeatureCollection(null)).toEqual([])
  })
})

describe('NHC parser', () => {
  it('maps CurrentStorms.json without inventing a cone', () => {
    const points = parseNhcCurrentStorms({
      activeStorms: [
        {
          id: 'al062026',
          name: 'Fay',
          classification: 'TS',
          intensity: '55',
          pressure: '999',
          latitudeNumeric: 34.4,
          longitudeNumeric: -32.7,
          movementDir: 20,
          movementSpeed: 6,
          lastUpdate: '2026-09-20T21:00:00.000Z',
          publicAdvisory: { url: 'https://www.nhc.noaa.gov/text/MIATCPAT1.shtml' },
        },
        { id: 'bad', name: 'Nope', latitudeNumeric: 99, longitudeNumeric: 0 },
      ],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({
      id: 'nhc-al062026',
      kind: 'alert',
      eventType: 'Tropical Storm',
      lat: 34.4,
      lng: -32.7,
      heading: 20,
      speedKt: 6,
    })
    expect(points[0].geometry).toBeUndefined()
  })

  it('returns empty when no storms — honest off-season', () => {
    expect(parseNhcCurrentStorms({ activeStorms: [] })).toEqual([])
    expect(parseNhcCurrentStorms({})).toEqual([])
  })
})

describe('NIFC parser', () => {
  it('centroids a perimeter polygon from the feed', () => {
    const points = parseNifcPerimeters({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { OBJECTID: 9, poly_IncidentName: 'Example Fire', poly_GISAcres: 1200 },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-120, 40],
                [-119, 40],
                [-119, 41],
                [-120, 41],
                [-120, 40],
              ],
            ],
          },
        },
      ],
    })
    expect(points).toHaveLength(1)
    expect(points[0].kind).toBe('fire')
    expect(points[0].label).toBe('Example Fire')
    expect(points[0].geometry?.type).toBe('Polygon')
    expect(points[0].lat).toBeCloseTo(40.4, 5)
    expect(points[0].lng).toBeCloseTo(-119.6, 5)
  })
})

describe('ReliefWeb parser', () => {
  it('uses primary_country location when present', () => {
    const points = parseReliefWebDisasters({
      data: [
        {
          id: '42',
          fields: {
            name: 'Floods - Example',
            status: 'ongoing',
            type: [{ name: 'Flood' }],
            url: 'https://reliefweb.int/disaster/fl-2026-example',
            primary_country: { name: 'Example', location: { lat: 1.5, lon: 2.5 } },
            date: { created: '2026-09-01T00:00:00+00:00' },
          },
        },
        { id: '43', fields: { name: 'No coords' } },
      ],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({
      id: 'rw-42',
      lat: 1.5,
      lng: 2.5,
      kind: 'event',
      eventType: 'Flood',
    })
  })
})
