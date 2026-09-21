import { MAP_STYLE_META, type MapStyleId } from './styles'

export function headingMarkerElement(color: string, headingDeg: number, label: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'heading-marker'
  el.style.setProperty('--hm-color', color)
  el.style.transform = `rotate(${headingDeg}deg)`
  el.title = label
  el.setAttribute('aria-label', label)
  return el
}

export function mapFxClass(nvg: boolean): string {
  return nvg ? 'map-stage nvg' : 'map-stage'
}

export function styleHudLine(style: MapStyleId): string {
  return `MAP ${MAP_STYLE_META[style].label}`
}
