import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from './types'
import { TOOLS } from './tools'
import { validateCatalog } from './schema'
import { EMPTY_FILTERS, filterTools } from './index'

describe('OSINT catalog', () => {
  it('passes schema validation', () => {
    const issues = validateCatalog(TOOLS)
    expect(issues).toEqual([])
  })

  it('covers every required category with multiple tools', () => {
    for (const id of CATEGORY_IDS) {
      const count = TOOLS.filter((t) => t.category === id).length
      expect(count, id).toBeGreaterThanOrEqual(5)
    }
  })

  it('has unique https URLs', () => {
    const urls = TOOLS.map((t) => t.url)
    expect(new Set(urls).size).toBe(urls.length)
    for (const url of urls) {
      expect(url.startsWith('https://')).toBe(true)
    }
  })

  it('filters by query, category, opsec, and pricing', () => {
    const byName = filterTools(TOOLS, { ...EMPTY_FILTERS, query: 'wayback' })
    expect(byName.some((t) => t.id === 'wayback')).toBe(true)

    const byCat = filterTools(TOOLS, { ...EMPTY_FILTERS, categories: ['maritime-aviation'] })
    expect(byCat.length).toBeGreaterThanOrEqual(5)
    expect(byCat.every((t) => t.category === 'maritime-aviation')).toBe(true)

    const active = filterTools(TOOLS, { ...EMPTY_FILTERS, opsec: 'active' })
    expect(active.every((t) => t.opsec === 'active')).toBe(true)

    const paid = filterTools(TOOLS, { ...EMPTY_FILTERS, pricing: 'paid' })
    expect(paid.every((t) => t.pricing === 'paid')).toBe(true)
  })
})
