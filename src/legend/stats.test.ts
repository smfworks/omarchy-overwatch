import { describe, expect, it } from 'vitest'
import { HOME_GLOBE_POV } from '../globe/camera'
import { LAYER_DEFS } from '../globe/registry'
import { LAYER_SWATCH } from './rows'
import { layerIdForShortcut, LAYER_SHORTCUTS } from './shortcuts'
import {
  diffEntityIds,
  formatEntityCount,
  formatEntityDelta,
  integrityGaps,
  layerEntityCounts,
} from './stats'
import { signalGuideText } from './guide'
import { THEATER_PRESETS } from './theaters'

describe('poll delta', () => {
  it('treats the first successful payload as a baseline', () => {
    const delta = diffEntityIds(null, ['eq-1', 'eq-1', 'eq-2'])
    expect(delta).toMatchObject({
      baseline: true,
      previousCount: null,
      count: 2,
      delta: null,
      added: 0,
      removed: 0,
    })
    expect(formatEntityDelta('USGS', delta)).toBe('USGS · baseline 2 · no prior poll')
  })

  it('counts id arrivals and departures without treating a swap as no change', () => {
    const delta = diffEntityIds(['a', 'b', 'b'], ['b', 'c'])
    expect(delta).toMatchObject({
      baseline: false,
      previousCount: 2,
      count: 2,
      delta: 0,
      added: 1,
      removed: 1,
    })
    expect(formatEntityDelta('FIRMS', delta)).toBe('FIRMS · Δ 0 · +1 new · −1 removed · 2')
  })

  it('says no change when the id set is stable, including an empty payload', () => {
    expect(formatEntityDelta('NHC', diffEntityIds(['s1'], ['s1']))).toBe('NHC · no change · 1')
    expect(formatEntityDelta('NHC', diffEntityIds([], []))).toBe('NHC · no change · 0')
    const grown = diffEntityIds(['a'], ['a', 'b', 'c'])
    expect(grown.delta).toBe(2)
    expect(formatEntityDelta('ADS-B', grown)).toBe('ADS-B · Δ +2 · +2 new · −0 removed · 3')
  })

  it('does not invent ids from blanks', () => {
    expect(diffEntityIds(null, ['', 'ok']).count).toBe(1)
    expect(diffEntityIds(['keep'], []).removed).toBe(1)
  })
})

describe('layer counts and gaps', () => {
  it('counts points already in state and hides disabled layers', () => {
    const counts = layerEntityCounts([
      { id: 'earthquakes', enabled: true, status: 'live', points: [{ id: 'a' }, { id: 'b' }] },
      { id: 'opensky', enabled: false, status: 'off', points: [{ id: 'ghost' }] },
    ])
    expect(counts).toEqual([
      { id: 'earthquakes', enabled: true, status: 'live', count: 2 },
      { id: 'opensky', enabled: false, status: 'off', count: 0 },
    ])
    expect(formatEntityCount({ enabled: true, status: 'loading', count: 0, hasPayload: false })).toBe('…')
    expect(formatEntityCount({ enabled: true, status: 'err', count: 0, hasPayload: false })).toBe('—')
    expect(formatEntityCount({ enabled: true, status: 'live', count: 0, hasPayload: true })).toBe('0')
    expect(formatEntityCount({ enabled: true, status: 'stale', count: 4, hasPayload: true })).toBe('4')
    expect(formatEntityCount({ enabled: false, status: 'off', count: 0, hasPayload: false })).toBe('—')
  })

  it('flags only enabled ERR and STALE layers', () => {
    const gaps = integrityGaps([
      { id: 'earthquakes', label: 'USGS', enabled: true, status: 'stale', error: 'HTTP 429' },
      { id: 'eonet', label: 'EONET', enabled: true, status: 'live', error: null },
      { id: 'opensky', label: 'ADS-B', enabled: true, status: 'err', error: '  missing key  ' },
      { id: 'ais', label: 'AIS', enabled: false, status: 'err', error: 'no key' },
      { id: 'firms', label: 'FIRMS', enabled: true, status: 'loading', error: null },
    ])
    expect(gaps.map((gap) => `${gap.id}:${gap.status}`)).toEqual(['earthquakes:stale', 'opensky:err'])
    expect(gaps[1]?.detail).toBe('missing key')
    expect(integrityGaps([{ id: 'nhc', label: 'NHC', enabled: true, status: 'live', error: null }])).toEqual([])
  })
})

describe('shortcuts, theaters, guide', () => {
  it('maps a few layer keys and refuses keys the HUD already uses', () => {
    expect(layerIdForShortcut('q')).toBe('earthquakes')
    expect(layerIdForShortcut('F')).toBe('firms')
    expect(layerIdForShortcut('b')).toBeNull()
    expect(layerIdForShortcut('g')).toBeNull()
    expect(layerIdForShortcut('?')).toBeNull()
    expect(new Set(LAYER_SHORTCUTS.map((row) => row.layerId)).size).toBe(LAYER_SHORTCUTS.length)
  })

  it('keeps a swatch for every registered layer and a home theater', () => {
    expect(Object.keys(LAYER_SWATCH).sort()).toEqual(LAYER_DEFS.map((def) => def.id).sort())
    expect(THEATER_PRESETS.map((row) => row.id)).toContain('world')
    expect(THEATER_PRESETS[0]?.pov).toEqual(HOME_GLOBE_POV)
    expect(new Set(THEATER_PRESETS.map((row) => row.id)).size).toBe(THEATER_PRESETS.length)
  })

  it('states search, status, and delta limits in the signal guide', () => {
    const text = signalGuideText()
    expect(text).toMatch(/does not scrape/i)
    expect(text).toMatch(/baseline/)
    expect(text).toMatch(/STALE is a source gap/)
    expect(text).toMatch(/not a situation report/i)
    expect(text).toMatch(/thermal detections/i)
    expect(text).toMatch(/not strikes/i)
    expect(text).toMatch(/country-anchor/i)
    expect(text).toMatch(/real track/i)
    expect(text).toMatch(/does not add jitter/i)
  })
})
