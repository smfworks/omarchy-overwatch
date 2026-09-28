import { describe, expect, it } from 'vitest'
import {
  FORWARDED_AUTH_HEADERS,
  isBlockedIp,
  isFeedUpstreamHost,
  isLoopbackIp,
  pinnedLookup,
  runGuardedExchange,
  stripProxyAuthHeaders,
  upstreamHeaders,
  vetFeedUrl,
  type ExchangeResult,
  type Hop,
  type ResolvedAddress,
} from './ssrf'

const PUBLIC = '93.184.216.34'
const OTHER = '1.1.1.1'

function publicResolver(address = PUBLIC): (host: string) => Promise<ResolvedAddress[]> {
  return async () => [{ address, family: 4 }]
}

async function run(args: {
  rawUrl: string
  mode?: 'feed' | 'brief' | 'pinned'
  headers?: Record<string, string>
  allowHosts?: string[]
  configuredHost?: string
  loopbackPort?: number
  resolve?: (host: string) => Promise<ResolvedAddress[]>
  exchange?: (hop: Hop, headers: Record<string, string>) => Promise<ExchangeResult>
}) {
  const calls: Array<{ hop: Hop; headers: Record<string, string> }> = []
  const result = await runGuardedExchange({
    rawUrl: args.rawUrl,
    mode: args.mode ?? 'feed',
    headers: args.headers ?? {
      Authorization: 'Bearer secret',
      Cookie: 'session=1',
      'X-Overwatch-Brief-Key': 'brief-key',
      'X-Api-Key': 'map-key',
      Accept: 'application/rss+xml',
    },
    allowHosts: args.allowHosts,
    configuredHost: args.configuredHost,
    loopbackPort: args.loopbackPort,
    resolve: args.resolve ?? publicResolver(),
    exchange: async (hop, headers) => {
      calls.push({ hop, headers })
      if (args.exchange) return args.exchange(hop, headers)
      return { status: 200, location: null, body: '<rss/>', contentType: 'application/rss+xml' }
    },
  })
  return { result, calls }
}

describe('feed URL policy', () => {
  it('rejects non-http(s) schemes, credentials, and empty hosts', () => {
    for (const raw of ['javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com/feed', 'gopher://example.com', 'data:text/xml,x', 'not a url', 'https://']) {
      expect(vetFeedUrl(raw).ok, raw).toBe(false)
    }
    const creds = vetFeedUrl('https://user:pass@example.com/rss.xml')
    expect(creds.ok).toBe(false)
    if (!creds.ok) expect(creds.reason).toBe('credentials')
  })

  it('rejects loopback, private, link-local, CGNAT, and obfuscated literals', () => {
    const blocked = [
      'http://127.0.0.1/',
      'http://127.0.0.1:6379/latest',
      'http://localhost/rss.xml',
      'http://[::1]/',
      'http://0.0.0.0/',
      'http://0/',
      'http://10.1.2.3/rss',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://169.254.169.254/latest/meta-data',
      'http://169.254.1.1/',
      'http://100.64.0.1/',
      'http://100.100.100.200/',
      'http://100.127.255.255/',
      'http://[fe80::1]/',
      'http://[fd00::1]/',
      'http://[fc00::1]/',
      'http://2130706433/',
      'http://0x7f000001/',
      'http://0177.0.0.1/',
      'http://127.1/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:169.254.169.254]/',
      'http://[::ffff:10.0.0.1]/',
      'http://224.0.0.1/',
      'http://255.255.255.255/',
      'http://192.0.2.1/',
      'http://198.51.100.1/',
      'http://203.0.113.5/',
      'http://198.18.0.1/',
      'https://metadata.google.internal/',
      'http://printer.local/rss',
      'http://corp.internal/rss',
      'http://intranet/',
      'http://foo.localhost/',
      'http://db.home.arpa/',
    ]
    for (const raw of blocked) {
      const verdict = vetFeedUrl(raw)
      expect(verdict.ok, raw).toBe(false)
    }
  })

  it('allows a public http(s) host and public address boundaries', () => {
    expect(vetFeedUrl('https://example.com/rss.xml').ok).toBe(true)
    expect(vetFeedUrl('http://feeds.bbci.co.uk/news/world/rss.xml').ok).toBe(true)
    expect(isBlockedIp('8.8.8.8')).toBe(false)
    expect(isBlockedIp('1.1.1.1')).toBe(false)
    expect(isBlockedIp('172.15.255.255')).toBe(false)
    expect(isBlockedIp('172.32.0.1')).toBe(false)
    expect(isBlockedIp('100.63.255.255')).toBe(false)
    expect(isBlockedIp('100.128.0.0')).toBe(false)
    expect(isBlockedIp('11.0.0.0')).toBe(false)
    expect(isBlockedIp('192.167.0.1')).toBe(false)
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false)
    expect(isBlockedIp('2001:db8::1')).toBe(true)
    expect(isBlockedIp('2002:7f00:1::')).toBe(true)
    expect(isLoopbackIp('127.8.8.8')).toBe(true)
    expect(isLoopbackIp('::1')).toBe(true)
    expect(isLoopbackIp('8.8.8.8')).toBe(false)
  })
})

describe('guarded feed fetch', () => {
  it('does not forward auth tokens and pins the resolved public address', async () => {
    const { result, calls } = await run({ rawUrl: 'https://news.example/rss.xml' })
    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].hop.address).toBe(PUBLIC)
    expect(calls[0].hop.literal).toBe(false)
    expect(calls[0].headers.Authorization).toBeUndefined()
    expect(calls[0].headers.Cookie).toBeUndefined()
    expect(calls[0].headers['X-Overwatch-Brief-Key']).toBeUndefined()
    expect(calls[0].headers['X-Api-Key']).toBeUndefined()
    expect(calls[0].headers.Accept).toBe('application/rss+xml')
    expect(FORWARDED_AUTH_HEADERS).toContain('authorization')
    expect(FORWARDED_AUTH_HEADERS).toContain('x-overwatch-brief-key')
    const removed: string[] = []
    stripProxyAuthHeaders({ removeHeader: (name) => removed.push(name) })
    expect(removed).toEqual([...FORWARDED_AUTH_HEADERS])
  })

  it('rejects a name that resolves to a private, loopback, or mixed address', async () => {
    for (const address of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '100.64.1.1', '::1', 'fe80::1']) {
      const { result, calls } = await run({
        rawUrl: 'https://rebind.example/rss.xml',
        resolve: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
      })
      expect(result.ok, address).toBe(false)
      if (!result.ok) expect(result.reason).toBe('address')
      expect(calls).toHaveLength(0)
    }
    const mixed = await run({
      rawUrl: 'https://dual.example/rss.xml',
      resolve: async () => [
        { address: PUBLIC, family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
    })
    expect(mixed.result.ok).toBe(false)
    expect(mixed.calls).toHaveLength(0)
  })

  it('re-checks redirects and refuses a hop that lands on loopback', async () => {
    const seen: string[] = []
    const { result } = await run({
      rawUrl: 'https://news.example/rss.xml',
      exchange: async (hop) => {
        seen.push(hop.url.hostname)
        if (hop.url.hostname === 'news.example') {
          return { status: 302, location: 'http://127.0.0.1:6379/secret', body: '', contentType: null }
        }
        return { status: 200, location: null, body: 'nope', contentType: 'text/plain' }
      },
    })
    expect(seen).toEqual(['news.example'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('address')
  })

  it('follows a redirect only after the next public address is pinned', async () => {
    const { result, calls } = await run({
      rawUrl: 'http://news.example/rss.xml',
      resolve: async (host) => [{ address: host === 'cdn.example' ? OTHER : PUBLIC, family: 4 }],
      exchange: async (hop) => {
        if (hop.url.hostname === 'news.example') {
          return { status: 301, location: 'https://cdn.example/feed.xml', body: '', contentType: null }
        }
        return { status: 200, location: null, body: '<rss/>', contentType: 'application/rss+xml' }
      },
    })
    expect(result.ok).toBe(true)
    expect(calls.map((call) => [call.hop.url.hostname, call.hop.address])).toEqual([
      ['news.example', PUBLIC],
      ['cdn.example', OTHER],
    ])
    expect(calls.every((call) => call.headers.Authorization === undefined)).toBe(true)
  })

  it('rejects a same-name redirect that rebinds to loopback', async () => {
    let lookups = 0
    const { result, calls } = await run({
      rawUrl: 'https://rebind.example/rss.xml',
      resolve: async () => {
        lookups += 1
        return [{ address: lookups === 1 ? PUBLIC : '127.0.0.1', family: 4 }]
      },
      exchange: async () => {
        return { status: 302, location: 'https://rebind.example/rss.xml', body: '', contentType: null }
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('address')
    expect(calls).toHaveLength(1)
    expect(calls[0].hop.address).toBe(PUBLIC)
  })

  it('pins the connect lookup to the checked address instead of resolving again', () => {
    const lookup = pinnedLookup(PUBLIC, 4)
    const single = lookup('rebind.example', {}, (err, address, family) => {
      expect(err).toBeNull()
      expect(address).toBe(PUBLIC)
      expect(family).toBe(4)
    })
    expect(single).toBeUndefined()
    lookup('rebind.example', { all: true }, (err, addresses) => {
      expect(err).toBeNull()
      expect(addresses).toEqual([{ address: PUBLIC, family: 4 }])
    })
  })
})

const OPENAI_ALLOW = ['api.openai.com', 'api.groq.com', 'llm.example']

describe('brief and credentialed token forwarding', () => {
  it('never sends a brief token to a feed host', async () => {
    expect(isFeedUpstreamHost('earthquake.usgs.gov')).toBe(true)
    expect(isFeedUpstreamHost('api.opensky-network.org')).toBe(true)
    expect(isFeedUpstreamHost('api.openai.com')).toBe(false)
    const { result, calls } = await run({
      rawUrl: 'https://earthquake.usgs.gov/v1/chat/completions',
      mode: 'brief',
      allowHosts: ['earthquake.usgs.gov', 'api.openai.com'],
      configuredHost: 'earthquake.usgs.gov',
      headers: { Authorization: 'Bearer sk-test', 'Content-Type': 'application/json' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('feed-host')
    expect(calls).toHaveLength(0)
  })

  it('sends a brief token only to the configured allowlisted host and refuses other hosts', async () => {
    const ok = await run({
      rawUrl: 'https://api.openai.com/v1/chat/completions',
      mode: 'brief',
      allowHosts: OPENAI_ALLOW,
      configuredHost: 'api.openai.com',
      headers: { Authorization: 'Bearer sk-test', 'Content-Type': 'application/json' },
    })
    expect(ok.result.ok).toBe(true)
    expect(ok.calls[0].headers.Authorization).toBe('Bearer sk-test')
    expect(ok.calls[0].headers['Content-Type']).toBe('application/json')

    const otherKnown = await run({
      rawUrl: 'https://api.groq.com/openai/v1/chat/completions',
      mode: 'brief',
      allowHosts: OPENAI_ALLOW,
      configuredHost: 'api.openai.com',
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(otherKnown.result.ok).toBe(false)
    expect(otherKnown.calls).toHaveLength(0)

    const stranger = await run({
      rawUrl: 'https://collector.example/v1/chat/completions',
      mode: 'brief',
      allowHosts: OPENAI_ALLOW,
      configuredHost: 'llm.example',
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(stranger.result.ok).toBe(false)
    expect(stranger.calls).toHaveLength(0)

    const custom = await run({
      rawUrl: 'https://llm.example/v1/chat/completions',
      mode: 'brief',
      allowHosts: OPENAI_ALLOW,
      configuredHost: 'llm.example',
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(custom.result.ok).toBe(true)
    expect(custom.calls[0].headers.Authorization).toBe('Bearer sk-test')

    const seen: string[] = []
    const redirected = await run({
      rawUrl: 'https://api.openai.com/v1/chat/completions',
      mode: 'brief',
      allowHosts: OPENAI_ALLOW,
      configuredHost: 'api.openai.com',
      headers: { Authorization: 'Bearer sk-test' },
      exchange: async (hop, headers) => {
        seen.push(`${hop.url.hostname} ${headers.Authorization ?? ''}`)
        if (hop.url.hostname === 'earthquake.usgs.gov') {
          return { status: 200, location: null, body: 'stolen', contentType: 'text/plain' }
        }
        return { status: 302, location: 'https://earthquake.usgs.gov/steal', body: '', contentType: null }
      },
    })
    expect(redirected.result.ok).toBe(false)
    if (!redirected.result.ok) expect(redirected.result.reason).toBe('redirect')
    expect(seen).toEqual(['api.openai.com Bearer sk-test'])
  })

  it('allows brief http only on the configured loopback port', async () => {
    const local = await run({
      rawUrl: 'http://127.0.0.1:11434/api/chat',
      mode: 'brief',
      allowHosts: ['127.0.0.1', 'localhost', 'api.openai.com'],
      configuredHost: '127.0.0.1',
      loopbackPort: 11434,
      headers: { 'Content-Type': 'application/json' },
    })
    expect(local.result.ok).toBe(true)
    expect(local.calls[0].hop.literal).toBe(true)
    expect(local.calls[0].hop.address).toBe('127.0.0.1')

    const otherPort = await run({
      rawUrl: 'http://127.0.0.1:9/secret',
      mode: 'brief',
      allowHosts: ['127.0.0.1', 'api.openai.com'],
      configuredHost: '127.0.0.1',
      loopbackPort: 11434,
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(otherPort.result.ok).toBe(false)
    if (!otherPort.result.ok) expect(otherPort.result.reason).toBe('address')
    expect(otherPort.calls).toHaveLength(0)

    const otherLoopback = await run({
      rawUrl: 'http://127.8.8.8:11434/secret',
      mode: 'brief',
      allowHosts: ['127.8.8.8', '127.0.0.1'],
      configuredHost: '127.8.8.8',
      loopbackPort: 11434,
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(otherLoopback.result.ok).toBe(false)
    expect(otherLoopback.calls).toHaveLength(0)

    const named = await run({
      rawUrl: 'http://localhost:11434/api/chat',
      mode: 'brief',
      allowHosts: ['localhost', 'api.openai.com'],
      configuredHost: 'localhost',
      loopbackPort: 11434,
      resolve: async () => [{ address: '127.0.0.1', family: 4 }],
      headers: {},
    })
    expect(named.result.ok).toBe(true)

    const privateNet = await run({
      rawUrl: 'https://llm.internal.example/v1/chat/completions',
      mode: 'brief',
      allowHosts: ['llm.internal.example', 'api.openai.com'],
      configuredHost: 'llm.internal.example',
      resolve: async () => [{ address: '192.168.1.20', family: 4 }],
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(privateNet.result.ok).toBe(false)
    expect(privateNet.calls).toHaveLength(0)
  })

  it('sends a pinned credential only to the allowlisted host', () => {
    const opensky = upstreamHeaders(
      'pinned',
      'opensky-network.org',
      { Authorization: 'Bearer opensky', Accept: 'application/json' },
      ['opensky-network.org'],
    )
    expect(opensky.Authorization).toBe('Bearer opensky')
    const redirected = upstreamHeaders(
      'pinned',
      'collector.example',
      { Authorization: 'Bearer opensky', Accept: 'application/json' },
      ['opensky-network.org'],
    )
    expect(redirected.Authorization).toBeUndefined()
    expect(redirected.Accept).toBe('application/json')
    const feed = upstreamHeaders('feed', 'example.com', { Authorization: 'Bearer secret', Accept: 'application/xml' })
    expect(feed.Authorization).toBeUndefined()
  })

  it('does not use a pinned credential on a redirect to another host', async () => {
    const { result, calls } = await run({
      rawUrl: 'https://opensky-network.org/api/states/all',
      mode: 'pinned',
      allowHosts: ['opensky-network.org'],
      headers: { Authorization: 'Bearer opensky', Accept: 'application/json' },
      resolve: async (host) => [{ address: host === 'opensky-network.org' ? PUBLIC : OTHER, family: 4 }],
      exchange: async (hop) => {
        if (hop.url.hostname === 'opensky-network.org') {
          return { status: 302, location: 'https://collector.example/states', body: '', contentType: null }
        }
        return { status: 200, location: null, body: '{}', contentType: 'application/json' }
      },
    })
    expect(result.ok).toBe(true)
    expect(calls[0].headers.Authorization).toBe('Bearer opensky')
    expect(calls[1].hop.url.hostname).toBe('collector.example')
    expect(calls[1].headers.Authorization).toBeUndefined()
  })
})
