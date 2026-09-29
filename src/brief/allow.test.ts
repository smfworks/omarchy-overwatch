import { describe, expect, it } from 'vitest'
import { allowedBriefUpstream, briefForwardPolicy, chatCompletionsUrl, friendlyBriefError, KNOWN_BRIEF_PROVIDER_HOSTS, sanitizeModel } from './allow'

describe('brief upstream allowlist', () => {
  it('locks Ollama to loopback:11434', () => {
    expect(allowedBriefUpstream('ollama', 'http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
    expect(allowedBriefUpstream('ollama', 'http://localhost:11434')).toBe('http://localhost:11434')
    expect(allowedBriefUpstream('ollama', 'http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434')
    expect(allowedBriefUpstream('ollama', 'http://evil.example:11434')).toBeNull()
    expect(allowedBriefUpstream('ollama', 'https://127.0.0.1:11434')).toBeNull()
    expect(allowedBriefUpstream('ollama', 'http://127.0.0.1:80')).toBeNull()
  })

  it('allows known https providers, one configured base URL, and http loopback only on that port', () => {
    expect(allowedBriefUpstream('openai-compat', 'https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
    expect(allowedBriefUpstream('openai-compat', 'https://llm.example/v1')).toBe('https://llm.example/v1')
    expect(allowedBriefUpstream('openai-compat', 'http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
    expect(allowedBriefUpstream('openai-compat', 'http://127.0.0.1/v1')).toBeNull()
    expect(allowedBriefUpstream('openai-compat', 'http://127.8.8.8:1234/v1')).toBeNull()
    expect(allowedBriefUpstream('openai-compat', 'http://example.com/v1')).toBeNull()
    expect(allowedBriefUpstream('openai-compat', 'https://127.0.0.1:1234/v1')).toBeNull()
    expect(allowedBriefUpstream('openai-compat', 'https://earthquake.usgs.gov/v1')).toBeNull()
    expect(allowedBriefUpstream('openai-compat', '')).toBeNull()
    const openai = briefForwardPolicy('openai-compat', 'https://api.openai.com/v1')
    expect(openai?.configuredHost).toBe('api.openai.com')
    expect(openai?.allowHosts).toEqual(expect.arrayContaining(['api.openai.com', ...KNOWN_BRIEF_PROVIDER_HOSTS]))
    expect(openai?.loopbackPort).toBeUndefined()
    const local = briefForwardPolicy('openai-compat', 'http://127.0.0.1:1234/v1')
    expect(local?.loopbackPort).toBe(1234)
    expect(local?.allowHosts[0]).toBe('127.0.0.1')
    const custom = briefForwardPolicy('openai-compat', 'https://llm.example/v1')
    expect(custom?.allowHosts).toEqual(expect.arrayContaining(['llm.example', 'api.openai.com']))
    expect(chatCompletionsUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions')
    expect(sanitizeModel('  gpt-4o-mini  ')).toBe('gpt-4o-mini')
  })
})

describe('friendly brief errors', () => {
  it('maps connection failures to an honest empty Ollama ERR', () => {
    expect(friendlyBriefError('fetch failed', 'ollama')).toMatch(/127\.0\.0\.1:11434/)
    expect(friendlyBriefError('ECONNREFUSED', 'openai-compat')).toMatch(/not reachable/)
    expect(friendlyBriefError('model not found', 'ollama')).toBe('model not found')
  })
})
