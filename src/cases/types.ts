export type CasePin =
  | { type: 'tool'; id: string; label: string; url: string }
  | { type: 'hotspot'; id: string; label: string; lat: number; lng: number; url?: string }
  | {
      type: 'point'
      id: string
      label: string
      lat: number
      lng: number
      kind: string
      extra?: string
      url?: string
    }
  | {
      type: 'ticker'
      id: string
      label: string
      url: string
      source: string
      published?: string
      feedId?: string
    }

export interface CaseRecord {
  id: string
  name: string
  notes: string
  pins: CasePin[]
  createdAt: number
  updatedAt: number
}

export interface CaseStoreV1 {
  version: 1
  activeId: string | null
  cases: CaseRecord[]
}

export const CASES_KEY = 'omarchy-overwatch.cases.v1'
export const CASE_EXPORT_VERSION = 1 as const
