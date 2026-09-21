import { describe, expect, it, beforeEach } from 'vitest'
import { cycleMapStyleId, ESRI_WORLD_IMAGERY_TILES, OPENFREEMAP_DARK_STYLE_URL, attributionFor } from './styles'
import { loadMapStylePrefs, sanitizeMapStylePrefs, saveMapStylePrefs } from './storage'

describe('map style pack', () => {
  it('cycles DEFAULT → SATELLITE → NIGHT', () => {
    expect(cycleMapStyleId('default', 1)).toBe('satellite')
    expect(cycleMapStyleId('satellite', 1)).toBe('night')
    expect(cycleMapStyleId('night', 1)).toBe('default')
    expect(cycleMapStyleId('default', -1)).toBe('night')
  })

  it('uses ToS-clean public tile URLs with attribution', () => {
    expect(ESRI_WORLD_IMAGERY_TILES[0]).toContain('World_Imagery')
    expect(OPENFREEMAP_DARK_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/dark')
    expect(attributionFor('satellite')).toMatch(/Esri/)
    expect(attributionFor('default')).toMatch(/OpenStreetMap/)
    expect(attributionFor('night')).toMatch(/OpenFreeMap/)
  })
})

describe('map style persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })
  })

  it('rejects unknown styles and round-trips', () => {
    expect(sanitizeMapStylePrefs({ version: 1, style: 'mapbox', nvg: true })).toEqual({
      version: 1,
      style: 'default',
      nvg: true,
    })
    saveMapStylePrefs({ version: 1, style: 'satellite', nvg: false })
    expect(loadMapStylePrefs().style).toBe('satellite')
  })
})
