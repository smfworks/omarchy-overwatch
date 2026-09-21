import { describe, expect, it, beforeEach } from 'vitest'
import { loadFavorites, recordRecent, sanitizeFavorites, saveFavorites, togglePinned } from './storage'

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

describe('favorites / recents', () => {
  beforeEach(() => mockStorage())

  it('pins unique kebab-case tool ids and records recents newest-first', () => {
    let favs = sanitizeFavorites({ version: 1, pinned: [], recent: [] })
    favs = togglePinned(favs, 'shodan')
    favs = togglePinned(favs, 'shodan')
    favs = togglePinned(favs, 'virustotal')
    favs = recordRecent(favs, 'shodan', 2)
    favs = recordRecent(favs, 'haveibeenpwned', 3)
    expect(favs.pinned).toEqual(['virustotal'])
    expect(favs.recent.map((r) => r.id)).toEqual(['haveibeenpwned', 'shodan'])
    saveFavorites(favs)
    expect(loadFavorites().pinned).toEqual(['virustotal'])
  })

  it('drops unknown versions and junk ids', () => {
    expect(sanitizeFavorites({ version: 2, pinned: ['shodan'] }).pinned).toEqual([])
    expect(sanitizeFavorites({ version: 1, pinned: ['not valid', 'ok-id'] }).pinned).toEqual(['ok-id'])
  })
})
