import { type CategoryId, type OsintTool, type Opsec, type Pricing } from './types'
import { TOOLS } from './tools'

export { CATEGORIES, CATEGORY_IDS, type CategoryId, type OsintTool } from './types'
export { TOOLS } from './tools'
export { validateCatalog } from './schema'

export interface CatalogFilters {
  query: string
  categories: CategoryId[]
  opsec: Opsec | 'any'
  pricing: Pricing | 'any'
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: '',
  categories: [],
  opsec: 'any',
  pricing: 'any',
}

export function filterTools(tools: OsintTool[], filters: CatalogFilters): OsintTool[] {
  const q = filters.query.trim().toLowerCase()
  return tools.filter((tool) => {
    if (filters.categories.length && !filters.categories.includes(tool.category)) return false
    if (filters.opsec !== 'any' && tool.opsec !== filters.opsec) return false
    if (filters.pricing !== 'any' && tool.pricing !== filters.pricing) return false
    if (!q) return true
    const hay = [
      tool.name,
      tool.description,
      tool.category,
      tool.subcategory ?? '',
      tool.notes ?? '',
      ...tool.tags,
      ...tool.inputs,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function toolsForCategory(category: CategoryId, tools: OsintTool[] = TOOLS): OsintTool[] {
  return tools.filter((t) => t.category === category)
}

export function relatedTools(tags: string[], category?: CategoryId, limit = 6): OsintTool[] {
  const tagSet = new Set(tags)
  const scored = TOOLS.map((tool) => {
    let score = 0
    if (category && tool.category === category) score += 2
    for (const tag of tool.tags) {
      if (tagSet.has(tag)) score += 1
    }
    return { tool, score }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.tool)
}

export const CATALOG_COUNT = TOOLS.length
