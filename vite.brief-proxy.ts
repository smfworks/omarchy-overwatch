import type { Plugin } from 'vite'
import {
  allowedBriefUpstream,
  chatCompletionsUrl,
  friendlyBriefError,
  ollamaChatUrl,
  ollamaTagsUrl,
} from './src/brief/allow'
import { OLLAMA_ORIGIN } from './src/brief/types'

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
  const origin = allowedBriefUpstream('ollama', OLLAMA_ORIGIN)
  if (!origin) {
    sendJson(res, 500, { error: 'Ollama origin is not allowed.' })
    return
  }
  try {
    const upstream = await fetch(ollamaTagsUrl(origin), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    })
    const data = (await upstream.json().catch(() => null)) as { models?: { name?: string }[]; error?: string } | null
    if (!upstream.ok) {
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
  const origin = allowedBriefUpstream(provider, baseUrl)
  if (!origin) {
    sendJson(res, 400, {
      error: 'BRIEF ERR — upstream not allowed. Ollama is loopback:11434; BYOK must be https or http loopback.',
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

  try {
    if (provider === 'ollama') {
      const upstream = await fetch(ollamaChatUrl(origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ model, messages: row.messages, stream: false }),
        signal: AbortSignal.timeout(45_000),
      })
      const text = await upstream.text()
      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(text)
      return
    }
    const upstream = await fetch(chatCompletionsUrl(origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': UA,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages: row.messages, temperature: 0.2, max_tokens: 800 }),
      signal: AbortSignal.timeout(45_000),
    })
    const text = await upstream.text()
    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(text)
  } catch (err) {
    sendJson(res, 502, {
      error: friendlyBriefError(err instanceof Error ? err.message : 'Brief upstream failed', provider),
    })
  }
}

export function briefProxyPlugin(): Plugin {
  const handler = (req: SimpleReq, res: SimpleRes, next: () => void) => {
    const url = pathOf(req.url)
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
      server.middlewares.use((req, res, next) => {
        handler(req as SimpleReq, res as SimpleRes, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        handler(req as SimpleReq, res as SimpleRes, next)
      })
    },
  }
}
