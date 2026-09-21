import { allowedBriefUpstream, chatCompletionsUrl, ollamaChatUrl, ollamaTagsUrl } from './allow'
import { BRIEF_SYSTEM_PROMPT } from './snapshot'
import { OLLAMA_ORIGIN, type BriefPrefsV1, type BriefSnapshot } from './types'

export interface ChatOk {
  ok: true
  text: string
  model: string
}

export interface ChatErr {
  ok: false
  error: string
}

const TIMEOUT_MS = 45_000

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    window.clearTimeout(t)
  }
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

export function parseOpenAiContent(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices.length) return null
  const msg = choices[0] as { message?: { content?: unknown }; text?: unknown }
  return asText(msg?.message?.content) ?? asText(msg?.text)
}

export function parseOllamaContent(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const row = data as { message?: { content?: unknown }; response?: unknown; error?: unknown }
  if (typeof row.error === 'string' && row.error.trim()) return null
  return asText(row.message?.content) ?? asText(row.response)
}

export async function probeOllama(): Promise<{ ok: true; models: string[] } | ChatErr> {
  try {
    const res = await fetch('/proxy/brief/ollama', { signal: AbortSignal.timeout(4000) })
    const data = (await res.json()) as { error?: unknown; models?: unknown }
    if (!res.ok) {
      return { ok: false, error: asText(data.error) ?? `Ollama HTTP ${res.status}. Nothing was invented.` }
    }
    const models = Array.isArray(data.models)
      ? data.models.filter((m): m is string => typeof m === 'string' && Boolean(m.trim()))
      : []
    return { ok: true, models }
  } catch {
    return { ok: false, error: 'Ollama is not reachable at http://127.0.0.1:11434. BRIEF stays empty.' }
  }
}

export async function requestBrief(prefs: BriefPrefsV1, snapshot: BriefSnapshot): Promise<ChatOk | ChatErr> {
  const origin =
    prefs.provider === 'ollama'
      ? allowedBriefUpstream('ollama', prefs.baseUrl || OLLAMA_ORIGIN)
      : allowedBriefUpstream('openai-compat', prefs.baseUrl)
  if (!origin) {
    return {
      ok: false,
      error:
        prefs.provider === 'ollama'
          ? 'BRIEF ERR — Ollama is only reached at http://127.0.0.1:11434.'
          : 'BRIEF ERR — API base URL is not allowed. Use https (or http loopback).',
    }
  }
  if (prefs.provider === 'openai-compat' && !prefs.apiKey.trim()) {
    return { ok: false, error: 'BRIEF ERR — API key missing. No default cloud key is bundled.' }
  }
  if (!prefs.model.trim()) {
    return { ok: false, error: 'BRIEF ERR — model name is empty.' }
  }

  const messages = [
    { role: 'system', content: BRIEF_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `On-screen public-feed snapshot (JSON). Write the brief from this only:\n${JSON.stringify(snapshot)}`,
    },
  ]

  try {
    const res = await postJson(
      '/proxy/brief',
      {
        provider: prefs.provider,
        baseUrl: origin,
        model: prefs.model.trim(),
        messages,
      },
      prefs.apiKey.trim() ? { 'X-Overwatch-Brief-Key': prefs.apiKey.trim() } : {},
    )
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const err =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : `BRIEF HTTP ${res.status}`
      return { ok: false, error: `${err} No brief was invented.` }
    }
    const text = prefs.provider === 'ollama' ? parseOllamaContent(data) : parseOpenAiContent(data)
    if (!text) return { ok: false, error: 'BRIEF ERR — model returned empty text. Nothing was invented.' }
    return { ok: true, text, model: prefs.model.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network error'
    return { ok: false, error: `BRIEF ERR — ${msg}. Empty on purpose.` }
  }
}

export { ollamaChatUrl, ollamaTagsUrl, chatCompletionsUrl }
