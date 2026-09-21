import { useRef, useState } from 'react'
import { useOverwatch } from '../state/context'

export function WorkspaceBackup() {
  const { exportWorkspace, importWorkspace } = useOverwatch()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div className="workspace-backup">
      <div className="count-line">Workspace backup</div>
      <p className="case-hint">
        One JSON file of layout, feeds, cases, map style, named views, and favorites. Brief API keys are never
        exported. Import replaces local workspace prefs in this browser.
      </p>
      <div className="actions">
        <button type="button" className="btn ghost" onClick={() => exportWorkspace()}>
          Export workspace
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Import workspace
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          void file.text().then((text) => {
            const result = importWorkspace(text)
            setStatus(result.ok ? 'Workspace imported into this browser.' : result.error)
          })
        }}
      />
      {status && <p className="case-status">{status}</p>}
    </div>
  )
}
