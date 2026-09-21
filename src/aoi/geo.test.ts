import { describe, expect, it } from 'vitest'
import {
  aoiToGeoJSON,
  decodeAoi,
  encodeAoi,
  pointInAoi,
  sanitizeAoi,
} from './geo'

describe('AOI geometry', () => {
  it('accepts a rectangle and rejects inverted/empty boxes', () => {
    const rect = sanitizeAoi({ kind: 'rect', minLat: 10, minLng: 20, maxLat: 12, maxLng: 24 })
    expect(rect?.kind).toBe('rect')
    expect(pointInAoi(11, 22, rect)).toBe(true)
    expect(pointInAoi(9, 22, rect)).toBe(false)
    expect(sanitizeAoi({ kind: 'rect', minLat: 12, minLng: 20, maxLat: 10, maxLng: 24 })).toBeNull()
  })

  it('tests polygons with ray casting and never invents a closed ring from two points', () => {
    const poly = sanitizeAoi({
      kind: 'poly',
      ring: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
    })
    expect(poly?.kind).toBe('poly')
    expect(pointInAoi(2, 2, poly)).toBe(true)
    expect(pointInAoi(8, 8, poly)).toBe(false)
    expect(sanitizeAoi({ kind: 'poly', ring: [[0, 0], [1, 1]] })).toBeNull()
  })

  it('round-trips compact URL encoding', () => {
    const rect = sanitizeAoi({ kind: 'rect', minLat: 26.4, minLng: 55.9, maxLat: 27.1, maxLng: 56.6 })
    expect(rect).not.toBeNull()
    if (!rect) return
    const encoded = encodeAoi(rect)
    expect(encoded.startsWith('rect:')).toBe(true)
    const back = decodeAoi(encoded)
    expect(back?.kind).toBe('rect')
    if (back?.kind !== 'rect') return
    expect(back.minLat).toBeCloseTo(26.4, 4)
    expect(aoiToGeoJSON(rect).geometry.coordinates[0]).toHaveLength(5)
  })

  it('treats a missing AOI as pass-through (no invented clip)', () => {
    expect(pointInAoi(0, 0, null)).toBe(true)
    expect(decodeAoi('')).toBeNull()
    expect(decodeAoi('nope')).toBeNull()
  })
})
