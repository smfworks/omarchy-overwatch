export const VIEWS_KEY = 'omarchy-overwatch.views.v1'
export const VIEWS_MAX = 24

import { sanitizeAoi, type Aoi } from '../aoi/geo'
import { isMapStyleId, type MapStyleId } from '../maps/styles'

export interface SavedView {
  id: string
  name: string
  createdAt: number
  lat: number
  lng: number
  zoom: number
  altitude?: number
  stage: 'globe' | 'map'
  layers: string[]
  heatEnabled: boolean
  mapStyle: MapStyleId
  nvg: boolean
  aoi: Aoi | null
  overlay?: 'off' | 'nvg' | 'flir' | 'crt'
}

export interface ViewStoreV1 {
  version: 1
  views: SavedView[]
}

function newId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)
  return `view-${rand}`
}

function clampName(value: unknown): string {
  if (typeof value !== 'string') return 'Untitled view'
  const t = value.replace(/\s+/g, ' ').trim()
  return (t || 'Untitled view').slice(0, 48)
}

export function sanitizeView(raw: unknown): SavedView | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  const zoom = Number(row.zoom)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null
  if (!Number.isFinite(zoom)) return null
  const layers = Array.isArray(row.layers)
    ? row.layers.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)).slice(0, 16)
    : []
  const overlay =
    row.overlay === 'flir' || row.overlay === 'crt' || row.overlay === 'nvg' || row.overlay === 'off'
      ? row.overlay
      : undefined
  const view: SavedView = {
    id: typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 80) : newId(),
    name: clampName(row.name),
    createdAt: typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : Date.now(),
    lat,
    lng,
    zoom: Math.min(12, Math.max(1.2, zoom)),
    stage: row.stage === 'map' ? 'map' : 'globe',
    layers,
    heatEnabled: row.heatEnabled === true,
    mapStyle: isMapStyleId(row.mapStyle) ? row.mapStyle : 'default',
    nvg: row.nvg === true,
    aoi: sanitizeAoi(row.aoi),
  }
  if (typeof row.altitude === 'number' && Number.isFinite(row.altitude) && row.altitude > 0) {
    view.altitude = row.altitude
  }
  if (overlay) view.overlay = overlay
  return view
}

export function emptyViewStore(): ViewStoreV1 {
  return { version: 1, views: [] }
}

export function sanitizeViewStore(raw: unknown): ViewStoreV1 {
  if (!raw || typeof raw !== 'object') return emptyViewStore()
  const row = raw as Record<string, unknown>
  if (row.version !== 1) return emptyViewStore()
  const views = Array.isArray(row.views)
    ? row.views.map(sanitizeView).filter((v): v is SavedView => v !== null).slice(0, VIEWS_MAX)
    : []
  return { version: 1, views }
}

export function loadViews(): ViewStoreV1 {
  try {
    const raw = localStorage.getItem(VIEWS_KEY)
    if (!raw) return emptyViewStore()
    return sanitizeViewStore(JSON.parse(raw) as unknown)
  } catch {
    return emptyViewStore()
  }
}

export function saveViews(store: ViewStoreV1): void {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(sanitizeViewStore(store)))
}

export function upsertView(store: ViewStoreV1, view: SavedView): ViewStoreV1 {
  const next = sanitizeView(view)
  if (!next) return store
  const idx = store.views.findIndex((v) => v.id === next.id)
  const views = idx === -1 ? [...store.views, next] : store.views.map((v) => (v.id === next.id ? next : v))
  return { version: 1, views: views.slice(-VIEWS_MAX) }
}

export function removeView(store: ViewStoreV1, id: string): ViewStoreV1 {
  return { version: 1, views: store.views.filter((v) => v.id !== id) }
}

export function createView(partial: Omit<SavedView, 'id' | 'createdAt'> & { id?: string }): SavedView {
  return {
    ...partial,
    id: partial.id ?? newId(),
    createdAt: Date.now(),
    name: clampName(partial.name),
  }
}
