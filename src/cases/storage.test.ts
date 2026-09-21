import { describe, expect, it, beforeEach } from 'vitest'
import { renderNotesPreview } from './markdown'
import {
  addPin,
  createEmptyCase,
  exportCaseJson,
  importCaseJson,
  loadCases,
  sanitizeCase,
  sanitizeStore,
  saveCases,
} from './storage'
import { CASES_KEY } from './types'

function mockStorage() {
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
  return store
}

describe('case notes storage', () => {
  beforeEach(() => {
    mockStorage()
  })

  it('starts empty and never auto-fills intelligence', () => {
    const created = createEmptyCase()
    expect(created.notes).toBe('')
    expect(created.pins).toEqual([])
    expect(created.name).toBe('Untitled case')
    expect(loadCases()).toEqual({ version: 1, activeId: null, cases: [] })
  })

  it('drops invalid pins and unknown store versions', () => {
    const record = sanitizeCase({
      id: 'case-1',
      name: '  Hormuz watch  ',
      notes: 'operator text',
      pins: [
        { type: 'tool', id: 'marinetraffic', label: 'MarineTraffic', url: 'https://www.marinetraffic.com/' },
        { type: 'tool', id: 'bad', label: 'no url' },
        { type: 'point', id: 'ais-1', label: 'ghost ship', lat: 999, lng: 0, kind: 'vessel' },
        { type: 'hotspot', id: 'suez', label: 'Suez Canal', lat: 30.58, lng: 32.26 },
        {
          type: 'ticker',
          id: 'bbc-1',
          label: 'Public headline',
          url: 'https://www.bbc.com/news',
          source: 'BBC',
        },
        { type: 'ticker', id: 'bad', label: 'no url', source: 'x' },
      ],
    })
    expect(record?.name).toBe('Hormuz watch')
    expect(record?.pins).toHaveLength(3)
    expect(record?.pins.some((p) => p.type === 'ticker' && p.label === 'Public headline')).toBe(true)
    expect(sanitizeStore({ version: 2, cases: [record] })).toEqual({ version: 1, activeId: null, cases: [] })
  })

  it('round-trips export/import without inventing notes or pins', () => {
    const original = addPin(createEmptyCase('Strait notes'), {
      type: 'hotspot',
      id: 'strait-of-hormuz',
      label: 'Strait of Hormuz',
      lat: 26.5667,
      lng: 56.25,
    })
    original.notes = 'Check public AIS — no claims.'
    const json = exportCaseJson(original)
    const imported = importCaseJson(json)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.record.id).not.toBe(original.id)
    expect(imported.record.name).toBe('Strait notes')
    expect(imported.record.notes).toBe('Check public AIS — no claims.')
    expect(imported.record.pins).toHaveLength(1)
    saveCases({ version: 1, activeId: imported.record.id, cases: [imported.record] })
    expect(loadCases().cases[0]?.notes).toBe('Check public AIS — no claims.')
    expect(CASES_KEY).toBe('omarchy-overwatch.cases.v1')
  })

  it('rejects garbage import', () => {
    expect(importCaseJson('not-json').ok).toBe(false)
    expect(importCaseJson('[]').ok).toBe(false)
  })
})

describe('notes preview', () => {
  it('escapes HTML and renders light markdown', () => {
    const html = renderNotesPreview('# Title\n\nSee **bold** and [src](https://example.com) plus `<script>x</script>`')
    expect(html).toContain('<h3>Title</h3>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
