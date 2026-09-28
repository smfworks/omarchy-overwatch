import { describe, expect, it } from 'vitest'
import { beginLayerLoad, cancelLayerLoad, isCurrentLayerLoad, type LayerLoadEpochs } from './layerLoad'

describe('layer load epochs', () => {
  it('drops a FIRMS response that arrives after the layer is turned off', () => {
    const epochs: LayerLoadEpochs = {}
    const started = beginLayerLoad(epochs, 'firms')
    let enabled = true

    cancelLayerLoad(epochs, 'firms')
    enabled = false

    if (isCurrentLayerLoad(epochs, 'firms', started)) enabled = true
    expect(enabled).toBe(false)
    expect(isCurrentLayerLoad(epochs, 'firms', started)).toBe(false)
  })

  it('keeps only the newest load when a refresh overlaps', () => {
    const epochs: LayerLoadEpochs = {}
    const first = beginLayerLoad(epochs, 'firms')
    const second = beginLayerLoad(epochs, 'firms')
    expect(isCurrentLayerLoad(epochs, 'firms', first)).toBe(false)
    expect(isCurrentLayerLoad(epochs, 'firms', second)).toBe(true)
  })

  it('does not cancel a different layer', () => {
    const epochs: LayerLoadEpochs = {}
    const firms = beginLayerLoad(epochs, 'firms')
    const quakes = beginLayerLoad(epochs, 'earthquakes')
    cancelLayerLoad(epochs, 'firms')
    expect(isCurrentLayerLoad(epochs, 'firms', firms)).toBe(false)
    expect(isCurrentLayerLoad(epochs, 'earthquakes', quakes)).toBe(true)
  })
})
