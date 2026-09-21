import { describe, expect, it } from 'vitest'
import { buildBriefSnapshot } from './snapshot'
import { parseOllamaContent, parseOpenAiContent } from './client'
import type { LayerState } from '../globe/types'

const layers: LayerState[] = [
  {
    id: 'earthquakes',
    label: 'USGS',
    enabled: true,
    status: 'live',
    updatedAt: 1,
    error: null,
    points: [{ id: 'eq-1', lat: 10, lng: 20, label: 'M3.1 demo', kind: 'quake', layerId: 'earthquakes' }],
    note: '',
  },
  {
    id: 'ais',
    label: 'AIS',
    enabled: false,
    status: 'off',
    updatedAt: null,
    error: null,
    points: [{ id: 'ghost-ship', lat: 1, lng: 2, label: 'should not appear', kind: 'vessel' }],
    note: '',
  },
]

describe('brief snapshot', () => {
  it('only includes on-screen public items and never pads missing fields', () => {
    const snap = buildBriefSnapshot({
      stage: 'globe',
      layers,
      heatEnabled: false,
      heatStatus: 'off',
      heatCells: [],
      selection: {
        kind: 'point',
        point: { id: 'eq-1', lat: 10, lng: 20, label: 'M3.1 demo', kind: 'quake', layerId: 'earthquakes' },
      },
      ticker: [{ id: 'bbc-1', source: 'BBC', title: 'Public headline', url: 'https://www.bbc.com/', published: null, feedId: 'bbc' }],
      now: new Date('2026-09-21T00:00:00.000Z'),
    })
    expect(snap.generatedAt).toBe('2026-09-21T00:00:00.000Z')
    expect(snap.points.map((p) => p.id)).toEqual(['eq-1'])
    expect(snap.points.some((p) => p.id === 'ghost-ship')).toBe(false)
    expect(snap.headlines).toHaveLength(1)
    expect(snap.selection).toMatchObject({ kind: 'point', id: 'eq-1' })
    expect(snap.heat.enabled).toBe(false)
    expect(JSON.stringify(snap)).not.toContain('classified')
  })
})

describe('model payload parsers', () => {
  it('reads OpenAI-compat and Ollama content without inventing text', () => {
    expect(parseOpenAiContent({ choices: [{ message: { content: '  cited USGS eq-1  ' } }] })).toBe('cited USGS eq-1')
    expect(parseOpenAiContent({ choices: [] })).toBeNull()
    expect(parseOllamaContent({ message: { content: 'UNKNOWN' } })).toBe('UNKNOWN')
    expect(parseOllamaContent({ error: 'model not found' })).toBeNull()
  })
})
