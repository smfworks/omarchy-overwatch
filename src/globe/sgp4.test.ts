import { describe, expect, it } from 'vitest'
import { parseTleCatalog, propagateTleRecords } from './sgp4'

const ISS = `ISS (ZARYA)
1 25544U 98067A   26263.52959654  .00008422  00000+0  15975-3 0  9999
2 25544  51.6308 188.2246 0004825 162.2847 197.8311 15.49196792586535`

describe('CelesTrak TLE catalog', () => {
  it('parses 3-line groups and skips junk', () => {
    const recs = parseTleCatalog(`${ISS}\nnot a sat\n1 short\n`)
    expect(recs).toHaveLength(1)
    expect(recs[0].name).toContain('ISS')
    expect(recs[0].norad).toBe('25544')
  })

  it('propagates ISS into a real lat/lng band without inventing a catalog', () => {
    const recs = parseTleCatalog(ISS)
    const points = propagateTleRecords(recs, Date.UTC(2026, 8, 20, 18, 0, 0))
    expect(points).toHaveLength(1)
    expect(points[0].kind).toBe('sat')
    expect(points[0].lat).toBeGreaterThanOrEqual(-52)
    expect(points[0].lat).toBeLessThanOrEqual(52)
    expect(points[0].lng).toBeGreaterThanOrEqual(-180)
    expect(points[0].lng).toBeLessThanOrEqual(180)
    expect(points[0].altitudeM).toBeGreaterThan(200_000)
    expect(parseTleCatalog('')).toEqual([])
    expect(propagateTleRecords([])).toEqual([])
  })
})
