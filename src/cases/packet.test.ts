import { describe, expect, it } from 'vitest'
import { createEmptyCase } from './storage'
import { exportCaseMarkdown, pinsToGeoJSON } from './packet'

describe('case packet', () => {
  it('exports operator notes and pin coords as markdown + GeoJSON without inventing intel', () => {
    const rec = createEmptyCase('Hormuz notes')
    rec.notes = 'Check public AIS only.'
    rec.pins = [
      { type: 'hotspot', id: 'strait-of-hormuz', label: 'Strait of Hormuz', lat: 26.5667, lng: 56.25 },
      { type: 'tool', id: 'marinetraffic', label: 'MarineTraffic', url: 'https://www.marinetraffic.com/' },
    ]
    const md = exportCaseMarkdown(rec, '2026-09-21T00:00:00.000Z')
    expect(md).toContain('# Hormuz notes')
    expect(md).toContain('Check public AIS only.')
    expect(md).toContain('Not a classified sitrep')
    expect(md).toContain('26.5667')
    const gj = pinsToGeoJSON(rec.pins)
    expect(gj.features).toHaveLength(1)
    expect(gj.features[0].geometry).toEqual({ type: 'Point', coordinates: [56.25, 26.5667] })
  })
})
