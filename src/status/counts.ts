import type { LayerState, LayerStatus } from '../globe/types'
import type { FeedStatus } from '../feeds/rss'

export interface StatusCounts {
  live: number
  stale: number
  err: number
  off: number
  loading: number
}

function bump(counts: StatusCounts, status: LayerStatus | FeedStatus | string, enabled: boolean): void {
  if (!enabled || status === 'off' || status === 'empty') {
    counts.off += 1
    return
  }
  if (status === 'live') counts.live += 1
  else if (status === 'stale') counts.stale += 1
  else if (status === 'err') counts.err += 1
  else counts.loading += 1
}

export function countLayerStatuses(
  layers: LayerState[],
  extras: { enabled: boolean; status: string }[] = [],
): StatusCounts {
  const counts: StatusCounts = { live: 0, stale: 0, err: 0, off: 0, loading: 0 }
  for (const layer of layers) bump(counts, layer.status, layer.enabled)
  for (const extra of extras) bump(counts, extra.status, extra.enabled)
  return counts
}

export function statusCountsLabel(counts: StatusCounts): string {
  return `LIVE ${counts.live} · STALE ${counts.stale} · ERR ${counts.err}`
}
