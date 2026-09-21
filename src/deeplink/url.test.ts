import { describe, expect, it } from 'vitest'
import { altitudeToZoom, parseDeepLink, writeDeepLink, zoomToAltitude } from './url'

describe('deep links', () => {
  it('parses the documented query subset and drops unknown layers', () => {
    const state = parseDeepLink('?lat=26.56&lon=56.25&z=6&layers=earthquakes,heat,nsa&style=night')
    expect(state.lat).toBeCloseTo(26.56)
    expect(state.lon).toBeCloseTo(56.25)
    expect(state.z).toBe(6)
    expect(state.layers).toEqual(['earthquakes', 'heat'])
    expect(state.style).toBe('night')
  })

  it('round-trips AOI without fabricating coordinates', () => {
    const qs = writeDeepLink({
      lat: 10,
      lon: 20,
      z: 4,
      layers: ['nws', 'firms'],
      style: 'satellite',
      aoi: { kind: 'rect', minLat: 9, minLng: 19, maxLat: 11, maxLng: 21 },
    })
    const back = parseDeepLink(`?${qs}`)
    expect(back.layers).toEqual(['nws', 'firms'])
    expect(back.aoi?.kind).toBe('rect')
    expect(writeDeepLink({})).toBe('')
  })

  it('rejects out-of-range coords instead of clamping into fake geography', () => {
    expect(parseDeepLink('?lat=99&lon=0').lat).toBeUndefined()
    expect(parseDeepLink('?lat=0&lon=200').lon).toBeUndefined()
  })

  it('converts globe altitude and map zoom in both directions', () => {
    const z = altitudeToZoom(0.42)
    expect(z).toBeGreaterThan(6)
    expect(zoomToAltitude(z)).toBeCloseTo(0.42, 1)
  })
})
