import { describe, expect, it, beforeEach } from 'vitest'
import { loadViews, sanitizeView, sanitizeViewStore, saveViews, VIEWS_KEY } from './storage'

function mockStorage() {
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
}

describe('named views', () => {
  beforeEach(() => mockStorage())

  it('drops views with invalid camera coords instead of inventing a location', () => {
    expect(sanitizeView({ name: 'x', lat: 99, lng: 0, zoom: 4 })).toBeNull()
    const ok = sanitizeView({
      name: ' Hormuz ',
      lat: 26.56,
      lng: 56.25,
      zoom: 6,
      layers: ['earthquakes', 'bad layer'],
      heatEnabled: true,
      mapStyle: 'night',
      aoi: { kind: 'rect', minLat: 26, minLng: 56, maxLat: 27, maxLng: 57 },
    })
    expect(ok?.name).toBe('Hormuz')
    expect(ok?.layers).toEqual(['earthquakes'])
    expect(ok?.aoi?.kind).toBe('rect')
  })

  it('round-trips the versioned store', () => {
    const store = sanitizeViewStore({
      version: 1,
      views: [{ name: 'A', lat: 1, lng: 2, zoom: 3, layers: ['nws'] }],
    })
    saveViews(store)
    expect(loadViews().views).toHaveLength(1)
    expect(VIEWS_KEY).toBe('omarchy-overwatch.views.v1')
    expect(sanitizeViewStore({ version: 2, views: store.views })).toEqual({ version: 1, views: [] })
  })
})
