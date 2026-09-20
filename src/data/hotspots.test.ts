import { describe, expect, it } from 'vitest'
import { nearestHotspot } from './hotspots'

describe('nearestHotspot', () => {
  it('locks Kyiv from a nearby click and ignores empty ocean', () => {
    const kyiv = nearestHotspot(50.4, 30.6)
    expect(kyiv?.id).toBe('kyiv')
    expect(nearestHotspot(0, -150)).toBeNull()
  })
})
