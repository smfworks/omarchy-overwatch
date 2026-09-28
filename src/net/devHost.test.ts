import { describe, expect, it } from 'vitest'
import { isAllowedProxyRequest, proxyCallerAllowed } from './devHost'

describe('proxy Host and Origin check', () => {
  it('allows loopback names and rejects other hosts', () => {
    expect(isAllowedProxyRequest({ hostHeader: '127.0.0.1:5173', originHeader: undefined, allowedHosts: [] })).toBe(true)
    expect(isAllowedProxyRequest({ hostHeader: 'localhost:4173', originHeader: 'http://localhost:4173', allowedHosts: [] })).toBe(true)
    expect(isAllowedProxyRequest({ hostHeader: '[::1]:5173', originHeader: 'http://[::1]:5173', allowedHosts: [] })).toBe(true)
    expect(isAllowedProxyRequest({ hostHeader: 'evil.example', originHeader: undefined, allowedHosts: [] })).toBe(false)
    expect(isAllowedProxyRequest({ hostHeader: '10.1.2.3:5173', originHeader: undefined, allowedHosts: [] })).toBe(false)
    expect(isAllowedProxyRequest({ hostHeader: undefined, originHeader: undefined, allowedHosts: [] })).toBe(false)
  })

  it('rejects a foreign Origin even when Host is loopback', () => {
    expect(
      isAllowedProxyRequest({
        hostHeader: '127.0.0.1:5173',
        originHeader: 'http://evil.example',
        allowedHosts: [],
      }),
    ).toBe(false)
    expect(
      isAllowedProxyRequest({
        hostHeader: '127.0.0.1:5173',
        originHeader: 'http://127.0.0.1:5173',
        allowedHosts: [],
      }),
    ).toBe(true)
    expect(
      isAllowedProxyRequest({
        hostHeader: '127.0.0.1:5173',
        originHeader: 'null',
        allowedHosts: [],
      }),
    ).toBe(false)
  })

  it('honors configured allowedHosts, including a leading-dot suffix', () => {
    expect(
      isAllowedProxyRequest({
        hostHeader: 'hud.tailnet.ts.net',
        originHeader: 'http://hud.tailnet.ts.net:5173',
        allowedHosts: ['hud.tailnet.ts.net'],
      }),
    ).toBe(true)
    expect(
      isAllowedProxyRequest({
        hostHeader: 'a.example.com',
        originHeader: undefined,
        allowedHosts: ['.example.com'],
      }),
    ).toBe(true)
    expect(
      proxyCallerAllowed({ host: 'evil.example', origin: 'http://evil.example' }, ['hud.tailnet.ts.net']),
    ).toBe(false)
  })
})
