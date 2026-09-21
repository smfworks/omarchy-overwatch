import { describe, expect, it } from 'vitest'
import type { OsintTool } from '../catalog/types'
import { searchWorkspace } from './query'

const tool: OsintTool = {
  id: 'shodan',
  name: 'Shodan',
  category: 'domain-network',
  url: 'https://www.shodan.io/',
  description: 'Search engine for internet-connected devices.',
  tags: ['devices', 'banners'],
  opsec: 'passive',
  pricing: 'freemium',
  inputs: ['ip', 'query'],
}

describe('global search', () => {
  it('ranks catalog tools, live points, heat, ticker, and pins from the query', () => {
    const hits = searchWorkspace('quake hormuz', {
      tools: [tool],
      points: [
        {
          id: 'eq-1',
          lat: 26.5,
          lng: 56.2,
          label: 'M4.1 Hormuz earthquake',
          kind: 'quake',
          layerId: 'earthquakes',
        },
      ],
      cells: [
        {
          id: 'cell-1',
          res: 4,
          lat: 26.5,
          lng: 56.2,
          ring: [],
          layerCount: 2,
          pointCount: 4,
          score: 2,
          z: 0,
          contributors: [{ layerId: 'earthquakes', layerLabel: 'USGS', count: 2 }],
          events: [{ id: 'eq-1', layerId: 'earthquakes', layerLabel: 'USGS', label: 'M4.1', lat: 26.5, lng: 56.2, kind: 'quake' }],
          hotspots: [],
        },
      ],
      ticker: [{ id: 't1', title: 'Quake strikes strait', url: 'https://example.com/n', source: 'BBC', published: null, feedId: 'bbc' }],
      pins: [{ type: 'hotspot', id: 'strait-of-hormuz', label: 'Strait of Hormuz', lat: 26.56, lng: 56.25 }],
    })
    expect(hits.some((h) => h.kind === 'point' && h.title.includes('Hormuz'))).toBe(true)
    expect(hits.some((h) => h.kind === 'ticker')).toBe(true)
    expect(hits.some((h) => h.kind === 'pin')).toBe(true)
    expect(searchWorkspace('', { tools: [tool], points: [], cells: [], ticker: [], pins: [] })).toEqual([])
  })

  it('does not invent a hit for a tool that is not in the catalog', () => {
    const hits = searchWorkspace('not-a-real-scanner', {
      tools: [tool],
      points: [],
      cells: [],
      ticker: [],
      pins: [],
    })
    expect(hits).toEqual([])
  })
})
