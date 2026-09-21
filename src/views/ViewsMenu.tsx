import { useState } from 'react'
import { useOverwatch } from '../state/context'

export function ViewsMenu() {
  const { views, saveCurrentView, loadView, deleteView } = useOverwatch()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <div className="views-menu">
      <button type="button" className={`layer-btn${open ? ' on' : ''}`} onClick={() => setOpen((v) => !v)}>
        VIEWS
      </button>
      {open && (
        <div className="views-pop">
          <form
            className="feed-add"
            onSubmit={(e) => {
              e.preventDefault()
              saveCurrentView(name)
              setName('')
            }}
          >
            <input
              className="search"
              style={{ paddingLeft: 10 }}
              placeholder="Name this view"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn" type="submit">
              Save
            </button>
          </form>
          {!views.length && <div className="empty" style={{ padding: '8px 0' }}>No saved views in this browser.</div>}
          {views.map((view) => (
            <div key={view.id} className="feed-row">
              <button type="button" className="ticker-item" onClick={() => loadView(view.id)}>
                {view.name}
              </button>
              <button type="button" className="icon-btn" aria-label={`Delete ${view.name}`} onClick={() => deleteView(view.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
