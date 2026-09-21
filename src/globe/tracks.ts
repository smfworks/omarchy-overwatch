import { colorForKind } from './colors'
import type { GeoKind, GeoPoint } from './types'

export const TRACK_LAYER_IDS = ['opensky', 'ais'] as const
export const TRACK_MAX_IDS = 220
export const TRACK_MAX_SAMPLES = 12
export const TRACK_MAX_AGE_MS = 20 * 60 * 1000
export const TRACK_MIN_MOVE_DEG = 0.0004

export interface TrackSample {
  lat: number
  lng: number
  at: number
  heading?: number
}

export interface TrackTrail {
  id: string
  kind: GeoKind
  color: string
  coords: [number, number][]
}

interface TrackEntry {
  id: string
  layerId: string
  kind: GeoKind
  samples: TrackSample[]
  lastAt: number
}

const buffers = new Map<string, TrackEntry>()

function validCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function moved(a: TrackSample, b: Pick<TrackSample, 'lat' | 'lng'>): boolean {
  return Math.abs(a.lat - b.lat) >= TRACK_MIN_MOVE_DEG || Math.abs(a.lng - b.lng) >= TRACK_MIN_MOVE_DEG
}

export function resetTracks(): void {
  buffers.clear()
}

export function ingestTrackPoints(layerId: string, points: GeoPoint[], at = Date.now()): void {
  if (!(TRACK_LAYER_IDS as readonly string[]).includes(layerId)) return
  for (const p of points) {
    if (!validCoord(p.lat, p.lng)) continue
    const sample: TrackSample = { lat: p.lat, lng: p.lng, at }
    if (typeof p.heading === 'number' && Number.isFinite(p.heading)) sample.heading = p.heading
    let entry = buffers.get(p.id)
    if (!entry) {
      entry = { id: p.id, layerId, kind: p.kind, samples: [], lastAt: at }
      buffers.set(p.id, entry)
    }
    entry.kind = p.kind
    entry.layerId = layerId
    entry.lastAt = at
    const prev = entry.samples[entry.samples.length - 1]
    if (!prev || moved(prev, sample) || at - prev.at > 45_000) {
      entry.samples.push(sample)
      if (entry.samples.length > TRACK_MAX_SAMPLES) entry.samples.splice(0, entry.samples.length - TRACK_MAX_SAMPLES)
    } else {
      prev.lat = sample.lat
      prev.lng = sample.lng
      prev.at = sample.at
      if (sample.heading != null) prev.heading = sample.heading
    }
  }
  pruneTracks(at)
}

export function clearTracksForLayer(layerId: string): void {
  for (const [id, entry] of buffers) {
    if (entry.layerId === layerId) buffers.delete(id)
  }
}

function pruneTracks(now: number): void {
  for (const [id, entry] of buffers) {
    entry.samples = entry.samples.filter((s) => now - s.at <= TRACK_MAX_AGE_MS)
    if (!entry.samples.length || now - entry.lastAt > TRACK_MAX_AGE_MS) buffers.delete(id)
  }
  if (buffers.size <= TRACK_MAX_IDS) return
  const ranked = [...buffers.values()].sort((a, b) => a.lastAt - b.lastAt)
  for (let i = 0; i < ranked.length - TRACK_MAX_IDS; i++) buffers.delete(ranked[i].id)
}

/** Split a polyline when consecutive samples cross the antimeridian. Never interpolates a fake track. */
export function splitAntimeridian(coords: [number, number][]): [number, number][][] {
  if (coords.length < 2) return []
  const parts: [number, number][][] = []
  let current: [number, number][] = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const prev = current[current.length - 1]
    const next = coords[i]
    if (Math.abs(next[1] - prev[1]) > 180) {
      if (current.length >= 2) parts.push(current)
      current = [next]
    } else {
      current.push(next)
    }
  }
  if (current.length >= 2) parts.push(current)
  return parts
}

export function trailsFromBuffer(now = Date.now()): TrackTrail[] {
  pruneTracks(now)
  const trails: TrackTrail[] = []
  for (const entry of buffers.values()) {
    const coords = entry.samples.map((s) => [s.lat, s.lng] as [number, number])
    const parts = splitAntimeridian(coords)
    parts.forEach((part, i) => {
      trails.push({
        id: parts.length === 1 ? entry.id : `${entry.id}·${i}`,
        kind: entry.kind,
        color: colorForKind(entry.kind),
        coords: part,
      })
    })
  }
  return trails
}

export function trailForId(id: string, now = Date.now()): TrackTrail | null {
  pruneTracks(now)
  const entry = buffers.get(id)
  if (!entry) return null
  const parts = splitAntimeridian(entry.samples.map((s) => [s.lat, s.lng] as [number, number]))
  const longest = parts.sort((a, b) => b.length - a.length)[0]
  if (!longest) return null
  return { id: entry.id, kind: entry.kind, color: colorForKind(entry.kind), coords: longest }
}

export function trackBufferSize(): number {
  return buffers.size
}
