import { describe, expect, it } from 'vitest'
import { LAYER_DEFS } from './registry'

describe('live-layer registry', () => {
  it('is table-driven with unique ids, poll cadence, and new public layers', () => {
    const ids = LAYER_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['earthquakes', 'eonet', 'opensky', 'nws', 'ais', 'firms']))
    expect(ids).toEqual(expect.arrayContaining(['gdacs', 'celestrak', 'nhc', 'nifc', 'reliefweb']))
    for (const def of LAYER_DEFS) {
      expect(def.pollMs).toBeGreaterThanOrEqual(30_000)
      expect(def.label).toBeTruthy()
      expect(def.note.length).toBeGreaterThan(20)
      expect(typeof def.fetch).toBe('function')
    }
    expect(LAYER_DEFS.filter((d) => d.defaultOn).map((d) => d.id)).toEqual(['earthquakes', 'eonet'])
  })
})
