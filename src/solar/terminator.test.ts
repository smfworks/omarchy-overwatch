import { describe, expect, it } from 'vitest'
import { solarSubpoint, terminatorCoords } from './terminator'

describe('terminator', () => {
  it('places the subsolar longitude near 0° at 12:00 UTC', () => {
    const noon = Date.parse('2026-03-20T12:00:00Z')
    const sun = solarSubpoint(noon)
    expect(Math.abs(sun.lng)).toBeLessThan(8)
    expect(sun.lat).toBeGreaterThan(-24)
    expect(sun.lat).toBeLessThan(24)
  })

  it('returns at least one polyline of real coordinates (no invented night side fill)', () => {
    const parts = terminatorCoords(Date.parse('2026-09-21T00:00:00Z'))
    expect(parts.length).toBeGreaterThan(0)
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(2)
      for (const [lat, lng] of part) {
        expect(lat).toBeGreaterThanOrEqual(-90)
        expect(lat).toBeLessThanOrEqual(90)
        expect(lng).toBeGreaterThanOrEqual(-180)
        expect(lng).toBeLessThanOrEqual(180)
      }
    }
  })
})
