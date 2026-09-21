import { propagateTleRecords, type TleRecord } from './sgp4'
import type { GeoPoint } from './types'

export interface Sgp4Request {
  records: TleRecord[]
  epochMs: number
}

export interface Sgp4Response {
  ok: boolean
  points: GeoPoint[]
  error?: string
}

self.onmessage = (ev: MessageEvent<Sgp4Request>) => {
  const data = ev.data
  try {
    if (!data || !Array.isArray(data.records)) {
      const res: Sgp4Response = { ok: true, points: [] }
      self.postMessage(res)
      return
    }
    const points = propagateTleRecords(data.records, data.epochMs)
    const res: Sgp4Response = { ok: true, points }
    self.postMessage(res)
  } catch (err) {
    const res: Sgp4Response = {
      ok: false,
      points: [],
      error: err instanceof Error ? err.message : 'SGP4 worker failed',
    }
    self.postMessage(res)
  }
}
