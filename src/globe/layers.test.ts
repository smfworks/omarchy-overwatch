import { describe, expect, it } from 'vitest'
import { classifyStatus } from './layers'
import {
  describeLayerHttpError,
  extractAisVessel,
  parseAisSnapshot,
  parseFirmsCsv,
  parseOpenSkyStates,
} from './parse'
import openskyFixture from './fixtures/opensky-states.json'
import aisSnapshot from './fixtures/ais-snapshot.json'
import aisMessages from './fixtures/ais-messages.json'
import firmsCsv from './fixtures/firms-viirs.csv?raw'

describe('layer status', () => {
  it('maps enabled/error/freshness honestly', () => {
    expect(classifyStatus({ enabled: false, updatedAt: null, error: null, points: [] })).toBe('off')
    expect(classifyStatus({ enabled: true, updatedAt: null, error: null, points: [] })).toBe('loading')
    expect(classifyStatus({ enabled: true, updatedAt: null, error: 'HTTP 403', points: [] })).toBe('err')
    expect(classifyStatus({ enabled: true, updatedAt: Date.now(), error: 'HTTP 403', points: [] })).toBe('stale')
    expect(classifyStatus({ enabled: true, updatedAt: Date.now(), error: null, points: [] })).toBe('live')
    expect(
      classifyStatus({ enabled: true, updatedAt: Date.now() - 20 * 60 * 1000, error: null, points: [] }),
    ).toBe('stale')
  })
})

describe('OpenSky parser', () => {
  it('keeps a sampled subset and drops invalid coordinates', () => {
    const points = parseOpenSkyStates(openskyFixture, { stride: 1, limit: 90 })
    expect(points.map((p) => p.id)).toEqual(['ac-abc123', 'ac-skip1', 'ac-skip2'])
    expect(points[0]).toMatchObject({
      kind: 'aircraft',
      label: 'BAW123',
      extra: 'United Kingdom',
      lat: 51.47,
      lng: -0.45,
      heading: 90,
      speedMs: 200,
      altitudeM: 10000,
      onGround: false,
    })
  })

  it('does not invent aircraft from empty or malformed payloads', () => {
    expect(parseOpenSkyStates(null)).toEqual([])
    expect(parseOpenSkyStates({})).toEqual([])
    expect(parseOpenSkyStates({ states: 'nope' })).toEqual([])
  })
})

describe('AIS parser', () => {
  it('maps snapshot vessels and skips bogus coordinates', () => {
    const points = parseAisSnapshot(aisSnapshot)
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({
      id: 'ais-367719770',
      kind: 'vessel',
      label: 'EXAMPLE STAR',
      lat: 25.77,
      lng: -80.13,
      heading: 88,
      speedKt: 11.2,
    })
    expect(points[1].label).toBe('MMSI 211476060')
  })

  it('extracts AISStream envelopes without fabricating a ship', () => {
    const fromMeta = extractAisVessel(aisMessages.messages[0])
    expect(fromMeta).toMatchObject({ mmsi: '368207620', name: 'DEMO SHIP', lat: 33.72, lng: -118.2, heading: 175, course: 180, speedKt: 12.5 })
    expect(extractAisVessel(aisMessages.messages[2])).toBeNull()
    const points = parseAisSnapshot(aisMessages)
    expect(points).toHaveLength(2)
    expect(parseAisSnapshot({ vessels: [] })).toEqual([])
  })
})

describe('FIRMS parser', () => {
  it('keeps real detections, prefers higher FRP, skips invalid rows', () => {
    const points = parseFirmsCsv(firmsCsv, 10)
    expect(points).toHaveLength(3)
    expect(points[0].kind).toBe('fire')
    expect(points[0].lat).toBe(-23.5)
    expect(points[0].extra).toContain('FRP 88')
  })

  it('fails honestly on MAP_KEY / HTML errors and does not invent fires', () => {
    expect(() => parseFirmsCsv('Invalid MAP_KEY')).toThrow(/MAP_KEY/)
    expect(() => parseFirmsCsv('<html>blocked</html>')).toThrow(/HTML/)
    expect(parseFirmsCsv('')).toEqual([])
  })
})

describe('HTTP honesty', () => {
  it('explains OpenSky 401 and 429 without suggesting fake tracks', () => {
    expect(describeLayerHttpError(401, 'opensky')).toMatch(/401/)
    expect(describeLayerHttpError(401, 'opensky')).toMatch(/OPENSKY_/)
    expect(describeLayerHttpError(429, 'opensky')).toMatch(/429/)
    expect(describeLayerHttpError(429, 'opensky')).toMatch(/invented/)
    expect(describeLayerHttpError(401, 'ais')).toMatch(/AISSTREAM_API_KEY/)
    expect(describeLayerHttpError(401, 'firms')).toMatch(/FIRMS/)
  })
})
