import { useEffect, useRef, useState } from 'react'
import { TOOLS } from '../catalog/tools'
import { engineSearchUrl, engineSupportsQuery } from '../search/engines'
import { useOverwatch } from '../state/context'
import { openExternal } from './openExternal'

interface Launch {
  id: string
  engine: string
  query: string
  href: string
  queried: boolean
  opened: boolean
}

const ENGINES = TOOLS.filter((tool) => tool.category === 'search-engines')
const QUICK = ENGINES.filter((tool) => engineSupportsQuery(tool.id))

const POPUP_BLOCKED =
  'App window blocked an auto-open — click the result link (or allow popups). Overwatch does not scrape the engine.'

export function EngineSearch() {
  const { selection } = useOverwatch()
  const [engineId, setEngineId] = useState(QUICK[0]?.id ?? ENGINES[0]?.id ?? 'google')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [launches, setLaunches] = useState<Launch[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selection?.kind !== 'tool' || selection.tool.category !== 'search-engines') return
    setEngineId(selection.tool.id)
    inputRef.current?.focus()
  }, [selection])

  const run = (id: string) => {
    const tool = ENGINES.find((item) => item.id === id)
    if (!tool) return
    setEngineId(tool.id)
    const q = query.trim()
    if (!q) {
      setNotice('Enter a query, then press Enter or an engine button. Overwatch does not invent results.')
      inputRef.current?.focus()
      return
    }
    const href = engineSearchUrl(tool.id, q)
    if (href) {
      const opened = openExternal(href)
      setNotice(opened ? null : POPUP_BLOCKED)
      setLaunches((prev) =>
        [{ id: `${tool.id}:${q}:${Date.now()}`, engine: tool.name, query: q, href, queried: true, opened }, ...prev].slice(0, 8),
      )
      return
    }
    const opened = openExternal(tool.url)
    setNotice(
      opened
        ? `${tool.name} has no single public query URL in the catalog. Opened the tool page. No results were scraped or invented.`
        : `${tool.name} has no single public query URL in the catalog. App window blocked an auto-open — click the catalog link (or allow popups). No results were scraped or invented.`,
    )
    setLaunches((prev) =>
      [
        {
          id: `${tool.id}:${q}:${Date.now()}`,
          engine: tool.name,
          query: q,
          href: tool.url,
          queried: false,
          opened,
        },
        ...prev,
      ].slice(0, 8),
    )
  }

  return (
    <form
      className="engine-search"
      data-testid="engine-search"
      onSubmit={(e) => {
        e.preventDefault()
        run(engineId)
      }}
    >
      <div className="count-line">Web search</div>
      <label className="engine-field">
        <span>Engine</span>
        <select
          aria-label="Search engine"
          data-testid="engine-select"
          value={engineId}
          onChange={(e) => setEngineId(e.target.value)}
        >
          {ENGINES.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name}
            </option>
          ))}
        </select>
      </label>
      <label className="engine-field">
        <span>Query</span>
        <input
          ref={inputRef}
          className="search engine-query"
          aria-label="Search query"
          data-testid="engine-query"
          placeholder="Query — Enter or Search opens the engine"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="engine-actions">
        <button type="submit" className="btn" data-testid="engine-submit">
          Search
        </button>
        {QUICK.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`cat-btn${engineId === tool.id ? ' active' : ''}`}
            onClick={() => run(tool.id)}
          >
            {tool.name}
          </button>
        ))}
      </div>
      {notice && <p className="engine-notice">{notice}</p>}
      {launches.length > 0 && (
        <ul className="engine-results" aria-label="Opened searches" data-testid="engine-results">
          {launches.map((launch) => (
            <li key={launch.id}>
              <a
                href={launch.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="engine-result-link"
              >
                {launch.engine}: {launch.query}
              </a>
              <span className="engine-result-meta">
                {launch.queried ? (launch.opened ? 'opened' : 'link') : 'catalog page'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="disclaimer engine-disclaimer">
        Opens the engine with your query. Overwatch does not scrape or invent search results.
      </p>
    </form>
  )
}
