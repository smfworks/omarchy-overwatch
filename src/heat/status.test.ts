import { describe, expect, it } from 'vitest'
import { classifyHeatStatus, heatStatusNote } from './status'
import type { LayerState } from '../globe/types'

function layer(partial: Partial<LayerState> & Pick<LayerState, 'id' | 'enabled' | 'status'>): LayerState {
  return {
    label: partial.id,
    updatedAt: null,
    error: null,
    points: [],
    note: '',
    ...partial,
  }
}

describe('classifyHeatStatus', () => {
  it('is off when the toggle is down', () => {
    expect(
      classifyHeatStatus(false, [
        layer({ id: 'earthquakes', enabled: true, status: 'live' }),
        layer({ id: 'eonet', enabled: true, status: 'live' }),
      ]),
    ).toBe('off')
  })

  it('is err when fewer than two layers are enabled', () => {
    expect(classifyHeatStatus(true, [layer({ id: 'earthquakes', enabled: true, status: 'live' })])).toBe('err')
    expect(
      classifyHeatStatus(true, [
        layer({ id: 'earthquakes', enabled: false, status: 'off' }),
        layer({ id: 'eonet', enabled: false, status: 'off' }),
      ]),
    ).toBe('err')
    expect(heatStatusNote('err', 0)).toMatch(/ERR/)
  })

  it('is live with two enabled live layers even if no cells overlap', () => {
    expect(
      classifyHeatStatus(true, [
        layer({ id: 'earthquakes', enabled: true, status: 'live' }),
        layer({ id: 'eonet', enabled: true, status: 'live' }),
      ]),
    ).toBe('live')
    expect(heatStatusNote('live', 0)).toMatch(/Empty is honest/)
  })

  it('is stale when every usable layer is leftover data', () => {
    expect(
      classifyHeatStatus(true, [
        layer({ id: 'earthquakes', enabled: true, status: 'stale' }),
        layer({ id: 'eonet', enabled: true, status: 'stale' }),
      ]),
    ).toBe('stale')
  })
})
