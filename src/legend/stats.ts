import type { LayerStatus } from '../globe/types'

/** ID-set diff between two successful polls. Coordinates are not stored. */
export interface EntityDelta {
  /** Null on the first successful poll — that poll is a baseline, not a change. */
  previousCount: number | null
  count: number
  /** Null when there is no prior payload. */
  delta: number | null
  added: number
  removed: number
  baseline: boolean
}

export interface PollDeltaRecord {
  layerId: string
  label: string
  at: number
  delta: EntityDelta
}

export interface LayerEntityCount {
  id: string
  enabled: boolean
  status: string
  count: number
}

export interface IntegrityGap {
  id: string
  label: string
  status: 'err' | 'stale'
  detail: string | null
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Compare entity IDs from the previous successful payload to the next one.
 * `previous === null` is the first success: a baseline, with no new/removed claim.
 */
export function diffEntityIds(previous: readonly string[] | null, next: readonly string[]): EntityDelta {
  const nextIds = uniqueIds(next)
  const count = nextIds.length
  if (previous == null) {
    return { previousCount: null, count, delta: null, added: 0, removed: 0, baseline: true }
  }
  const prevIds = uniqueIds(previous)
  const prevSet = new Set(prevIds)
  const nextSet = new Set(nextIds)
  let added = 0
  let removed = 0
  for (const id of nextSet) if (!prevSet.has(id)) added += 1
  for (const id of prevSet) if (!nextSet.has(id)) removed += 1
  return {
    previousCount: prevIds.length,
    count,
    delta: count - prevIds.length,
    added,
    removed,
    baseline: false,
  }
}

export function formatEntityDelta(label: string, delta: EntityDelta): string {
  if (delta.baseline) return `${label} · baseline ${delta.count} · no prior poll`
  if (delta.added === 0 && delta.removed === 0) return `${label} · no change · ${delta.count}`
  const change = delta.delta ?? 0
  const signed = change > 0 ? `+${change}` : `${change}`
  return `${label} · Δ ${signed} · +${delta.added} new · −${delta.removed} removed · ${delta.count}`
}

/** Counts from points already in state. Callers pass ids only; geometry is ignored. */
export function layerEntityCounts(
  layers: { id: string; enabled: boolean; status: string; points: { id: string }[] }[],
): LayerEntityCount[] {
  return layers.map((layer) => ({
    id: layer.id,
    enabled: layer.enabled,
    status: layer.status,
    count: layer.enabled ? layer.points.length : 0,
  }))
}

export function formatEntityCount(input: {
  enabled: boolean
  status: string
  count: number
  hasPayload: boolean
}): string {
  if (!input.enabled || input.status === 'off') return '—'
  if (!input.hasPayload && input.status === 'loading') return '…'
  if (!input.hasPayload) return '—'
  return String(input.count)
}

/** Enabled layers whose honesty status is ERR or STALE. Off and LIVE are not gaps. */
export function integrityGaps(
  layers: { id: string; label: string; enabled: boolean; status: LayerStatus | string; error?: string | null }[],
): IntegrityGap[] {
  const gaps: IntegrityGap[] = []
  for (const layer of layers) {
    if (!layer.enabled) continue
    if (layer.status !== 'err' && layer.status !== 'stale') continue
    const detail = typeof layer.error === 'string' && layer.error.trim() ? layer.error.trim() : null
    gaps.push({ id: layer.id, label: layer.label, status: layer.status, detail })
  }
  return gaps
}
