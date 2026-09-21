import { allowedBriefUpstream, sanitizeBaseUrl, sanitizeModel } from './allow'
import { BRIEF_KEY, DEFAULT_BRIEF_PREFS, OLLAMA_ORIGIN, type BriefPrefsV1, type BriefProvider } from './types'

const KEY_MAX = 200

function asProvider(raw: unknown): BriefProvider {
  return raw === 'openai-compat' ? 'openai-compat' : 'ollama'
}

function asKey(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, KEY_MAX)
}

export function sanitizeBriefPrefs(raw: unknown): BriefPrefsV1 {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  if (row.version !== 1) return { ...DEFAULT_BRIEF_PREFS }
  const provider = asProvider(row.provider)
  const baseUrl = sanitizeBaseUrl(row.baseUrl) || (provider === 'ollama' ? OLLAMA_ORIGIN : '')
  const allowed = allowedBriefUpstream(provider, baseUrl)
  return {
    version: 1,
    enabled: row.enabled === true,
    provider,
    baseUrl: allowed ?? (provider === 'ollama' ? OLLAMA_ORIGIN : ''),
    apiKey: asKey(row.apiKey),
    model: sanitizeModel(row.model) || (provider === 'ollama' ? DEFAULT_BRIEF_PREFS.model : ''),
  }
}

export function loadBriefPrefs(): BriefPrefsV1 {
  try {
    const raw = localStorage.getItem(BRIEF_KEY)
    if (!raw) return { ...DEFAULT_BRIEF_PREFS }
    return sanitizeBriefPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_BRIEF_PREFS }
  }
}

export function saveBriefPrefs(prefs: BriefPrefsV1): void {
  localStorage.setItem(BRIEF_KEY, JSON.stringify(sanitizeBriefPrefs(prefs)))
}

export function briefConfigured(prefs: BriefPrefsV1): boolean {
  if (!prefs.enabled) return false
  if (!prefs.model.trim()) return false
  if (prefs.provider === 'ollama') return Boolean(allowedBriefUpstream('ollama', prefs.baseUrl || OLLAMA_ORIGIN))
  return Boolean(prefs.apiKey.trim() && allowedBriefUpstream('openai-compat', prefs.baseUrl))
}

export function briefConfigError(prefs: BriefPrefsV1): string | null {
  if (!prefs.enabled) return 'On-screen brief is off.'
  if (!prefs.model.trim()) return 'BRIEF ERR — model name is empty. No text was invented.'
  if (prefs.provider === 'openai-compat') {
    if (!prefs.baseUrl.trim()) return 'BRIEF ERR — paste an HTTPS API base URL. No default cloud key exists.'
    if (!allowedBriefUpstream('openai-compat', prefs.baseUrl)) {
      return 'BRIEF ERR — API base must be https (or http loopback). No SMF-hosted LLM is called.'
    }
    if (!prefs.apiKey.trim()) return 'BRIEF ERR — API key missing. Stored only in this browser; none is bundled.'
  }
  if (prefs.provider === 'ollama' && !allowedBriefUpstream('ollama', prefs.baseUrl || OLLAMA_ORIGIN)) {
    return 'BRIEF ERR — Ollama is only reached at http://127.0.0.1:11434.'
  }
  return null
}
