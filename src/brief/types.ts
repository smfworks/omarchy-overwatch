export const BRIEF_KEY = 'omarchy-overwatch.brief.v1'
export const OLLAMA_ORIGIN = 'http://127.0.0.1:11434'
export const BRIEF_POINTS_CAP = 40
export const BRIEF_HEADLINES_CAP = 12
export const BRIEF_CELLS_CAP = 12

export type BriefProvider = 'ollama' | 'openai-compat'
export type BriefStatus = 'off' | 'loading' | 'live' | 'err'

export interface BriefPrefsV1 {
  version: 1
  enabled: boolean
  provider: BriefProvider
  baseUrl: string
  apiKey: string
  model: string
}

export const DEFAULT_BRIEF_PREFS: BriefPrefsV1 = {
  version: 1,
  enabled: false,
  provider: 'ollama',
  baseUrl: OLLAMA_ORIGIN,
  apiKey: '',
  model: 'llama3.2',
}

export interface BriefSnapshot {
  generatedAt: string
  disclaimer: string
  stage: string
  layers: {
    id: string
    label: string
    enabled: boolean
    status: string
    pointCount: number
    error: string | null
    updatedAt: number | null
  }[]
  heat: {
    enabled: boolean
    status: string
    formula: string
    cellCount: number
    selected: null | {
      id: string
      lat: number
      lng: number
      layerCount: number
      pointCount: number
      z: number
      contributors: { layerId: string; layerLabel: string; count: number }[]
      events: { id: string; layerId: string; label: string; lat: number; lng: number; kind: string }[]
    }
    cells: { id: string; lat: number; lng: number; layerCount: number; pointCount: number; z: number }[]
  }
  selection: Record<string, unknown> | null
  points: {
    id: string
    layerId: string
    label: string
    lat: number
    lng: number
    kind: string
    extra?: string
    observedAt?: string
  }[]
  headlines: { id: string; source: string; title: string; url: string; published: string | null }[]
}

export interface BriefResult {
  status: 'live' | 'err' | 'loading'
  text: string | null
  error: string | null
  model: string | null
  provider: BriefProvider | null
  generatedAt: number | null
}
