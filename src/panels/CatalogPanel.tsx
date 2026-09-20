import { CATEGORIES, type CategoryId } from '../catalog/types'
import { useOverwatch } from '../state/context'

export function CatalogPanel() {
  const { filters, setFilters, visibleTools, selection, selectTool, searchRef } = useOverwatch()

  const toggleCat = (id: CategoryId) => {
    setFilters((prev) => {
      const has = prev.categories.includes(id)
      return {
        ...prev,
        categories: has ? prev.categories.filter((c) => c !== id) : [...prev.categories, id],
      }
    })
  }

  return (
    <>
      <div className="panel-head">Catalog</div>
      <div className="panel-body">
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
        </div>
        {visibleTools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-card${selection?.kind === 'tool' && selection.tool.id === tool.id ? ' active' : ''}`}
            onClick={() => selectTool(tool)}
          >
            <h3>{tool.name}</h3>
            <p>{tool.description}</p>
            <div className="meta-row">
              <span className={`badge ${tool.opsec === 'passive' ? 'passive' : 'active-opsec'}`}>{tool.opsec}</span>
              <span className={`badge${tool.pricing === 'paid' ? ' paid' : ''}`}>{tool.pricing}</span>
              <span className="badge">{tool.category}</span>
            </div>
          </button>
        ))}
        {!visibleTools.length && <div className="empty">No catalog matches. Clear filters or press Esc.</div>}
      </div>
    </>
  )
}
