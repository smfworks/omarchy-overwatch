import { describe, expect, it } from 'vitest'
import { classifyFeedStatus } from './rss'

describe('feed status honesty', () => {
  it('maps enabled/error/freshness without inventing headlines', () => {
    expect(classifyFeedStatus({ enabled: false, error: null, updatedAt: null, itemCount: 0 })).toBe('off')
    expect(classifyFeedStatus({ enabled: true, error: null, updatedAt: null, itemCount: 0 })).toBe('loading')
    expect(classifyFeedStatus({ enabled: true, error: 'HTTP 502', updatedAt: null, itemCount: 0 })).toBe('err')
    expect(classifyFeedStatus({ enabled: true, error: 'HTTP 502', updatedAt: Date.now(), itemCount: 3 })).toBe('stale')
    expect(classifyFeedStatus({ enabled: true, error: null, updatedAt: Date.now(), itemCount: 0 })).toBe('empty')
    expect(classifyFeedStatus({ enabled: true, error: null, updatedAt: Date.now(), itemCount: 4 })).toBe('live')
    expect(
      classifyFeedStatus({
        enabled: true,
        error: null,
        updatedAt: Date.now() - 20 * 60 * 1000,
        itemCount: 4,
      }),
    ).toBe('stale')
  })
})
