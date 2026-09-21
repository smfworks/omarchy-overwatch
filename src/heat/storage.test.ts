import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_HEAT_PREFS, loadHeatPrefs, sanitizeHeatPrefs, saveHeatPrefs } from './storage'
import { HEAT_KEY } from './types'

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
  return store
}

describe('heat prefs', () => {
  beforeEach(() => {
    mockStorage()
  })

  it('defaults off and ignores unknown versions', () => {
    expect(loadHeatPrefs()).toEqual(DEFAULT_HEAT_PREFS)
    expect(sanitizeHeatPrefs({ version: 2, enabled: true })).toEqual(DEFAULT_HEAT_PREFS)
    expect(sanitizeHeatPrefs({ version: 1, enabled: true }).enabled).toBe(true)
    saveHeatPrefs({ version: 1, enabled: true })
    expect(loadHeatPrefs().enabled).toBe(true)
    expect(HEAT_KEY).toBe('omarchy-overwatch.heat.v1')
  })
})
