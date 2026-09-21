import { OLLAMA_ORIGIN, type BriefProvider } from './types'

const MODEL_MAX = 80
const URL_MAX = 300

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim())
  } catch {
    return null
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
}

/** Allowed upstream for the local brief proxy. No SMF-hosted LLM. */
export function allowedBriefUpstream(provider: BriefProvider, baseUrl: string): string | null {
  if (provider === 'ollama') {
    const parsed = parseUrl(baseUrl || OLLAMA_ORIGIN)
    if (!parsed) return null
    if (parsed.protocol !== 'http:') return null
    if (!isLoopback(parsed.hostname)) return null
    const port = parsed.port || '80'
    if (port !== '11434') return null
    return `${parsed.protocol}//${parsed.hostname}:11434`
  }
  const parsed = parseUrl(baseUrl)
  if (!parsed) return null
  if (parsed.protocol === 'https:') {
    if (!parsed.hostname || parsed.hostname.length > 200) return null
    return parsed.origin + (parsed.pathname.replace(/\/$/, '') || '')
  }
  if (parsed.protocol === 'http:' && isLoopback(parsed.hostname)) {
    return parsed.origin + (parsed.pathname.replace(/\/$/, '') || '')
  }
  return null
}

export function sanitizeModel(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, MODEL_MAX)
}

export function sanitizeBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, URL_MAX)
}

export function chatCompletionsUrl(base: string): string {
  const trimmed = base.replace(/\/$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`
  return `${trimmed}/chat/completions`
}

export function ollamaChatUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/chat`
}

export function ollamaTagsUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/tags`
}

export function friendlyBriefError(raw: string, provider: BriefProvider): string {
  const msg = raw.trim() || 'request failed'
  if (/fetch failed|econnrefused|enotfound|network error|abort/i.test(msg)) {
    return provider === 'ollama'
      ? 'Ollama is not reachable at http://127.0.0.1:11434. BRIEF stays empty.'
      : 'Brief API is not reachable. BRIEF stays empty.'
  }
  return msg
}
