import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_LAYOUT, loadLayout, resetLayout, sanitizeLayout, saveLayout } from './storage'

describe('layout persistence', () => {
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

  it('returns defaults when empty', () => {
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT)
  })

  it('clamps sizes and round-trips', () => {
    const saved = sanitizeLayout({ leftWidth: 9999, right: false, topHeight: 10 })
    expect(saved.leftWidth).toBe(640)
    expect(saved.right).toBe(false)
    expect(saved.topHeight).toBe(44)
    saveLayout(saved)
    expect(loadLayout().right).toBe(false)
    expect(resetLayout()).toEqual(DEFAULT_LAYOUT)
  })
})
