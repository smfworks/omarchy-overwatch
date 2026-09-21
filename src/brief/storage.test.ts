import { describe, expect, it, beforeEach } from 'vitest'
import { briefConfigured, briefConfigError, sanitizeBriefPrefs } from './storage'
import { DEFAULT_BRIEF_PREFS } from './types'

function mockStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    },
  })
}

describe('brief prefs', () => {
  beforeEach(() => mockStorage())

  it('defaults off with no cloud key', () => {
    expect(DEFAULT_BRIEF_PREFS.enabled).toBe(false)
    expect(DEFAULT_BRIEF_PREFS.apiKey).toBe('')
    expect(sanitizeBriefPrefs({ version: 9, apiKey: 'sk-leak' })).toEqual(DEFAULT_BRIEF_PREFS)
    expect(briefConfigured(DEFAULT_BRIEF_PREFS)).toBe(false)
  })

  it('requires a pasted key for openai-compat and keeps ollama loopback', () => {
    const open = sanitizeBriefPrefs({
      version: 1,
      enabled: true,
      provider: 'openai-compat',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: ' sk-user ',
      model: 'gpt-4o-mini',
    })
    expect(open.apiKey).toBe('sk-user')
    expect(briefConfigured(open)).toBe(true)
    expect(briefConfigError({ ...open, apiKey: '' })).toMatch(/key missing/)
    const badHost = sanitizeBriefPrefs({
      version: 1,
      enabled: true,
      provider: 'openai-compat',
      baseUrl: 'http://smf.example/llm',
      apiKey: 'x',
      model: 'x',
    })
    expect(badHost.baseUrl).toBe('')
  })
})
