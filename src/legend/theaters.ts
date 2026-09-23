import { HOME_GLOBE_POV } from '../globe/camera'
import type { CameraPov } from '../state/context'

export interface TheaterPreset {
  id: string
  label: string
  /** Camera only. Not a feed filter and not a situation report. */
  pov: CameraPov
}

export const THEATER_PRESETS: readonly TheaterPreset[] = [
  { id: 'world', label: 'WORLD', pov: { ...HOME_GLOBE_POV } },
  { id: 'americas', label: 'AMERICAS', pov: { lat: 12, lng: -78, altitude: 1.55 } },
  { id: 'europe', label: 'EUROPE', pov: { lat: 50, lng: 14, altitude: 1.05 } },
  { id: 'mideast', label: 'MIDEAST', pov: { lat: 28, lng: 44, altitude: 1.05 } },
  { id: 'africa', label: 'AFRICA', pov: { lat: 4, lng: 22, altitude: 1.35 } },
  { id: 'asiapac', label: 'ASIA-PAC', pov: { lat: 18, lng: 118, altitude: 1.4 } },
]

export function theaterById(id: string): TheaterPreset | null {
  return THEATER_PRESETS.find((row) => row.id === id) ?? null
}
