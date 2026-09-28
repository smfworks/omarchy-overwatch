import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import zlib from 'node:zlib'
import {
  normalizeHost,
  pinnedLookup,
  runGuardedExchange,
  type ExchangeResult,
  type GuardMode,
  type GuardResult,
  type Hop,
  type ResolvedAddress,
} from './src/net/ssrf'

const MAX_BODY = 2_000_000

async function resolveHost(hostname: string): Promise<ResolvedAddress[]> {
  const rows = await lookup(hostname, { all: true, verbatim: true })
  return rows.map((row) => ({
    address: row.address,
    family: row.family === 6 || row.address.includes(':') ? 6 : 4,
  }))
}

function decodeBody(raw: Buffer, encoding: string | undefined): Buffer {
  const enc = (encoding ?? 'identity').toLowerCase().trim()
  if (!enc || enc === 'identity') return raw
  if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(raw)
  if (enc === 'deflate') return zlib.inflateSync(raw)
  if (enc === 'br') return zlib.brotliDecompressSync(raw)
  throw new Error(`unsupported content encoding ${enc}`)
}

export function exchangePinned(
  hop: Hop,
  headers: Record<string, string>,
  method: string,
  body: string | undefined,
  timeoutMs: number,
): Promise<ExchangeResult> {
  const dnsName = normalizeHost(hop.url.hostname)
  const hostname = hop.literal ? hop.address : dnsName
  const isHttps = hop.url.protocol === 'https:'
  const port = hop.url.port ? Number(hop.url.port) : isHttps ? 443 : 80
  const path = `${hop.url.pathname || '/'}${hop.url.search}`

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }
    const succeed = (value: ExchangeResult) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const onResponse = (res: http.IncomingMessage) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_BODY) {
            res.destroy()
            req.destroy()
            fail(new Error('upstream response exceeded size limit'))
            return
          }
          chunks.push(chunk)
        })
        res.on('error', (err) => fail(err))
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks)
            const encoding = res.headers['content-encoding']
            const decoded = decodeBody(raw, Array.isArray(encoding) ? encoding[0] : encoding)
            if (decoded.length > MAX_BODY) {
              fail(new Error('upstream response exceeded size limit'))
              return
            }
            const locationHeader = res.headers.location
            const location = Array.isArray(locationHeader) ? locationHeader[0] ?? null : locationHeader ?? null
            const typeHeader = res.headers['content-type']
            const contentType = Array.isArray(typeHeader) ? typeHeader[0] ?? null : typeHeader ?? null
            succeed({
              status: res.statusCode ?? 502,
              location,
              body: decoded.toString('utf8'),
              contentType,
            })
          } catch (err) {
            fail(err instanceof Error ? err : new Error('upstream decode failed'))
          }
        })
    }
    const base: http.RequestOptions = {
      method,
      hostname,
      port,
      path,
      headers,
      family: hop.family,
      agent: false,
      lookup: pinnedLookup(hop.address, hop.family) as http.RequestOptions['lookup'],
    }
    // family 4 or 6 skips Node's happy-eyeballs lookup, so the pinned address is the only one used.
    const req = isHttps
      ? https.request({ ...base, servername: dnsName, rejectUnauthorized: true }, onResponse)
      : http.request(base, onResponse)
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('upstream timed out'))
    })
    req.on('error', (err) => fail(err))
    if (body) req.write(body)
    req.end()
  })
}

export function guardedRequest(args: {
  rawUrl: string
  mode: GuardMode
  headers: Record<string, string>
  method?: string
  body?: string
  allowHosts?: readonly string[]
  timeoutMs?: number
  maxRedirects?: number
}): Promise<GuardResult> {
  const method = args.method ?? 'GET'
  const timeoutMs = args.timeoutMs ?? 12_000
  return runGuardedExchange({
    rawUrl: args.rawUrl,
    mode: args.mode,
    headers: args.headers,
    allowHosts: args.allowHosts,
    maxRedirects: args.maxRedirects,
    resolve: resolveHost,
    exchange: (hop, headers) => exchangePinned(hop, headers, method, args.body, timeoutMs),
  })
}
