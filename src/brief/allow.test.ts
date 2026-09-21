import { describe, expect, it } from 'vitest'
import { allowedBriefUpstream, chatCompletionsUrl, sanitizeModel } from './allow'

describe('brief upstream allowlist', () => {
  it('locks Ollama to loopback:11434', () => {
    expect(allowedBriefUpstream('ollama', 'http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
    expect(allowedBriefUpstream('ollama', 'http://localhost:11434')).toBe('http://localhost:11434')
    expect(allowedBriefUpstream('ollama', 'http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434')
    expect(allowedBriefUpstream('ollama', 'http://evil.example:11434')).toBeNull()
    expect(allowedBriefUpstream('ollama', 'https://127.0.0.1:11434')).toBeNull()
    expect(allowedBriefUpstream('ollama', 'http://127.0.0.1:80')).toBeNull()
  })

  it('allows https OpenAI-compatible bases and loopback http, never SMF defaults', () => {
    expect(allowedBriefUpstream('openai-compat', 'https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
    expect(allowedBriefUpstream('openai-compat', 'http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
    expect(allowedBriefUpstream('openai-compat', 'http://example.com/v1')).toBeNull()
    expect(allowedBriefUpstream('openai-compat', '')).toBeNull()
    expect(chatCompletionsUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions')
    expect(sanitizeModel('  gpt-4o-mini  ')).toBe('gpt-4o-mini')
  })
})
