import { afterEach, describe, expect, it } from 'vitest'
import { openExternal } from './openExternal'

interface ClickRecord {
  href: string
  target: string
  rel: string
  referrerPolicy: string
  hidden: boolean
}

interface OpenCall {
  url: string
  target: string | undefined
}

interface FakePopup {
  closed: boolean
  opener: unknown
  location: { href: string }
}

function install(opts: {
  open: (url: string, target: string | undefined) => FakePopup | null
  body?: boolean
  clickThrows?: boolean
}) {
  const clicks: ClickRecord[] = []
  const calls: OpenCall[] = []
  const order: string[] = []
  const popups: FakePopup[] = []

  const anchor = {
    href: '',
    target: '',
    rel: '',
    referrerPolicy: '',
    hidden: false,
    tabIndex: 0,
    setAttribute() {},
    click() {
      order.push('click')
      if (opts.clickThrows) throw new Error('click failed')
      clicks.push({
        href: anchor.href,
        target: anchor.target,
        rel: anchor.rel,
        referrerPolicy: anchor.referrerPolicy,
        hidden: anchor.hidden,
      })
    },
    remove() {
      order.push('remove')
    },
  }

  const documentStub = {
    body: opts.body === false ? null : {
      appendChild() {
        order.push('append')
      },
    },
    createElement(tag: string) {
      if (tag !== 'a') throw new Error(tag)
      return anchor
    },
  }

  const windowStub = {
    open(url?: string | URL, target?: string) {
      const href = String(url ?? '')
      calls.push({ url: href, target })
      order.push(`open:${href || 'empty'}`)
      const popup = opts.open(href, target)
      if (popup) popups.push(popup)
      return popup
    },
  }

  const previous = {
    document: globalThis.document,
    window: globalThis.window,
  }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentStub })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowStub })

  return {
    clicks,
    calls,
    order,
    popups,
    restore() {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: previous.document })
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previous.window })
    },
  }
}

function popup(href = 'about:blank'): FakePopup {
  return { closed: false, opener: {}, location: { href } }
}

describe('openExternal', () => {
  let restore: (() => void) | undefined
  afterEach(() => restore?.())

  it('clicks a no-referrer anchor before falling back to window.open', () => {
    const env = install({
      open: (url) => (url === '' ? popup('about:blank') : null),
    })
    restore = env.restore

    expect(openExternal('https://duckduckgo.com/?q=osint')).toBe(true)
    expect(env.clicks).toHaveLength(1)
    expect(env.clicks[0]?.href).toBe('https://duckduckgo.com/?q=osint')
    expect(env.clicks[0]?.target.startsWith('overwatch-')).toBe(true)
    expect(env.clicks[0]?.referrerPolicy).toBe('no-referrer')
    expect(env.clicks[0]?.rel).not.toMatch(/noopener|noreferrer/)
    expect(env.clicks[0]?.hidden).toBe(true)
    expect(env.order.slice(0, 4)).toEqual(['append', 'click', 'remove', 'open:empty'])
    expect(env.calls.some((call) => call.url.startsWith('https://'))).toBe(false)
    expect(env.popups[0]?.opener).toBeNull()
  })

  it('uses window.open when the anchor context is blocked', () => {
    const env = install({
      open: (url) => (url.startsWith('https://') ? popup(url) : null),
    })
    restore = env.restore

    expect(openExternal('https://www.google.com/search?q=catalog')).toBe(true)
    expect(env.clicks).toHaveLength(1)
    expect(env.calls.map((call) => call.url)).toEqual(['', 'https://www.google.com/search?q=catalog'])
    expect(env.popups[0]?.opener).toBeNull()
  })

  it('returns false and still attempted the anchor when every open is blocked', () => {
    const env = install({ open: () => null })
    restore = env.restore

    expect(openExternal('https://search.brave.com/search?q=public')).toBe(false)
    expect(env.clicks).toHaveLength(1)
    expect(env.calls.map((call) => call.target)).toEqual([
      env.clicks[0]?.target,
      '_blank',
    ])
  })

  it('falls back to window.open when the anchor cannot be clicked', () => {
    const env = install({
      body: false,
      open: (url) => popup(url),
    })
    restore = env.restore

    expect(openExternal('http://example.com/tool')).toBe(true)
    expect(env.clicks).toHaveLength(0)
    expect(env.calls).toEqual([{ url: 'http://example.com/tool', target: '_blank' }])
  })

  it('falls back to window.open when click throws', () => {
    const env = install({
      clickThrows: true,
      open: (url) => (url.startsWith('https://') ? popup(url) : null),
    })
    restore = env.restore

    expect(openExternal('https://yandex.com/search/?text=kyiv')).toBe(true)
    expect(env.calls).toEqual([{ url: 'https://yandex.com/search/?text=kyiv', target: '_blank' }])
  })

  it('does not open javascript or other non-http URLs', () => {
    const env = install({ open: () => popup() })
    restore = env.restore

    expect(openExternal('javascript:alert(1)')).toBe(false)
    expect(openExternal('data:text/html,hi')).toBe(false)
    expect(openExternal('')).toBe(false)
    expect(openExternal('not a url')).toBe(false)
    expect(env.clicks).toHaveLength(0)
    expect(env.calls).toHaveLength(0)
  })

  it('treats a closed popup as a failed open', () => {
    const env = install({
      open: () => ({ closed: true, opener: {}, location: { href: 'about:blank' } }),
    })
    restore = env.restore

    expect(openExternal('https://www.mojeek.com/search?q=osint')).toBe(false)
  })
})
