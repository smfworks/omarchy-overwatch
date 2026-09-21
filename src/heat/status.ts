import type { LayerState, LayerStatus } from '../globe/types'

/** HEAT chrome: OFF when toggled off; ERR when fewer than two live layers are enabled. */
export function classifyHeatStatus(enabled: boolean, layers: LayerState[]): LayerStatus {
  if (!enabled) return 'off'
  const on = layers.filter((l) => l.enabled)
  if (on.length < 2) return 'err'
  if (on.every((l) => l.status === 'loading')) return 'loading'
  const usable = on.filter((l) => l.status === 'live' || l.status === 'stale' || l.status === 'loading')
  if (usable.length < 2) return 'err'
  if (usable.every((l) => l.status === 'stale')) return 'stale'
  if (usable.every((l) => l.status === 'loading' || l.status === 'stale') && !usable.some((l) => l.status === 'live')) {
    return usable.some((l) => l.status === 'stale') ? 'stale' : 'loading'
  }
  return 'live'
}

export function heatStatusNote(status: LayerStatus, cellCount: number): string {
  if (status === 'off') return 'Attention heat is off.'
  if (status === 'err') return 'HEAT ERR — enable at least two live layers. No cells are invented.'
  if (status === 'loading') return 'HEAT loading public-layer points…'
  if (status === 'stale') {
    return cellCount
      ? `${cellCount} attention cell${cellCount === 1 ? '' : 's'} from STALE leftover points.`
      : 'HEAT STALE — enabled layers are leftover data; no overlapping cells in this poll.'
  }
  return cellCount
    ? `${cellCount} attention cell${cellCount === 1 ? '' : 's'} (L ≥ 2 distinct layers).`
    : 'HEAT LIVE — no overlapping cells in the current poll. Empty is honest.'
}
