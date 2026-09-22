import type { OsintTool } from '../catalog/types'

/**
 * Public search URLs for catalog engines that accept a query string.
 * Engines without a single query endpoint are omitted — we do not invent one.
 */
const QUERY_URL: Record<string, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  yandex: 'https://yandex.com/search/?text=',
  startpage: 'https://www.startpage.com/sp/search?query=',
  'brave-search': 'https://search.brave.com/search?q=',
  mojeek: 'https://www.mojeek.com/search?q=',
  'google-scholar': 'https://scholar.google.com/scholar?q=',
  'wolfram-alpha': 'https://www.wolframalpha.com/input?i=',
}

export function engineSupportsQuery(toolId: string): boolean {
  return Object.prototype.hasOwnProperty.call(QUERY_URL, toolId)
}

/** HTTPS search URL for a known engine, or null when the query is empty or the engine has no template. */
export function engineSearchUrl(toolId: string, query: string): string | null {
  const q = query.trim()
  if (!q) return null
  const base = QUERY_URL[toolId]
  if (!base || !base.startsWith('https://')) return null
  return `${base}${encodeURIComponent(q)}`
}

export function queryFromFields(fields: Record<string, string | undefined>): string {
  return (fields.query ?? fields.name ?? '').trim()
}

/**
 * Open-engine URL for a catalog tool. Search engines with a public query
 * template get the query attached. Everything else keeps the catalog URL
 * (not rewritten into a scanner).
 */
export function toolLaunchUrl(tool: Pick<OsintTool, 'id' | 'url'>, fields: Record<string, string | undefined>): {
  href: string
  queried: boolean
} {
  const built = engineSearchUrl(tool.id, queryFromFields(fields))
  if (built) return { href: built, queried: true }
  return { href: tool.url, queried: false }
}
