import { CASES_KEY, CASE_EXPORT_VERSION, type CasePin, type CaseRecord, type CaseStoreV1 } from './types'

const NAME_MAX = 80
const NOTES_MAX = 20_000
const PINS_MAX = 80

function clampName(value: unknown): string {
  if (typeof value !== 'string') return 'Untitled case'
  const t = value.replace(/\s+/g, ' ').trim()
  return (t || 'Untitled case').slice(0, NAME_MAX)
}

function asNotes(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, NOTES_MAX)
}

function asId(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120)
  return fallback
}

function asCoord(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function sanitizePin(raw: unknown): CasePin | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const type = row.type
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const label = typeof row.label === 'string' ? row.label.trim() : ''
  if (!id || !label) return null
  if (type === 'tool') {
    const url = typeof row.url === 'string' ? row.url.trim() : ''
    if (!url.startsWith('https://') && !url.startsWith('http://')) return null
    return { type: 'tool', id: id.slice(0, 120), label: label.slice(0, 160), url }
  }
  if (type === 'hotspot' || type === 'point') {
    const lat = asCoord(row.lat)
    const lng = asCoord(row.lng)
    if (lat === null || lng === null) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    const url = typeof row.url === 'string' && row.url.trim() ? row.url.trim() : undefined
    if (type === 'hotspot') {
      return { type: 'hotspot', id: id.slice(0, 120), label: label.slice(0, 160), lat, lng, url }
    }
    const kind = typeof row.kind === 'string' && row.kind.trim() ? row.kind.trim() : 'event'
    const extra = typeof row.extra === 'string' && row.extra.trim() ? row.extra.trim() : undefined
    return { type: 'point', id: id.slice(0, 120), label: label.slice(0, 160), lat, lng, kind, extra, url }
  }
  return null
}

function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)
  return `${prefix}-${rand}`
}

export function createEmptyCase(name = 'Untitled case'): CaseRecord {
  const now = Date.now()
  return {
    id: newId('case'),
    name: clampName(name),
    notes: '',
    pins: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function emptyStore(): CaseStoreV1 {
  return { version: 1, activeId: null, cases: [] }
}

export function sanitizeCase(raw: unknown): CaseRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = asId(row.id, newId('case'))
  const createdAt = typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : Date.now()
  const updatedAt = typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : createdAt
  const pins = Array.isArray(row.pins)
    ? row.pins.map(sanitizePin).filter((p): p is CasePin => p !== null).slice(0, PINS_MAX)
    : []
  return {
    id,
    name: clampName(row.name),
    notes: asNotes(row.notes),
    pins,
    createdAt,
    updatedAt,
  }
}

export function sanitizeStore(raw: unknown): CaseStoreV1 {
  if (!raw || typeof raw !== 'object') return emptyStore()
  const row = raw as Record<string, unknown>
  if (row.version !== 1) return emptyStore()
  const cases = Array.isArray(row.cases)
    ? row.cases.map(sanitizeCase).filter((c): c is CaseRecord => c !== null)
    : []
  const activeId = typeof row.activeId === 'string' ? row.activeId : null
  const known = new Set(cases.map((c) => c.id))
  return {
    version: 1,
    activeId: activeId && known.has(activeId) ? activeId : (cases[0]?.id ?? null),
    cases,
  }
}

export function loadCases(): CaseStoreV1 {
  try {
    const raw = localStorage.getItem(CASES_KEY)
    if (!raw) return emptyStore()
    return sanitizeStore(JSON.parse(raw) as unknown)
  } catch {
    return emptyStore()
  }
}

export function saveCases(store: CaseStoreV1): void {
  localStorage.setItem(CASES_KEY, JSON.stringify(sanitizeStore(store)))
}

export function activeCase(store: CaseStoreV1): CaseRecord | null {
  return store.cases.find((c) => c.id === store.activeId) ?? null
}

export function upsertCase(store: CaseStoreV1, next: CaseRecord): CaseStoreV1 {
  const idx = store.cases.findIndex((c) => c.id === next.id)
  const cases = idx === -1 ? [...store.cases, next] : store.cases.map((c) => (c.id === next.id ? next : c))
  return { version: 1, activeId: next.id, cases }
}

export function pinEquals(a: CasePin, b: CasePin): boolean {
  return a.type === b.type && a.id === b.id
}

export function addPin(record: CaseRecord, pin: CasePin): CaseRecord {
  if (record.pins.some((p) => pinEquals(p, pin))) return record
  return { ...record, pins: [...record.pins, pin].slice(0, PINS_MAX), updatedAt: Date.now() }
}

export function removePin(record: CaseRecord, pin: CasePin): CaseRecord {
  return { ...record, pins: record.pins.filter((p) => !pinEquals(p, pin)), updatedAt: Date.now() }
}

export interface CaseExportDoc {
  version: typeof CASE_EXPORT_VERSION
  exportedAt: string
  case: CaseRecord
}

export function exportCaseJson(record: CaseRecord): string {
  const doc: CaseExportDoc = {
    version: CASE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    case: record,
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

export function importCaseJson(text: string): { ok: true; record: CaseRecord } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not valid JSON' }
  }
  if (Array.isArray(parsed) || !parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON is not a case export' }
  }
  const row = parsed as Record<string, unknown>
  const rawCase = row.case ?? parsed
  if (!rawCase || typeof rawCase !== 'object' || Array.isArray(rawCase)) {
    return { ok: false, error: 'JSON is not a case export' }
  }
  const source = rawCase as Record<string, unknown>
  if (typeof source.name !== 'string' && typeof source.notes !== 'string' && !Array.isArray(source.pins)) {
    return { ok: false, error: 'JSON is not a case export' }
  }
  const record = sanitizeCase(rawCase)
  if (!record) return { ok: false, error: 'JSON is not a case export' }
  return {
    ok: true,
    record: {
      ...record,
      id: newId('case'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }
}

export function filenameForCase(record: CaseRecord): string {
  const slug = record.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `overwatch-case-${slug || 'untitled'}.json`
}
