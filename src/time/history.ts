import type { GeoPoint } from '../globe/types'
import { isTimeBearingLayer, parseObservedAt } from './window'

export const HISTORY_MAX_IDS = 400
export const HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000

interface HistEntry {
  point: GeoPoint
  ingestedAt: number
}

const store = new Map<string, HistEntry>()

export function resetHistory(): void {
  store.clear()
}

function clonePoint(p: GeoPoint): GeoPoint {
  return { ...p }
}

export function ingestHistory(layerId: string, points: GeoPoint[], at = Date.now()): void {
  if (!isTimeBearingLayer(layerId)) return
  for (const p of points) {
    const observed = parseObservedAt(p.observedAt) ?? at
    const prev = store.get(p.id)
    if (prev && (parseObservedAt(prev.point.observedAt) ?? prev.ingestedAt) >= observed) {
      continue
    }
    store.set(p.id, { point: clonePoint(p), ingestedAt: at })
  }
  pruneHistory(at)
}

export function pruneHistory(now = Date.now()): void {
  for (const [id, entry] of store) {
    const t = parseObservedAt(entry.point.observedAt) ?? entry.ingestedAt
    if (now - t > HISTORY_MAX_AGE_MS) store.delete(id)
  }
  if (store.size <= HISTORY_MAX_IDS) return
  const ranked = [...store.entries()].sort((a, b) => {
    const ta = parseObservedAt(a[1].point.observedAt) ?? a[1].ingestedAt
    const tb = parseObservedAt(b[1].point.observedAt) ?? b[1].ingestedAt
    return ta - tb
  })
  for (let i = 0; i < ranked.length - HISTORY_MAX_IDS; i++) store.delete(ranked[i][0])
}

/** Merge current poll with previously seen time-bearing points. Never fabricates coords. */
export function mergeHistory(layerId: string, current: GeoPoint[], now = Date.now()): GeoPoint[] {
  pruneHistory(now)
  const byId = new Map<string, GeoPoint>()
  for (const p of current) byId.set(p.id, p)
  if (!isTimeBearingLayer(layerId)) return [...byId.values()]
  for (const entry of store.values()) {
    if (entry.point.layerId !== layerId) continue
    if (!byId.has(entry.point.id)) byId.set(entry.point.id, entry.point)
  }
  return [...byId.values()]
}

export function historySize(): number {
  return store.size
}

const IDB_NAME = 'omarchy-overwatch-history'
const IDB_STORE = 'points'

export function persistHistory(): void {
  if (typeof indexedDB === 'undefined') return
  const rows = [...store.values()].map((e) => e.point)
  const req = indexedDB.open(IDB_NAME, 1)
  req.onupgradeneeded = () => {
    const db = req.result
    if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
  }
  req.onsuccess = () => {
    const db = req.result
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(rows, 'v1')
      tx.oncomplete = () => db.close()
      tx.onerror = () => db.close()
    } catch {
      db.close()
    }
  }
}

export function restoreHistory(): Promise<number> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(0)
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => resolve(0)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      try {
        const tx = db.transaction(IDB_STORE, 'readonly')
        const get = tx.objectStore(IDB_STORE).get('v1')
        get.onsuccess = () => {
          const rows = get.result
          if (Array.isArray(rows)) {
            const grouped = new Map<string, GeoPoint[]>()
            for (const raw of rows) {
              if (!raw || typeof raw !== 'object') continue
              const p = raw as GeoPoint
              if (typeof p.id !== 'string' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
              const lid = p.layerId ?? 'earthquakes'
              const list = grouped.get(lid) ?? []
              list.push(p)
              grouped.set(lid, list)
            }
            for (const [lid, pts] of grouped) ingestHistory(lid, pts)
          }
          db.close()
          resolve(store.size)
        }
        get.onerror = () => {
          db.close()
          resolve(0)
        }
      } catch {
        db.close()
        resolve(0)
      }
    }
  })
}
