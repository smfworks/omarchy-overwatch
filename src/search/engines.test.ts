import { describe, expect, it } from 'vitest'
import { engineSearchUrl, engineSupportsQuery, toolLaunchUrl } from './engines'

describe('engine search URLs', () => {
  it('builds an https query URL and encodes the query', () => {
    expect(engineSearchUrl('google', 'site:example.com osint')).toBe(
      'https://www.google.com/search?q=site%3Aexample.com%20osint',
    )
    expect(engineSearchUrl('duckduckgo', 'hormuz')).toBe('https://duckduckgo.com/?q=hormuz')
    expect(engineSearchUrl('yandex', 'kyiv')).toBe('https://yandex.com/search/?text=kyiv')
    expect(engineSearchUrl('startpage', 'maps')).toBe('https://www.startpage.com/sp/search?query=maps')
    expect(engineSearchUrl('wolfram-alpha', '1+1')).toBe('https://www.wolframalpha.com/input?i=1%2B1')
  })

  it('does not invent a query URL for directory-only engines or an empty query', () => {
    expect(engineSupportsQuery('searx-space')).toBe(false)
    expect(engineSearchUrl('searx-space', 'news')).toBeNull()
    expect(engineSearchUrl('inteltechniques', 'email')).toBeNull()
    expect(engineSearchUrl('google', '   ')).toBeNull()
    expect(engineSearchUrl('not-a-tool', 'query')).toBeNull()
  })

  it('keeps non-search catalog URLs unchanged', () => {
    const shodan = { id: 'shodan', url: 'https://www.shodan.io/' }
    expect(toolLaunchUrl(shodan, { query: 'apache' })).toEqual({
      href: 'https://www.shodan.io/',
      queried: false,
    })
    expect(toolLaunchUrl({ id: 'google', url: 'https://www.google.com/' }, { query: 'osint' })).toEqual({
      href: 'https://www.google.com/search?q=osint',
      queried: true,
    })
  })
})
