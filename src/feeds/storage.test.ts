import { beforeEach, describe, expect, it } from 'vitest'
import {
  addCustomFeed,
  DEFAULT_FEED_PREFS,
  FEEDS_KEY,
  isAllowedFeedUrl,
  loadFeedPrefs,
  normalizeFeedUrl,
  sanitizeFeedPrefs,
  saveFeedPrefs,
} from './storage'

describe('feed URL validation', () => {
  it('allows only http/https with a host', () => {
    expect(isAllowedFeedUrl('https://example.com/rss.xml')).toBe(true)
    expect(isAllowedFeedUrl('http://feeds.bbci.co.uk/news/world/rss.xml')).toBe(true)
    expect(isAllowedFeedUrl('  https://reliefweb.int/updates/rss.xml  ')).toBe(true)
    expect(isAllowedFeedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedFeedUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedFeedUrl('data:text/xml,x')).toBe(false)
    expect(isAllowedFeedUrl('ftp://example.com/feed')).toBe(false)
    expect(isAllowedFeedUrl('https://')).toBe(false)
    expect(isAllowedFeedUrl('not a url')).toBe(false)
    expect(normalizeFeedUrl('https://Example.COM/rss')).toBe('https://example.com/rss')
  })
})

describe('feed prefs persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })
  })

  it('defaults all built-ins on and no custom feeds', () => {
    expect(loadFeedPrefs()).toEqual(DEFAULT_FEED_PREFS)
    expect(FEEDS_KEY).toBe('omarchy-overwatch.feeds.v1')
  })

  it('drops invalid custom URLs and unknown schemes', () => {
    const cleaned = sanitizeFeedPrefs({
      builtinEnabled: { bbc: false, reliefweb: true },
      custom: [
        { id: 'ok', label: 'Demo', url: 'https://example.com/atom.xml', enabled: true },
        { id: 'bad', label: 'Nope', url: 'javascript:alert(1)', enabled: true },
        { id: 'dup', label: 'Dup', url: 'https://example.com/atom.xml', enabled: true },
      ],
    })
    expect(cleaned.builtinEnabled.bbc).toBe(false)
    expect(cleaned.builtinEnabled.gdacs).toBe(true)
    expect(cleaned.custom).toHaveLength(1)
    expect(cleaned.custom[0].url).toBe('https://example.com/atom.xml')
  })

  it('rejects a second add of the same URL', () => {
    const first = addCustomFeed(DEFAULT_FEED_PREFS, 'https://example.com/feed.xml', 'Example')
    if ('error' in first) throw new Error(first.error)
    const second = addCustomFeed(first, 'https://example.com/feed.xml')
    expect(second).toEqual({ error: 'Feed already added' })
    saveFeedPrefs(first)
    expect(loadFeedPrefs().custom[0].label).toBe('Example')
  })
})
