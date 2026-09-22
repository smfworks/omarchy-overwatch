import { describe, expect, it } from 'vitest'
import { HOME_GLOBE_POV, captureRestorePov } from './camera'

describe('globe camera restore', () => {
  it('snapshots the pre-zoom camera and ignores the later locality altitude', () => {
    const home = { lat: 18, lng: 25, altitude: 2.4 }
    const saved = captureRestorePov(null, home)
    const zoomed = { lat: 50.45, lng: 30.52, altitude: 0.42 }
    expect(captureRestorePov(saved, zoomed)).toEqual(home)
    expect(captureRestorePov(saved, zoomed).altitude).toBe(2.4)
  })

  it('falls back to the original globe size when no camera has been reported yet', () => {
    expect(captureRestorePov(null, null)).toEqual(HOME_GLOBE_POV)
    expect(captureRestorePov(null, { lat: 1, lng: 2, altitude: 0 })).toEqual(HOME_GLOBE_POV)
  })
})
