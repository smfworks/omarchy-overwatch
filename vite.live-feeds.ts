import type { Plugin } from 'vite'

type EnvMap = Record<string, string>

type SimpleRes = {
  statusCode: number
  headersSent: boolean
  setHeader: (name: string, value: string) => void
  end: (chunk?: string) => void
}

type SimpleReq = { url?: string; method?: string }

const UA = 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)'

function sendJson(res: SimpleRes, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function sendText(res: SimpleRes, status: number, body: string, contentType: string): void {
  res.statusCode = status
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function pathOf(req: SimpleReq): string {
  const raw = req.url ?? '/'
  const q = raw.indexOf('?')
  return q === -1 ? raw : raw.slice(0, q)
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function vesselFromAisMessage(message: unknown): { mmsi?: string; name?: string; lat: number; lng: number; extra?: string } | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as {
    error?: unknown
    MessageType?: unknown
    MetaData?: Record<string, unknown>
    Metadata?: Record<string, unknown>
    Message?: Record<string, Record<string, unknown>>
  }
  if (typeof msg.error === 'string') return null
  const meta = msg.MetaData ?? msg.Metadata ?? {}
  const type = typeof msg.MessageType === 'string' ? msg.MessageType : ''
  const body = type && msg.Message ? msg.Message[type] : undefined
  const lat = asFiniteNumber(meta.Latitude ?? meta.latitude ?? body?.Latitude ?? body?.latitude)
  const lng = asFiniteNumber(meta.Longitude ?? meta.longitude ?? body?.Longitude ?? body?.longitude)
  if (lat === null || lng === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const mmsiRaw = meta.MMSI ?? meta.mmsi ?? body?.UserID
  const mmsi = mmsiRaw === undefined || mmsiRaw === null ? undefined : String(mmsiRaw).trim() || undefined
  const nameRaw = meta.ShipName ?? meta.shipName
  const name = typeof nameRaw === 'string' ? nameRaw.trim() || undefined : undefined
  const extra = [type || undefined, mmsi ? `MMSI ${mmsi}` : undefined].filter(Boolean).join(' · ')
  return { mmsi, name, lat, lng, extra: extra || undefined }
}

function wsDataToString(data: unknown): string {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data)
  }
  return String(data)
}

let cachedToken: { value: string; exp: number; id: string } | null = null

async function fetchOpenSkyToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.id === clientId && Date.now() < cachedToken.exp) {
    return cachedToken.value
  }
  const res = await fetch(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenSky token HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`)
  }
  const data = JSON.parse(text) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error('OpenSky token response missing access_token')
  const ttlMs = Math.max(30_000, ((data.expires_in ?? 1800) - 60) * 1000)
  cachedToken = { value: data.access_token, exp: Date.now() + ttlMs, id: clientId }
  return data.access_token
}

function basicAuth(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `Basic ${btoa(bin)}`
}

async function openSkyAuthorization(env: EnvMap, forceRefresh = false): Promise<string | null> {
  const clientId = env.OPENSKY_CLIENT_ID?.trim()
  const clientSecret = env.OPENSKY_CLIENT_SECRET?.trim()
  if (clientId && clientSecret) {
    if (forceRefresh) cachedToken = null
    const token = await fetchOpenSkyToken(clientId, clientSecret)
    return `Bearer ${token}`
  }
  const user = env.OPENSKY_USERNAME?.trim()
  const pass = env.OPENSKY_PASSWORD?.trim()
  if (user && pass) return basicAuth(user, pass)
  return null
}

async function proxyOpenSky(env: EnvMap, res: SimpleRes): Promise<void> {
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': UA }
  let auth: string | null = null
  try {
    auth = await openSkyAuthorization(env)
    if (auth) headers.Authorization = auth
  } catch (err) {
    sendJson(res, 401, {
      error: err instanceof Error ? err.message : 'OpenSky OAuth2 token request failed',
    })
    return
  }
  const call = (authorization: string | null) => {
    const next = { ...headers }
    if (authorization) next.Authorization = authorization
    else delete next.Authorization
    return fetch('https://opensky-network.org/api/states/all', {
      headers: next,
      signal: AbortSignal.timeout(12_000),
    })
  }
  let upstream: Response
  try {
    upstream = await call(auth)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'network error'
    sendJson(res, 502, {
      error: `OpenSky unreachable (${detail}). Anonymous /states/all is often blocked or rate-limited — no aircraft were invented.`,
    })
    return
  }
  if (upstream.status === 401 && auth?.startsWith('Bearer ')) {
    try {
      const refreshed = await openSkyAuthorization(env, true)
      if (refreshed) upstream = await call(refreshed)
    } catch {
      /* keep original 401 */
    }
  }
  const text = await upstream.text()
  sendText(res, upstream.status, text, upstream.headers.get('content-type') || 'application/json')
}

type AisVessel = NonNullable<ReturnType<typeof vesselFromAisMessage>>

function collectAisSnapshot(apiKey: string, collectMs = 2600, maxUnique = 120): Promise<{ vessels: AisVessel[] }> {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      reject(new Error('WebSocket is not available in this Node runtime'))
      return
    }
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
    const seen = new Set<string>()
    const vessels: AisVessel[] = []
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      if (err) reject(err)
      else resolve({ vessels })
    }
    const timer = setTimeout(() => finish(), collectMs)
    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [
            [
              [-90, -180],
              [90, 180],
            ],
          ],
          FilterMessageTypes: ['PositionReport'],
        }),
      )
    })
    ws.addEventListener('message', (ev) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(wsDataToString(ev.data))
      } catch {
        return
      }
      if (parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string') {
        finish(new Error(String((parsed as { error: string }).error)))
        return
      }
      const vessel = vesselFromAisMessage(parsed)
      if (!vessel) return
      const key = vessel.mmsi || `${vessel.lat.toFixed(4)},${vessel.lng.toFixed(4)}`
      if (seen.has(key)) return
      seen.add(key)
      vessels.push(vessel)
      if (vessels.length >= maxUnique) finish()
    })
    ws.addEventListener('error', () => {
      finish(new Error('AISStream WebSocket error'))
    })
    ws.addEventListener('close', () => {
      if (!settled && vessels.length === 0) {
        finish(new Error('AISStream closed before any positions arrived (check AISSTREAM_API_KEY)'))
      } else {
        finish()
      }
    })
  })
}

function allowedRssTarget(raw: string | null): string | null {
  if (!raw) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname) return null
  return parsed.href
}

async function proxyRss(req: SimpleReq, res: SimpleRes): Promise<void> {
  const raw = req.url ?? ''
  const q = raw.includes('?') ? new URL(raw, 'http://overwatch.local').searchParams.get('url') : null
  const target = allowedRssTarget(q)
  if (!target) {
    sendJson(res, 400, { error: 'Only http/https RSS or Atom URLs are allowed. No headlines were invented.' })
    return
  }
  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    })
    const text = await upstream.text()
    if (!upstream.ok) {
      sendJson(res, upstream.status, { error: text.slice(0, 220) || `RSS HTTP ${upstream.status}` })
      return
    }
    sendText(res, 200, text, upstream.headers.get('content-type') || 'application/xml; charset=utf-8')
  } catch (err) {
    sendJson(res, 502, {
      error: err instanceof Error ? err.message : 'RSS proxy failed',
    })
  }
}

async function proxyFirmsApi(env: EnvMap, res: SimpleRes): Promise<void> {
  const key = env.FIRMS_MAP_KEY?.trim()
  if (!key) {
    sendJson(res, 401, {
      error:
        'FIRMS_MAP_KEY is not set. Public CSV also failed or was not used. Request a free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key/ — Overwatch will not invent fires.',
    })
    return
  }
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/world/1`
  const upstream = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*' } })
  const text = await upstream.text()
  if (!upstream.ok) {
    sendJson(res, upstream.status, { error: text.slice(0, 240) || `FIRMS API HTTP ${upstream.status}` })
    return
  }
  sendText(res, 200, text, 'text/csv; charset=utf-8')
}

export function liveFeedsPlugin(env: EnvMap): Plugin {
  const handler = (req: SimpleReq, res: SimpleRes, next: () => void) => {
    const url = pathOf(req)
    const run = async () => {
      if (url === '/proxy/opensky/api/states/all' || url === '/proxy/opensky/api/states/all/') {
        await proxyOpenSky(env, res)
        return
      }
      if (url === '/proxy/ais/status') {
        sendJson(res, 200, { configured: Boolean(env.AISSTREAM_API_KEY?.trim()), source: 'aisstream' })
        return
      }
      if (url === '/proxy/ais/snapshot') {
        const key = env.AISSTREAM_API_KEY?.trim()
        if (!key) {
          sendJson(res, 401, {
            error:
              'AISSTREAM_API_KEY is not set. Create a free key at https://aisstream.io and add it to .env. Overwatch will not invent vessel positions.',
          })
          return
        }
        try {
          const snapshot = await collectAisSnapshot(key)
          sendJson(res, 200, { source: 'aisstream', vessels: snapshot.vessels })
        } catch (err) {
          sendJson(res, 502, {
            error: err instanceof Error ? err.message : 'AISStream snapshot failed',
          })
        }
        return
      }
      if (url === '/proxy/firms/api/active') {
        await proxyFirmsApi(env, res)
        return
      }
      if (url === '/proxy/rss') {
        await proxyRss(req, res)
        return
      }
      next()
    }
    void run().catch((err: unknown) => {
      if (res.headersSent) return
      sendJson(res, 502, { error: err instanceof Error ? err.message : 'live proxy failed' })
    })
  }

  return {
    name: 'omarchy-live-feeds',
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
