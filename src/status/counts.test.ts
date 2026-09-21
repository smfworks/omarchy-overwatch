import { describe, expect, it } from 'vitest'
import type { LayerState } from '../globe/types'
import { countLayerStatuses, statusCountsLabel } from './counts'

function layer(status: LayerState['status'], enabled = true): LayerState {
  return { id: status, label: status, enabled, status, updatedAt: null, error: null, points: [], note: '' }
}

describe('status counts', () => {
  it('summarizes LIVE / STALE / ERR without inventing a healthy feed', () => {
    const counts = countLayerStatuses(
      [layer('live'), layer('stale'), layer('err'), layer('off', false), layer('loading')],
      [{ enabled: true, status: 'live' }],
    )
    expect(counts.live).toBe(2)
    expect(counts.stale).toBe(1)
    expect(counts.err).toBe(1)
    expect(statusCountsLabel(counts)).toBe('LIVE 2 · STALE 1 · ERR 1')
  })
})
