/**
 * SSRF policy for server-side fetches.
 *
 * Feed fetches may only use public http(s). Loopback, link-local, private,
 * CGNAT, and other non-routable addresses are rejected, including when they
 * appear after a redirect or as one address in a DNS answer. Callers pin the
 * connection to the address that passed this check so a later lookup cannot
 * rebind the name.
 *
 * Authorization is never attached to feed-proxy requests. A brief API key is
 * not sent to known feed hosts. A credentialed upstream (OpenSky) keeps its
 * own token only while the hop host is on that call's allowlist.
 */

export type IpFamily = 4 | 6

export interface ResolvedAddress {
  address: string
  family: IpFamily
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>

export type DenyReason = 'scheme' | 'credentials' | 'host' | 'address' | 'feed-host' | 'dns' | 'redirect'

export interface Deny {
  ok: false
  status: number
  reason: DenyReason
  error: string
}

export interface Hop {
  url: URL
  address: string
  family: IpFamily
  /** URL host is already an IP literal, so the connection must not consult DNS. */
  literal: boolean
}

export interface ExchangeResult {
  status: number
  location: string | null
  body: string
  contentType: string | null
}

export type GuardMode = 'feed' | 'brief' | 'pinned'

export interface GuardSuccess {
  ok: true
  status: number
  body: string
  contentType: string
}

export type GuardResult = GuardSuccess | Deny

/** Headers a browser or client must not have forwarded to an upstream feed. */
export const FORWARDED_AUTH_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'cookie2',
  'x-overwatch-brief-key',
  'x-api-key',
] as const

const FEED_BLOCK_ERROR =
  'Only public http/https URLs are allowed. Private, loopback, link-local, and non-http(s) targets are rejected. Nothing was invented.'

const FEED_HOSTS = [
  'earthquake.usgs.gov',
  'eonet.gsfc.nasa.gov',
  'feeds.bbci.co.uk',
  'reliefweb.int',
  'www.gdacs.org',
  'gdacs.org',
  'api.weather.gov',
  'firms.modaps.eosdis.nasa.gov',
  'api.rainviewer.com',
  'celestrak.org',
  'www.nhc.noaa.gov',
  'nhc.noaa.gov',
  'services3.arcgis.com',
  'api.reliefweb.int',
  'opensky-network.org',
  'auth.opensky-network.org',
  'stream.aisstream.io',
  'aisstream.io',
] as const

const NAME_SUFFIXES = [
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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function deny(reason: DenyReason, error: string, status = reason === 'dns' || reason === 'redirect' ? 502 : 400): Deny {
  return { ok: false, status, reason, error }
}

export function normalizeHost(hostname: string): string {
  let host = hostname.trim().toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  const zone = host.indexOf('%')
  if (zone !== -1) host = host.slice(0, zone)
  while (host.endsWith('.')) host = host.slice(0, -1)
  return host
}

export function isFeedUpstreamHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  return FEED_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))
}

export function stripProxyAuthHeaders(req: { removeHeader: (name: string) => void }): void {
  for (const name of FORWARDED_AUTH_HEADERS) req.removeHeader(name)
}

function v4(a: number, b: number, c: number, d: number): number {
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0)
}

function inCidr(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ip & mask) === (base & mask)
}

function parseIpv4(host: string): number | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    octets.push(n)
  }
  return v4(octets[0], octets[1], octets[2], octets[3])
}

function parseIpv6(host: string): Uint8Array | null {
  let text = normalizeHost(host)
  if (!text.includes(':')) return null
  const lastColon = text.lastIndexOf(':')
  if (text.includes('.')) {
    const v4 = parseIpv4(text.slice(lastColon + 1))
    if (v4 === null) return null
    const hi = (v4 >>> 16) & 0xffff
    const lo = v4 & 0xffff
    text = `${text.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const parseGroups = (value: string): string[] | null => {
    if (!value) return []
    const groups = value.split(':')
    if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null
    return groups
  }
  const head = parseGroups(halves[0] ?? '')
  if (!head) return null
  const tail = halves.length === 2 ? parseGroups(halves[1] ?? '') : []
  if (!tail) return null
  if (halves.length === 1 && head.length !== 8) return null
  if (halves.length === 2 && head.length + tail.length > 7) return null
  const groups = [...head]
  if (halves.length === 2) {
    for (let i = 0; i < 8 - head.length - tail.length; i += 1) groups.push('0')
    groups.push(...tail)
  }
  if (groups.length !== 8) return null
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 8; i += 1) {
    const n = Number.parseInt(groups[i], 16)
    bytes[i * 2] = n >> 8
    bytes[i * 2 + 1] = n & 0xff
  }
  return bytes
}

function prefix(bytes: Uint8Array, bits: number, expected: number[]): boolean {
  const full = Math.floor(bits / 8)
  const rem = bits % 8
  for (let i = 0; i < full; i += 1) {
    if (bytes[i] !== expected[i]) return false
  }
  if (!rem) return true
  const mask = (0xff << (8 - rem)) & 0xff
  return (bytes[full] & mask) === ((expected[full] ?? 0) & mask)
}

function embeddedV4(bytes: Uint8Array): number {
  return v4(bytes[12], bytes[13], bytes[14], bytes[15])
}

function isV4Mapped(bytes: Uint8Array): boolean {
  for (let i = 0; i < 10; i += 1) if (bytes[i] !== 0) return false
  return bytes[10] === 0xff && bytes[11] === 0xff
}

function isIpv4Blocked(ip: number): boolean {
  const ranges: Array<[number, number]> = [
    [v4(0, 0, 0, 0), 8],
    [v4(10, 0, 0, 0), 8],
    [v4(100, 64, 0, 0), 10],
    [v4(127, 0, 0, 0), 8],
    [v4(169, 254, 0, 0), 16],
    [v4(172, 16, 0, 0), 12],
    [v4(192, 0, 0, 0), 24],
    [v4(192, 0, 2, 0), 24],
    [v4(192, 88, 99, 0), 24],
    [v4(192, 168, 0, 0), 16],
    [v4(198, 18, 0, 0), 15],
    [v4(198, 51, 100, 0), 24],
    [v4(203, 0, 113, 0), 24],
    [v4(224, 0, 0, 0), 4],
    [v4(240, 0, 0, 0), 4],
  ]
  return ranges.some(([base, bits]) => inCidr(ip, base, bits))
}

function isIpv6Blocked(bytes: Uint8Array): boolean {
  const allZero = bytes.every((b) => b === 0)
  const loopback = bytes[15] === 1 && bytes.slice(0, 15).every((b) => b === 0)
  if (allZero || loopback) return true
  if (isV4Mapped(bytes)) return isIpv4Blocked(embeddedV4(bytes))
  if (prefix(bytes, 96, [0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0])) return true
  if (prefix(bytes, 48, [0x00, 0x64, 0xff, 0x9b, 0x00, 0x01])) return true
  if (prefix(bytes, 16, [0x20, 0x02])) return true
  if (prefix(bytes, 32, [0x20, 0x01, 0x00, 0x00])) return true
  if (prefix(bytes, 32, [0x20, 0x01, 0x0d, 0xb8])) return true
  if (prefix(bytes, 64, [0x01, 0x00, 0, 0, 0, 0, 0, 0])) return true
  if ((bytes[0] & 0xfe) === 0xfc) return true
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true
  if (bytes[0] === 0xff) return true
  const v4Compatible = bytes.slice(0, 12).every((b) => b === 0)
  if (v4Compatible) return isIpv4Blocked(embeddedV4(bytes))
  return false
}

export function isBlockedIp(address: string): boolean {
  const host = normalizeHost(address)
  const v4n = parseIpv4(host)
  if (v4n !== null) return isIpv4Blocked(v4n)
  const v6 = parseIpv6(host)
  if (!v6) return false
  return isIpv6Blocked(v6)
}

export function isLoopbackIp(address: string): boolean {
  const host = normalizeHost(address)
  const v4n = parseIpv4(host)
  if (v4n !== null) return inCidr(v4n, v4(127, 0, 0, 0), 8)
  const v6 = parseIpv6(host)
  if (!v6) return false
  if (v6[15] === 1 && v6.slice(0, 15).every((b) => b === 0)) return true
  if (isV4Mapped(v6)) return inCidr(embeddedV4(v6), v4(127, 0, 0, 0), 8)
  return false
}

export function isIpAddress(address: string): boolean {
  const host = normalizeHost(address)
  return parseIpv4(host) !== null || parseIpv6(host) !== null
}

function nameDenied(host: string, policy: 'feed' | 'brief'): boolean {
  if (!host) return true
  if (isIpAddress(host)) return false
  if (host === 'metadata.google.internal' || host === 'metadata.goog') return true
  if (host.endsWith('.svc.cluster.local') || host.endsWith('.cluster.local')) return true
  if (NAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
  if (host === 'localhost' || host === 'localhost.localdomain') return policy === 'feed'
  if (!host.includes('.')) return true
  return false
}

function selectAddress(addrs: ResolvedAddress[], policy: 'feed' | 'brief'): ResolvedAddress | null {
  if (!addrs.length || addrs.some((item) => !isIpAddress(item.address))) return null
  if (policy === 'brief') {
    const allLoopback = addrs.every((item) => isLoopbackIp(item.address))
    const allPublic = addrs.every((item) => !isBlockedIp(item.address))
    if (allLoopback || allPublic) return addrs[0]
    return null
  }
  if (addrs.some((item) => isBlockedIp(item.address))) return null
  return addrs[0]
}

export function parseHttpUrl(raw: string): { ok: true; url: URL } | Deny {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return deny('scheme', FEED_BLOCK_ERROR)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return deny('scheme', FEED_BLOCK_ERROR)
  if (url.username || url.password) return deny('credentials', FEED_BLOCK_ERROR)
  const host = normalizeHost(url.hostname)
  if (!host) return deny('host', FEED_BLOCK_ERROR)
  if (url.port) {
    const port = Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return deny('host', FEED_BLOCK_ERROR)
  }
  return { ok: true, url }
}

/** Browser-side and structural check. DNS pinning happens on the server. */
export function vetFeedUrl(raw: string): { ok: true; url: URL } | Deny {
  const parsed = parseHttpUrl(raw)
  if (!parsed.ok) return parsed
  const host = normalizeHost(parsed.url.hostname)
  if (nameDenied(host, 'feed') || (isIpAddress(host) && isBlockedIp(host))) {
    return deny('address', FEED_BLOCK_ERROR)
  }
  return parsed
}

export async function planHop(
  url: URL,
  policy: 'feed' | 'brief',
  resolve: Resolver,
  allowHosts?: readonly string[],
): Promise<{ ok: true; hop: Hop } | Deny> {
  const parsed = parseHttpUrl(url.href)
  if (!parsed.ok) return parsed
  const host = normalizeHost(parsed.url.hostname)
  if (allowHosts && !allowHosts.includes(host)) {
    return deny('host', FEED_BLOCK_ERROR)
  }
  if (policy === 'brief' && isFeedUpstreamHost(host)) {
    return deny('feed-host', 'BRIEF ERR — API key is not sent to feed hosts.')
  }
  if (nameDenied(host, policy)) return deny('address', FEED_BLOCK_ERROR)

  if (isIpAddress(host)) {
    const family: IpFamily = parseIpv4(host) !== null ? 4 : 6
    const selected = selectAddress([{ address: host, family }], policy)
    if (!selected) return deny('address', FEED_BLOCK_ERROR)
    return { ok: true, hop: { url: parsed.url, address: host, family, literal: true } }
  }

  let addrs: ResolvedAddress[]
  try {
    addrs = await resolve(host)
  } catch {
    return deny('dns', 'Host could not be resolved. Nothing was invented.')
  }
  const selected = selectAddress(addrs, policy)
  if (!selected) {
    if (!addrs.length) return deny('dns', 'Host could not be resolved. Nothing was invented.')
    return deny('address', FEED_BLOCK_ERROR)
  }
  return {
    ok: true,
    hop: { url: parsed.url, address: selected.address, family: selected.family, literal: false },
  }
}

/**
 * DNS lookup callback that ignores the live resolver and returns the address
 * already accepted by {@link planHop}. Node calls this with `all: true` when
 * auto-select is on, and with `(err, address, family)` otherwise.
 */
type LooseLookupCallback = (
  err: Error | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void

export function pinnedLookup(address: string, family: IpFamily) {
  return (
    _hostname: string,
    optionsOrCallback: { all?: boolean } | LooseLookupCallback,
    maybeCallback?: LooseLookupCallback,
  ) => {
    const all = typeof optionsOrCallback === 'object' && Boolean(optionsOrCallback.all)
    const callback: LooseLookupCallback | undefined =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
    if (!callback) return
    if (all) {
      callback(null, [{ address, family }])
      return
    }
    callback(null, address, family)
  }
}

export function upstreamHeaders(
  mode: GuardMode,
  hopHost: string,
  headers: Record<string, string>,
  allowHosts?: readonly string[],
): Record<string, string> {
  const host = normalizeHost(hopHost)
  const keepAuthorization =
    mode === 'pinned'
      ? Boolean(allowHosts?.includes(host))
      : mode === 'brief' && !isFeedUpstreamHost(host)
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase()
    if (name === 'host') continue
    if ((FORWARDED_AUTH_HEADERS as readonly string[]).includes(name)) {
      if (name === 'authorization' && keepAuthorization) out[key] = value
      continue
    }
    out[key] = value
  }
  return out
}

function isRedirect(status: number): boolean {
  return REDIRECT_STATUSES.has(status)
}

export function resolveRedirect(current: URL, location: string): URL | null {
  try {
    return new URL(location, current)
  } catch {
    return null
  }
}

export async function runGuardedExchange(args: {
  rawUrl: string
  mode: GuardMode
  headers: Record<string, string>
  resolve: Resolver
  exchange: (hop: Hop, headers: Record<string, string>) => Promise<ExchangeResult>
  allowHosts?: readonly string[]
  maxRedirects?: number
}): Promise<GuardResult> {
  const parsed = parseHttpUrl(args.rawUrl)
  if (!parsed.ok) return parsed
  const maxRedirects = args.maxRedirects ?? 5
  let current = parsed.url
  for (let hopIndex = 0; hopIndex <= maxRedirects; hopIndex += 1) {
    const policy = args.mode === 'brief' ? 'brief' : 'feed'
    const allowHosts = args.mode === 'pinned' && hopIndex === 0 ? args.allowHosts : undefined
    if (args.mode === 'pinned' && hopIndex === 0 && !args.allowHosts?.length) {
      return deny('host', FEED_BLOCK_ERROR)
    }
    const planned = await planHop(current, policy, args.resolve, allowHosts)
    if (!planned.ok) return planned
    const headers = upstreamHeaders(args.mode, planned.hop.url.hostname, args.headers, args.allowHosts)
    const response = await args.exchange(planned.hop, headers)
    if (!isRedirect(response.status)) {
      return {
        ok: true,
        status: response.status,
        body: response.body,
        contentType: response.contentType || 'application/octet-stream',
      }
    }
    if (args.mode === 'brief') {
      return deny(
        'redirect',
        'BRIEF ERR — upstream redirect was refused so the API key stays on the configured host.',
      )
    }
    if (hopIndex === maxRedirects) return deny('redirect', 'Too many redirects. Nothing was invented.')
    if (!response.location) return deny('redirect', 'Redirect was missing a location. Nothing was invented.')
    const next = resolveRedirect(current, response.location)
    if (!next) return deny('redirect', FEED_BLOCK_ERROR)
    current = next
  }
  return deny('redirect', 'Too many redirects. Nothing was invented.')
}
