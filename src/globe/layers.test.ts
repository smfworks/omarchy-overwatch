import { describe, expect, it } from 'vitest'
import { classifyStatus } from './layers'

describe('layer status', () => {
  it('maps enabled/error/freshness honestly', () => {
    expect(classifyStatus({ enabled: false, updatedAt: null, error: null, points: [] })).toBe('off')
    expect(classifyStatus({ enabled: true, updatedAt: null, error: null, points: [] })).toBe('loading')
    expect(classifyStatus({ enabled: true, updatedAt: null, error: 'HTTP 403', points: [] })).toBe('err')
    expect(classifyStatus({ enabled: true, updatedAt: Date.now(), error: 'HTTP 403', points: [] })).toBe('stale')
    expect(classifyStatus({ enabled: true, updatedAt: Date.now(), error: null, points: [] })).toBe('live')
    expect(
      classifyStatus({ enabled: true, updatedAt: Date.now() - 20 * 60 * 1000, error: null, points: [] }),
    ).toBe('stale')
  })
})
