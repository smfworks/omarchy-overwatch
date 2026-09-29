import { isFeedUpstreamHost, normalizeHost } from '../net/ssrf'
import { OLLAMA_ORIGIN, type BriefProvider } from './types'

const MODEL_MAX = 80
const URL_MAX = 300

/** Public OpenAI-compatible APIs. One configured base URL may be added beside these. */
export const KNOWN_BRIEF_PROVIDER_HOSTS = [
  'api.openai.com',
  'api.groq.com',
  'api.mistral.ai',
  'api.together.xyz',
  'openrouter.ai',
  'api.deepseek.com',
  'api.x.ai',
] as const

const BLOCKED_NAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.home.arpa',
  '.lan',
  '.intranet',
  '.corp',
  '.home',
] as const

export interface BriefForwardPolicy {
  origin: string
  configuredHost: string
  /** Known provider hosts plus the configured base host. */
  allowHosts: string[]
  /** Set for http loopback. No other port receives the request. */
  loopbackPort?: number
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim())
  } catch {
    return null
  }
}

function isLoopbackHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

export function isKnownBriefProviderHost(hostname: string): boolean {
  return (KNOWN_BRIEF_PROVIDER_HOSTS as readonly string[]).includes(normalizeHost(hostname))
}

function isCustomBriefHost(host: string): boolean {
  if (!host || host.length > 200 || !host.includes('.') || host.includes(':')) return false
  if (isLoopbackHost(host) || isKnownBriefProviderHost(host) || isFeedUpstreamHost(host)) return false
  if (BLOCKED_NAME_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))) return false
  if (host === 'metadata.google.internal' || host === 'metadata.goog') return false
  return true
}

function keyAllowHosts(configuredHost: string): string[] {
  return [...new Set([configuredHost, ...KNOWN_BRIEF_PROVIDER_HOSTS])]
}

function originWithPath(parsed: URL, hostLiteral: string): string {
  const path = parsed.pathname.replace(/\/$/, '')
  const port = parsed.port ? `:${parsed.port}` : ''
  return `${parsed.protocol}//${hostLiteral}${port}${path}`
}

/** Allowed upstream for the local brief proxy. No SMF-hosted LLM. */
export function briefForwardPolicy(provider: BriefProvider, baseUrl: string): BriefForwardPolicy | null {
  if (provider === 'ollama') {
    const parsed = parseUrl(baseUrl || OLLAMA_ORIGIN)
    if (!parsed || parsed.protocol !== 'http:' || !isLoopbackHost(parsed.hostname)) return null
    if ((parsed.port || '80') !== '11434') return null
    const configuredHost = normalizeHost(parsed.hostname)
    const literal = configuredHost === '::1' ? '[::1]' : configuredHost
    return {
      origin: `http://${literal}:11434`,
      configuredHost,
      allowHosts: keyAllowHosts(configuredHost),
      loopbackPort: 11434,
    }
  }
  const parsed = parseUrl(baseUrl)
  if (!parsed || parsed.username || parsed.password) return null
  const configuredHost = normalizeHost(parsed.hostname)
  if (!configuredHost) return null
  if (parsed.protocol === 'https:') {
    if (!isKnownBriefProviderHost(configuredHost) && !isCustomBriefHost(configuredHost)) return null
    const port = parsed.port ? Number(parsed.port) : 443
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    return {
      origin: originWithPath(parsed, configuredHost),
      configuredHost,
      allowHosts: keyAllowHosts(configuredHost),
    }
  }
  if (parsed.protocol === 'http:' && isLoopbackHost(configuredHost)) {
    if (!parsed.port) return null
    const port = Number(parsed.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    const literal = configuredHost === '::1' ? '[::1]' : configuredHost
    return {
      origin: originWithPath(parsed, literal),
      configuredHost,
      allowHosts: keyAllowHosts(configuredHost),
      loopbackPort: port,
    }
  }
  return null
}

export function allowedBriefUpstream(provider: BriefProvider, baseUrl: string): string | null {
  return briefForwardPolicy(provider, baseUrl)?.origin ?? null
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
