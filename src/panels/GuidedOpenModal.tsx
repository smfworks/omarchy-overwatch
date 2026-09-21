import { useState } from 'react'
import type { InputKind, OsintTool } from '../catalog/types'
import { useOverwatch } from '../state/context'

const FIELD_LABEL: Partial<Record<InputKind, string>> = {
  domain: 'Domain',
  email: 'Email',
  hash: 'Hash',
  url: 'URL',
  ip: 'IP',
  username: 'Username',
  phone: 'Phone',
  query: 'Query',
  name: 'Name',
  company: 'Company',
  'hash-or-url': 'Hash or URL',
}

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function GuidedOpenModal() {
  const { guidedTool, setGuidedTool } = useOverwatch()
  const [values, setValues] = useState<Record<string, string>>({})
  if (!guidedTool) return null

  const fields = guidedTool.inputs.filter((k) => FIELD_LABEL[k])
  const proceed = () => {
    const filled = fields.map((k) => values[k]?.trim()).filter(Boolean)
    if (filled.length && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(filled.join('\n'))
    }
    openUrl(guidedTool.url)
    setGuidedTool(null)
    setValues({})
  }

  return (
    <div className="help-overlay" onClick={() => setGuidedTool(null)}>
      <div className="help-card guided-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>Open {guidedTool.name}</h2>
        <p className="case-hint">
          {guidedTool.opsec === 'active'
            ? 'OPSEC: ACTIVE — your browser or the vendor will contact a third party (and possibly the target). You are responsible for ToS and lawful use.'
            : 'OPSEC: PASSIVE — this source mainly queries a public index. Still assume logging at the far end.'}
        </p>
        <p className="case-hint">
          Overwatch OSINT for Omarchy is a launcher. Optional fields below are copied to the clipboard for you to paste
          on the destination — the catalog URL is not rewritten into a scanner.
        </p>
        {fields.map((kind) => (
          <label key={kind} className="case-label">
            {FIELD_LABEL[kind]}
            <input
              className="search"
              style={{ paddingLeft: 10 }}
              value={values[kind] ?? ''}
              onChange={(e) => setValues((p) => ({ ...p, [kind]: e.target.value }))}
            />
          </label>
        ))}
        <div className="actions">
          <button type="button" className="btn" onClick={proceed}>
            Open destination
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setGuidedTool(null)
              setValues({})
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function toolNeedsGuide(tool: OsintTool): boolean {
  return tool.inputs.some((k) => Boolean(FIELD_LABEL[k]))
}
