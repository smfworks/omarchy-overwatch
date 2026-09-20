import { describe, expect, it } from 'vitest'
import { isDangerousWeather } from './weather'
import type { GeoPoint } from '../globe/types'

function pt(partial: Partial<GeoPoint> & Pick<GeoPoint, 'kind' | 'label'>): GeoPoint {
  return { id: 't', lat: 0, lng: 0, ...partial }
}

describe('dangerous weather classification', () => {
  it('flags NWS hurricane / tornado / blizzard / flash flood / severe thunderstorm', () => {
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Hurricane Warning' }))).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Tornado Watch', eventType: 'Tornado Watch' }))).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Blizzard Warning' }))).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Winter Storm Warning' }))).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Severe Thunderstorm Warning' }))).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Flash Flood Warning' }))).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Tropical Storm Watch' }))).toBe(true)
  })

  it('flags EONET severe storms from category, not from invented labels', () => {
    expect(
      isDangerousWeather(pt({ kind: 'event', label: 'Storm system', categories: ['severeStorms'] })),
    ).toBe(true)
    expect(isDangerousWeather(pt({ kind: 'event', label: 'Wildfires - California' }))).toBe(false)
  })

  it('does not treat quakes, fires, aircraft, or generic alerts as storms', () => {
    expect(isDangerousWeather(pt({ kind: 'quake', label: 'M4.2 California' }))).toBe(false)
    expect(isDangerousWeather(pt({ kind: 'fire', label: 'Fire 36.00°, -119.00°' }))).toBe(false)
    expect(isDangerousWeather(pt({ kind: 'aircraft', label: 'BAW123' }))).toBe(false)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Special Weather Statement' }))).toBe(false)
    expect(isDangerousWeather(pt({ kind: 'alert', label: 'Red Flag Warning' }))).toBe(false)
  })
})
