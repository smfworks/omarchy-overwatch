import http from 'node:http'
import type { AddressInfo } from 'node:net'
import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeUpstreamBody, exchangePinned, guardedRequest } from './vite.guarded-fetch'

describe('upstream body limit', () => {
  it('rejects a gzip bomb at the decompressed-size cap', () => {
    const bomb = zlib.gzipSync(Buffer.alloc(1_000_000, 0x61))
    expect(bomb.length).toBeLessThan(64_000)
    expect(() => decodeUpstreamBody(bomb, 'gzip', 64_000)).toThrow(/size limit/)
    const small = zlib.gzipSync(Buffer.from('ok'))
    expect(decodeUpstreamBody(small, 'gzip', 64_000).toString('utf8')).toBe('ok')
  })
})

describe('pinned upstream transport', () => {
  it('rejects loopback and feed-host targets before opening a socket', async () => {
    const loopback = await guardedRequest({
      rawUrl: 'http://127.0.0.1:9/secret',
      mode: 'feed',
      headers: { Authorization: 'Bearer secret' },
      timeoutMs: 500,
    })
    expect(loopback.ok).toBe(false)
    if (!loopback.ok) expect(loopback.reason).toBe('address')

    const feedHost = await guardedRequest({
      rawUrl: 'https://earthquake.usgs.gov/v1/chat/completions',
      mode: 'brief',
      allowHosts: ['earthquake.usgs.gov'],
      configuredHost: 'earthquake.usgs.gov',
      headers: { Authorization: 'Bearer sk-test' },
      timeoutMs: 500,
    })
    expect(feedHost.ok).toBe(false)
    if (!feedHost.ok) expect(feedHost.reason).toBe('feed-host')
  })

  it('connects to the pinned address and keeps the original host header', async () => {
    const seen: Array<Record<string, string | string[] | undefined>> = []
    const server = http.createServer((req, res) => {
      seen.push(req.headers)
      res.setHeader('content-type', 'text/plain')
      res.end('pinned-ok')
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const port = (server.address() as AddressInfo).port
    try {
      const result = await exchangePinned(
        {
          url: new URL(`http://news.example:${port}/rss.xml`),
          address: '127.0.0.1',
          family: 4,
          literal: false,
        },
        { Accept: 'application/rss+xml', Authorization: 'Bearer should-be-stripped-by-caller' },
        'GET',
        undefined,
        2000,
      )
      expect(result.status).toBe(200)
      expect(result.body).toBe('pinned-ok')
      expect(seen[0]?.host).toBe(`news.example:${port}`)
      expect(String(seen[0]?.authorization)).toBe('Bearer should-be-stripped-by-caller')
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  })
})
