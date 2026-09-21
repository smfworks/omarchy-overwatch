import { describe, expect, it } from 'vitest'
import { cycleDensity, docksForDensity, sanitizeHudPrefs } from './density'

describe('HUD density', () => {
  it('cycles operator → minimal → presentation', () => {
    expect(cycleDensity('operator')).toBe('minimal')
    expect(cycleDensity('minimal')).toBe('presentation')
    expect(cycleDensity('presentation')).toBe('operator')
  })

  it('hides docks in presentation without inventing layout sizes', () => {
    const layout = { left: true, right: true, top: true, bottom: true }
    expect(docksForDensity('presentation', layout)).toEqual({
      left: false,
      right: false,
      top: false,
      bottom: false,
    })
    expect(docksForDensity('minimal', layout).top).toBe(true)
    expect(docksForDensity('operator', layout)).toEqual(layout)
  })

  it('rejects unknown versions', () => {
    expect(sanitizeHudPrefs({ version: 2, density: 'presentation' }).density).toBe('operator')
  })
})
