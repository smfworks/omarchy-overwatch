/**
 * Host and Origin check for the dev/preview proxy middleware.
 * Vite's allowedHosts middleware can run after these handlers, and it allows
 * every IP literal. Callers must be loopback, or a name listed in allowedHosts.
 */

export type AllowedDevHosts = readonly string[] | true

const LOOPBACK_NAMES = new Set(['127.0.0.1', 'localhost', '::1'])

export function authorityHostname(authority: string): string | null {
  const value = authority.trim()
  if (!value) return null
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    if (end <= 1) return null
    const rest = value.slice(end + 1)
    if (rest && !/^:\d+$/.test(rest)) return null
    return value.slice(1, end).toLowerCase()
  }
  const colon = value.lastIndexOf(':')
  if (colon > 0 && value.indexOf(':') === colon) {
    const host = value.slice(0, colon)
    const port = value.slice(colon + 1)
    if (!host || !/^\d+$/.test(port)) return null
    return host.toLowerCase()
  }
  if (value.includes(':')) return null
  return value.toLowerCase()
}

export function isAllowedDevHostname(hostname: string, allowedHosts: AllowedDevHosts): boolean {
  if (allowedHosts === true) return true
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return false
  if (LOOPBACK_NAMES.has(host)) return true
  for (const entry of allowedHosts) {
    const allowed = entry.trim().toLowerCase()
    if (!allowed) continue
    if (allowed.startsWith('.')) {
      const suffix = allowed.slice(1)
      if (suffix && (host === suffix || host.endsWith(`.${suffix}`))) return true
    } else if (host === allowed) return true
  }
  return false
}

function originHostname(origin: string): string | null {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return null
  }
}

export function isAllowedProxyRequest(args: {
  hostHeader: string | undefined
  originHeader: string | undefined
  allowedHosts: AllowedDevHosts
}): boolean {
  if (!args.hostHeader) return false
  const host = authorityHostname(args.hostHeader)
  if (!host || !isAllowedDevHostname(host, args.allowedHosts)) return false
  if (args.originHeader === undefined) return true
  const origin = originHostname(args.originHeader.trim())
  if (!origin || !isAllowedDevHostname(origin, args.allowedHosts)) return false
  return true
}

export type HeaderMap = Record<string, string | string[] | undefined>

export function headerValue(headers: HeaderMap | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const raw = headers[name] ?? headers[name.toLowerCase()]
  if (raw === undefined) return undefined
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === undefined ? undefined : value
}

export function proxyCallerAllowed(headers: HeaderMap | undefined, allowedHosts: AllowedDevHosts): boolean {
  return isAllowedProxyRequest({
    hostHeader: headerValue(headers, 'host'),
    originHeader: headerValue(headers, 'origin'),
    allowedHosts,
  })
}

export const PROXY_CALLER_ERROR =
  'This proxy only accepts Host and Origin of 127.0.0.1, localhost, [::1], or a configured allowedHost. Nothing was fetched.'
