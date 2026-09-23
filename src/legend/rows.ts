import { colorForKind } from '../globe/colors'
import type { GeoKind } from '../globe/types'

/** Marker color for each registered layer. Heat stays a separate overlay key. */
export const LAYER_SWATCH: Record<string, { kind: GeoKind; color: string }> = {
  earthquakes: { kind: 'quake', color: colorForKind('quake') },
  eonet: { kind: 'event', color: colorForKind('event') },
  opensky: { kind: 'aircraft', color: colorForKind('aircraft') },
  nws: { kind: 'alert', color: colorForKind('alert') },
  ais: { kind: 'vessel', color: colorForKind('vessel') },
  firms: { kind: 'fire', color: colorForKind('fire') },
  gdacs: { kind: 'hazard', color: colorForKind('hazard') },
  celestrak: { kind: 'sat', color: colorForKind('sat') },
  nhc: { kind: 'hazard', color: colorForKind('hazard') },
  nifc: { kind: 'fire', color: colorForKind('fire') },
  reliefweb: { kind: 'event', color: colorForKind('event') },
}

export const HEAT_LEGEND = [
  { id: 'heat2', label: 'L=2', color: 'rgba(62, 224, 200, 0.45)' },
  { id: 'heat3', label: 'L=3', color: 'rgba(232, 184, 74, 0.5)' },
  { id: 'heat4', label: 'L=4+', color: 'rgba(255, 93, 108, 0.55)' },
] as const

export function swatchForLayer(id: string): string {
  return LAYER_SWATCH[id]?.color ?? colorForKind('event')
}
