import type { Plugin } from 'vite'
import {
  briefForwardPolicy,
  chatCompletionsUrl,
  friendlyBriefError,
  ollamaChatUrl,
  ollamaTagsUrl,
} from './src/brief/allow'
import { PROXY_CALLER_ERROR, proxyCallerAllowed, type AllowedDevHosts } from './src/net/devHost'
import { OLLAMA_ORIGIN } from './src/brief/types'
import { guardedRequest } from './vite.guarded-fetch'

const UA = 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)'
const BODY_MAX = 800_000

type SimpleRes = {
  statusCode: number
  headersSent: boolean
  setHeader: (name: string, value: string) => void
  end: (chunk?: string) => void
}

type SimpleReq = {
  url?: string
  method?: string
  headers?: Record<string, string | string[] | undefined>
  on?: (event: string, cb: (arg?: unknown) => void) => void
  destroy?: () => void
}

function sendJson(res: SimpleRes, status: number, body: unknown): void {
  if (res.headersSent) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function pathOf(url: string | undefined): string {
  const raw = url ?? '/'
  const q = raw.indexOf('?')
  return q === -1 ? raw : raw.slice(0, q)
}

function header(req: SimpleReq, name: string): string {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]?.trim() ?? ''
  return typeof raw === 'string' ? raw.trim() : ''
}

function readBody(req: SimpleReq): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!req.on) {
      reject(new Error('request is not readable'))
      return
    }
    const chunks: Uint8Array[] = []
    let size = 0
    req.on('data', (chunk) => {
      const bytes =
        typeof chunk === 'string'
          ? new TextEncoder().encode(chunk)
          : chunk instanceof Uint8Array
            ? chunk
            : new Uint8Array()
      size += bytes.byteLength
      if (size > BODY_MAX) {
        reject(new Error('payload too large'))
        req.destroy?.()
        return
      }
      chunks.push(bytes)
    })
    req.on('end', () => {
      const merged = new Uint8Array(size)
      let offset = 0
      for (const part of chunks) {
        merged.set(part, offset)
        offset += part.byteLength
      }
      resolve(new TextDecoder().decode(merged))
    })
    req.on('error', (err) => {
      reject(err instanceof Error ? err : new Error('body read failed'))
    })
  })
}

async function probeOllama(res: SimpleRes): Promise<void> {
  const policy = briefForwardPolicy('ollama', OLLAMA_ORIGIN)
  if (!policy) {
    sendJson(res, 500, { error: 'Ollama origin is not allowed.' })
    return
  }
  try {
    const upstream = await guardedRequest({
      rawUrl: ollamaTagsUrl(policy.origin),
      mode: 'brief',
      allowHosts: policy.allowHosts,
      configuredHost: policy.configuredHost,
      loopbackPort: policy.loopbackPort,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeoutMs: 4000,
    })
    if (!upstream.ok) {
      sendJson(res, upstream.status, { error: friendlyBriefError(upstream.error, 'ollama') })
      return
    }
    let data: { models?: { name?: string }[]; error?: string } | null = null
    try {
      data = JSON.parse(upstream.body) as { models?: { name?: string }[]; error?: string }
    } catch {
      data = null
    }
    if (upstream.status < 200 || upstream.status >= 300) {
      sendJson(res, upstream.status, {
        error: data?.error || `Ollama HTTP ${upstream.status}. BRIEF stays empty.`,
      })
      return
    }
    const models = Array.isArray(data?.models)
      ? data.models.map((m) => m?.name).filter((n): n is string => Boolean(n))
      : []
    sendJson(res, 200, { ok: true, models })
  } catch (err) {
    sendJson(res, 502, {
      error: friendlyBriefError(err instanceof Error ? err.message : 'Ollama unreachable', 'ollama'),
    })
  }
}

async function proxyBrief(req: SimpleReq, res: SimpleRes): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST only. No brief was invented.' })
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(await readBody(req)) as unknown
  } catch {
    sendJson(res, 400, { error: 'BRIEF ERR — invalid JSON body.' })
    return
  }
  if (!parsed || typeof parsed !== 'object') {
    sendJson(res, 400, { error: 'BRIEF ERR — invalid JSON body.' })
    return
  }
  const row = parsed as {
    provider?: unknown
    baseUrl?: unknown
    model?: unknown
    messages?: unknown
  }
  const provider = row.provider === 'openai-compat' ? 'openai-compat' : row.provider === 'ollama' ? 'ollama' : null
  if (!provider) {
    sendJson(res, 400, { error: 'BRIEF ERR — provider must be ollama or openai-compat.' })
    return
  }
  const baseUrl = typeof row.baseUrl === 'string' ? row.baseUrl : ''
  const policy = briefForwardPolicy(provider, baseUrl)
  if (!policy) {
    sendJson(res, 400, {
      error:
        'BRIEF ERR — upstream not allowed. The API key is sent only to a known provider or the one configured base URL, over https, or to loopback http on the configured port.',
    })
    return
  }
  const model = typeof row.model === 'string' ? row.model.trim() : ''
  if (!model) {
    sendJson(res, 400, { error: 'BRIEF ERR — model name missing.' })
    return
  }
  if (!Array.isArray(row.messages)) {
    sendJson(res, 400, { error: 'BRIEF ERR — messages missing.' })
    return
  }
  const key = header(req, 'x-overwatch-brief-key')
  if (provider === 'openai-compat' && !key) {
    sendJson(res, 401, { error: 'BRIEF ERR — API key missing. No default cloud key is bundled.' })
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': UA,
  }
  if (provider === 'openai-compat') headers.Authorization = `Bearer ${key}`
  const target = provider === 'ollama' ? ollamaChatUrl(policy.origin) : chatCompletionsUrl(policy.origin)
  const payload =
    provider === 'ollama'
      ? { model, messages: row.messages, stream: false }
      : { model, messages: row.messages, temperature: 0.2, max_tokens: 800 }

  try {
    const upstream = await guardedRequest({
      rawUrl: target,
      mode: 'brief',
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      allowHosts: policy.allowHosts,
      configuredHost: policy.configuredHost,
      loopbackPort: policy.loopbackPort,
      timeoutMs: 45_000,
    })
    if (!upstream.ok) {
      sendJson(res, upstream.status, { error: friendlyBriefError(upstream.error, provider) })
      return
    }
    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.contentType || 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(upstream.body)
  } catch (err) {
    sendJson(res, 502, {
      error: friendlyBriefError(err instanceof Error ? err.message : 'Brief upstream failed', provider),
    })
  }
}

function isProxyPath(url: string): boolean {
  return url === '/proxy' || url.startsWith('/proxy/')
}

export function briefProxyPlugin(): Plugin {
  const handler = (req: SimpleReq, res: SimpleRes, next: () => void, allowedHosts: AllowedDevHosts) => {
    const url = pathOf(req.url)
    if (isProxyPath(url) && !proxyCallerAllowed(req.headers, allowedHosts)) {
      sendJson(res, 403, { error: PROXY_CALLER_ERROR })
      return
    }
    if (url === '/proxy/brief/ollama' && (req.method === 'GET' || req.method === 'HEAD')) {
      void probeOllama(res).catch((err: unknown) => {
        sendJson(res, 502, { error: err instanceof Error ? err.message : 'Ollama probe failed' })
      })
      return
    }
    if (url === '/proxy/brief') {
      void proxyBrief(req, res).catch((err: unknown) => {
        sendJson(res, 502, { error: err instanceof Error ? err.message : 'brief proxy failed' })
      })
      return
    }
    next()
  }

  return {
    name: 'omarchy-brief-proxy',
    configureServer(server) {
      const allowedHosts = server.config.server.allowedHosts ?? []
      server.middlewares.use((req, res, next) => {
        handler(req as SimpleReq, res as SimpleRes, next, allowedHosts)
      })
    },
    configurePreviewServer(server) {
      const allowedHosts = server.config.preview.allowedHosts ?? []
      server.middlewares.use((req, res, next) => {
        handler(req as SimpleReq, res as SimpleRes, next, allowedHosts)
      })
    },
  }
}
