import { MAP_STYLE_META, type MapStyleId } from './styles'
import { craftKind, craftMarkerElement } from '../craft/icons'

export function headingMarkerElement(color: string, headingDeg: number, label: string): HTMLDivElement {
  return craftMarkerElement('aircraft', color, headingDeg, label)
}

export function markerElement(
  color: string,
  label: string,
  opts?: { heading?: number; kind?: string },
): HTMLDivElement | undefined {
  if (craftKind(opts?.kind) || opts?.heading != null) {
    return craftMarkerElement(opts?.kind ?? 'aircraft', color, opts?.heading, label)
  }
  return undefined
}

export function mapFxClass(nvg: boolean, extra?: string): string {
  const parts = ['map-stage']
  if (nvg) parts.push('nvg')
  if (extra) parts.push(extra)
  return parts.join(' ')
}

export function styleHudLine(style: MapStyleId): string {
  return `MAP ${MAP_STYLE_META[style].label}`
}
