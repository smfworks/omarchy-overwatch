import { CATEGORIES, type CategoryId } from '../catalog/types'
import { TOOLS } from '../catalog/tools'
import { useOverwatch } from '../state/context'
import { isPinned } from '../favorites/storage'
import { EngineSearch } from './EngineSearch'

export function CatalogPanel() {
  const { filters, setFilters, visibleTools, selection, selectTool, searchRef, favorites, toggleFavorite } =
    useOverwatch()

  const toggleCat = (id: CategoryId) => {
    setFilters((prev) => {
      const has = prev.categories.includes(id)
      return {
        ...prev,
        categories: has ? prev.categories.filter((c) => c !== id) : [...prev.categories, id],
      }
    })
  }

  const pinned = favorites.pinned
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
  const recent = favorites.recent
    .map((r) => TOOLS.find((t) => t.id === r.id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .filter((t) => !favorites.pinned.includes(t.id))
    .slice(0, 8)

  const pinnedIds = new Set(pinned.map((t) => t.id))
  const rest = visibleTools.filter((t) => !pinnedIds.has(t.id))

  return (
    <>
      <div className="panel-head">Catalog</div>
      <div className="panel-body">
        <EngineSearch />
        <div className="search-wrap">
          <span>/</span>
          <input
            ref={searchRef}
            className="search"
            placeholder="Filter tools, tags, inputs…"
            value={filters.query}
            onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
          />
        </div>
        <div className="filters">
          <select
            value={filters.opsec}
            onChange={(e) => setFilters((p) => ({ ...p, opsec: e.target.value as typeof p.opsec }))}
          >
            <option value="any">OPSEC: any</option>
            <option value="passive">passive only</option>
            <option value="active">active only</option>
          </select>
          <select
            value={filters.pricing}
            onChange={(e) => setFilters((p) => ({ ...p, pricing: e.target.value as typeof p.pricing }))}
          >
            <option value="any">Pricing: any</option>
            <option value="free">free</option>
            <option value="freemium">freemium</option>
            <option value="paid">paid</option>
          </select>
        </div>
        <div className="cat-list">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`cat-btn${filters.categories.includes(cat.id) ? ' active' : ''}`}
              onClick={() => toggleCat(cat.id)}
              title={cat.description}
            >
              {cat.short}
            </button>
          ))}
        </div>
        <div className="count-line">
          {visibleTools.length} sources
          {filters.categories.length ? ` · ${filters.categories.length} domains` : ''}
          {' · select a card for depth'}
        </div>
        {pinned.length > 0 && (
          <>
            <div className="count-line">Favorites</div>
            {pinned.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                active={selection?.kind === 'tool' && selection.tool.id === tool.id}
                pinned
                onSelect={() => selectTool(tool)}
                onPin={() => toggleFavorite(tool.id)}
              />
            ))}
          </>
        )}
        {recent.length > 0 && (
          <>
            <div className="count-line">Recent</div>
            {recent.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                active={selection?.kind === 'tool' && selection.tool.id === tool.id}
                pinned={false}
                onSelect={() => selectTool(tool)}
                onPin={() => toggleFavorite(tool.id)}
              />
            ))}
          </>
        )}
        {rest.map((tool) => (
          <ToolRow
            key={tool.id}
            tool={tool}
            active={selection?.kind === 'tool' && selection.tool.id === tool.id}
            pinned={isPinned(favorites, tool.id)}
            onSelect={() => selectTool(tool)}
            onPin={() => toggleFavorite(tool.id)}
          />
        ))}
        {!visibleTools.length && <div className="empty">No catalog matches. Clear filters or press Esc.</div>}
      </div>
    </>
  )
}

function ToolRow({
  tool,
  active,
  pinned,
  onSelect,
  onPin,
}: {
  tool: (typeof TOOLS)[number]
  active: boolean
  pinned: boolean
  onSelect: () => void
  onPin: () => void
}) {
  return (
    <div className={`tool-card-wrap${active ? ' active' : ''}`}>
      <button
        className={`tool-card selectable${active ? ' active' : ''}`}
        onClick={onSelect}
        aria-pressed={active}
        aria-current={active ? 'true' : undefined}
      >
        <h3>{tool.name}</h3>
        <p>{tool.description}</p>
        <div className="meta-row">
          <span className={`badge ${tool.opsec === 'passive' ? 'passive' : 'active-opsec'}`}>{tool.opsec}</span>
          <span className={`badge${tool.pricing === 'paid' ? ' paid' : ''}`}>{tool.pricing}</span>
          <span className="badge">{tool.category}</span>
        </div>
      </button>
      <button
        type="button"
        className={`icon-btn pin-tool${pinned ? ' on' : ''}`}
        title={pinned ? 'Unpin favorite' : 'Pin favorite'}
        aria-label={pinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onPin()
        }}
      >
        ★
      </button>
    </div>
  )
}
