import { CATEGORY_IDS, type OsintTool } from './types'

const INPUTS = new Set([
  'query',
  'url',
  'domain',
  'ip',
  'email',
  'username',
  'phone',
  'name',
  'image',
  'hash',
  'file',
  'coordinates',
  'asn',
  'company',
  'vessel',
  'flight',
  'hash-or-url',
])

export interface CatalogIssue {
  path: string
  message: string
}

export function validateCatalog(tools: OsintTool[]): CatalogIssue[] {
  const issues: CatalogIssue[] = []
  const ids = new Set<string>()
  const categoriesSeen = new Set<string>()

  if (tools.length < 100) {
    issues.push({ path: 'catalog', message: `expected ≥100 tools, got ${tools.length}` })
  }

  tools.forEach((tool, index) => {
    const path = `tools[${index}]`
    if (!tool.id || !/^[a-z0-9-]+$/.test(tool.id)) {
      issues.push({ path: `${path}.id`, message: 'id must be kebab-case' })
    }
    if (ids.has(tool.id)) {
      issues.push({ path: `${path}.id`, message: `duplicate id ${tool.id}` })
    }
    ids.add(tool.id)
    if (!tool.name?.trim()) {
      issues.push({ path: `${path}.name`, message: 'name required' })
    }
    if (!CATEGORY_IDS.includes(tool.category)) {
      issues.push({ path: `${path}.category`, message: `unknown category ${tool.category}` })
    } else {
      categoriesSeen.add(tool.category)
    }
    try {
      const url = new URL(tool.url)
      if (url.protocol !== 'https:') {
        issues.push({ path: `${path}.url`, message: 'url must be https' })
      }
    } catch {
      issues.push({ path: `${path}.url`, message: 'url is not valid' })
    }
    if (!tool.description || tool.description.length < 20) {
      issues.push({ path: `${path}.description`, message: 'description too short' })
    }
    if (!Array.isArray(tool.tags) || tool.tags.length === 0) {
      issues.push({ path: `${path}.tags`, message: 'at least one tag required' })
    }
    if (tool.opsec !== 'passive' && tool.opsec !== 'active') {
      issues.push({ path: `${path}.opsec`, message: 'opsec must be passive|active' })
    }
    if (!['free', 'freemium', 'paid'].includes(tool.pricing)) {
      issues.push({ path: `${path}.pricing`, message: 'invalid pricing' })
    }
    if (!Array.isArray(tool.inputs) || tool.inputs.length === 0) {
      issues.push({ path: `${path}.inputs`, message: 'at least one input required' })
    } else {
      for (const input of tool.inputs) {
        if (!INPUTS.has(input)) {
          issues.push({ path: `${path}.inputs`, message: `unknown input ${input}` })
        }
      }
    }
  })

  for (const id of CATEGORY_IDS) {
    if (!categoriesSeen.has(id)) {
      issues.push({ path: 'catalog', message: `missing category coverage: ${id}` })
    }
  }

  return issues
}
