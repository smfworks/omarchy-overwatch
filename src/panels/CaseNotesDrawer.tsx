import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TOOLS } from '../catalog/tools'
import { HOTSPOTS } from '../data/hotspots'
import { renderNotesPreview } from '../cases/markdown'
import { exportCaseMarkdown, filenameForPacket, pinsToGeoJSON } from '../cases/packet'
import {
  activeCase,
  createEmptyCase,
  exportCaseJson,
  filenameForCase,
  importCaseJson,
  removePin,
  upsertCase,
} from '../cases/storage'
import type { CasePin, CaseRecord } from '../cases/types'
import type { GeoPoint } from '../globe/types'
import { useOverwatch } from '../state/context'

function pointKind(kind: string): GeoPoint['kind'] {
  if (
    kind === 'quake' ||
    kind === 'event' ||
    kind === 'aircraft' ||
    kind === 'alert' ||
    kind === 'vessel' ||
    kind === 'fire' ||
    kind === 'sat' ||
    kind === 'hazard'
  ) {
    return kind
  }
  return 'event'
}

function download(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function CaseNotesDrawer() {
  const {
    casesDrawerOpen,
    setCasesDrawerOpen,
    caseStore,
    setCaseStore,
    selection,
    selectTool,
    selectHotspot,
    selectPoint,
    selectTicker,
    pinSelection,
  } = useOverwatch()
  const current = activeCase(caseStore)
  const [preview, setPreview] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (casesDrawerOpen) closeRef.current?.focus()
    else {
      setPreview(false)
      setConfirmDelete(false)
      setStatus(null)
    }
  }, [casesDrawerOpen])

  const patchActive = useCallback(
    (fn: (record: CaseRecord) => CaseRecord) => {
      setCaseStore((prev) => {
        const rec = activeCase(prev)
        if (!rec) return prev
        return upsertCase(prev, fn(rec))
      })
    },
    [setCaseStore],
  )

  const create = () => {
    const rec = createEmptyCase(`Case ${caseStore.cases.length + 1}`)
    setCaseStore((prev) => upsertCase(prev, rec))
    setConfirmDelete(false)
    setStatus('Empty case created — add your own notes and pins.')
  }

  const remove = () => {
    if (!current) return
    setCaseStore((prev) => {
      const cases = prev.cases.filter((c) => c.id !== current.id)
      return { version: 1, cases, activeId: cases[0]?.id ?? null }
    })
    setConfirmDelete(false)
    setStatus('Case deleted from this browser.')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const result = importCaseJson(text)
    if (!result.ok) {
      setStatus(result.error)
      return
    }
    setCaseStore((prev) => upsertCase(prev, result.record))
    setStatus(`Imported “${result.record.name}” as a new local case.`)
  }

  const activatePin = (pin: CasePin) => {
    if (pin.type === 'tool') {
      const tool = TOOLS.find((t) => t.id === pin.id)
      if (tool) selectTool(tool)
      else window.open(pin.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (pin.type === 'hotspot') {
      const hs = HOTSPOTS.find((h) => h.id === pin.id)
      if (hs) selectHotspot(hs)
      else selectPoint({ id: pin.id, lat: pin.lat, lng: pin.lng, label: pin.label, kind: 'event' })
      return
    }
    if (pin.type === 'ticker') {
      selectTicker({
        id: pin.id,
        title: pin.label,
        url: pin.url,
        source: pin.source,
        published: pin.published ?? null,
        feedId: pin.feedId ?? 'pinned',
      })
      return
    }
    selectPoint({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      label: pin.label,
      kind: pointKind(pin.kind),
      extra: pin.extra,
    })
  }

  const pinHint = useMemo(() => {
    if (!selection) return 'Open a catalog card, hotspot, or live point, then pin it. Pins store ids/labels/coords only.'
    if (selection.kind === 'tool') return `Pin ${selection.tool.name}`
    if (selection.kind === 'hotspot') return `Pin ${selection.hotspot.name}`
    if (selection.kind === 'ticker') return `Pin headline “${selection.item.title}” (title/link/date only)`
    if (selection.kind === 'heat') return 'Heat cells cannot be pinned — pin a contributing event instead.'
    return `Pin ${selection.point.label}`
  }, [selection])

  if (!casesDrawerOpen) return null

  return (
    <>
      <div
        className="case-backdrop"
        onClick={() => setCasesDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="case-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-drawer-title"
      >
        <div className="panel-head case-drawer-head">
          <span id="case-drawer-title">Case notes</span>
          <button
            ref={closeRef}
            className="icon-btn"
            title="Close case notes"
            aria-label="Close case notes"
            onClick={() => setCasesDrawerOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="panel-body case-drawer-body">
          <p className="case-lede">
            Local scratchpad in <code>localStorage</code>. Overwatch OSINT for Omarchy does not draft intelligence, auto-fill
            conclusions, or sync cases anywhere.
          </p>
          <div className="case-toolbar">
            <label className="sr-only" htmlFor="case-select">
              Active case
            </label>
            <select
              id="case-select"
              className="case-select"
              value={current?.id ?? ''}
              onChange={(e) => setCaseStore((prev) => ({ ...prev, activeId: e.target.value || null }))}
              disabled={!caseStore.cases.length}
            >
              {!caseStore.cases.length && <option value="">No cases</option>}
              {caseStore.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn" type="button" onClick={create}>
              New
            </button>
          </div>

          {!current ? (
            <div className="empty">
              Create a case to pin public sources. Nothing is pre-populated.
              <div className="actions">
                <button type="button" className="btn ghost" onClick={pinSelection} disabled={!selection}>
                  Pin current selection
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="case-label" htmlFor="case-name">
                Title
              </label>
              <input
                id="case-name"
                className="search case-name"
                value={current.name}
                onChange={(e) => patchActive((rec) => ({ ...rec, name: e.target.value, updatedAt: Date.now() }))}
              />
              <div className="case-editbar">
                <button
                  type="button"
                  className={`btn ghost${preview ? '' : ' on'}`}
                  aria-pressed={!preview}
                  onClick={() => setPreview(false)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`btn ghost${preview ? ' on' : ''}`}
                  aria-pressed={preview}
                  onClick={() => setPreview(true)}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => download(filenameForCase(current), exportCaseJson(current))}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    download(filenameForPacket(current, 'md'), exportCaseMarkdown(current), 'text/markdown')
                  }
                >
                  Export MD
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    download(
                      filenameForPacket(current, 'geojson'),
                      `${JSON.stringify(pinsToGeoJSON(current.pins), null, 2)}\n`,
                      'application/geo+json',
                    )
                  }
                >
                  Export GeoJSON
                </button>
                <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
                  Import JSON
                </button>
                {confirmDelete ? (
                  <>
                    <button type="button" className="btn danger" onClick={remove}>
                      Confirm delete
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn ghost" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  void onImport(file)
                }}
              />
              {preview ? (
                <div
                  className="case-preview"
                  dangerouslySetInnerHTML={{ __html: renderNotesPreview(current.notes) }}
                />
              ) : (
                <textarea
                  className="case-notes"
                  spellCheck
                  placeholder="Your notes only — markdown or plaintext. Overwatch OSINT for Omarchy will not write this for you."
                  value={current.notes}
                  onChange={(e) => patchActive((rec) => ({ ...rec, notes: e.target.value, updatedAt: Date.now() }))}
                />
              )}
              <div className="count-line">Pins · {current.pins.length}</div>
              <p className="case-hint">{pinHint}</p>
              <button type="button" className="btn ghost" onClick={pinSelection} disabled={!selection || selection.kind === 'heat'} style={{ marginBottom: 10 }}>
                Pin current selection
              </button>
              {current.pins.length === 0 && (
                <div className="empty" style={{ padding: '8px 0' }}>
                  No pins. Use “Pin to case” on a dossier, or “Pin current selection” when a card or globe point is open.
                </div>
              )}
              {current.pins.map((pin) => (
                <div key={`${pin.type}-${pin.id}`} className="case-pin">
                  <button type="button" className="tool-card" onClick={() => activatePin(pin)}>
                    <h3>{pin.label}</h3>
                    <p>
                      {pin.type}
                      {'lat' in pin ? ` · ${pin.lat.toFixed(2)}°, ${pin.lng.toFixed(2)}°` : ''}
                      {pin.type === 'tool' || pin.type === 'ticker' ? ` · ${pin.url}` : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Unpin"
                    aria-label={`Unpin ${pin.label}`}
                    onClick={() => patchActive((rec) => removePin(rec, pin))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
          {status && (
            <div className="case-status" role="status">
              {status}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
