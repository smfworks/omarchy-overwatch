import type { GeoKind } from '../globe/types'

const AIRCRAFT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2 14.2 9H21l-2.4 2.2L21 13.4h-6.8L12 21.8l-2.2-8.4H3l2.4-2.2L3 9h6.8Z"/></svg>`
const VESSEL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 19 9.2v3.1l-7 8.7-7-8.7V9.2L12 3zm0 3.4L8 9.8v1.6l4 5 4-5V9.8l-4-3.4z"/></svg>`
const SAT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.2 3.4 10.6 5.8 8.8 7.6 6.4 5.2 8.2 3.4zm9.4 9.4 2.4 2.4-1.8 1.8-2.4-2.4 1.8-1.8zM9.7 8.5l5.8 5.8-1.2 1.2-5.8-5.8L9.7 8.5zM4 14.2 9.8 20l1.5-1.5-5.8-5.8L4 14.2zm10.2-10.2L20 9.8l-1.5 1.5-5.8-5.8 1.5-1.5z"/></svg>`

export function craftKind(kind: GeoKind | string | undefined): 'aircraft' | 'vessel' | 'sat' | null {
  if (kind === 'aircraft') return 'aircraft'
  if (kind === 'vessel') return 'vessel'
  if (kind === 'sat') return 'sat'
  return null
}

export function craftSvg(kind: 'aircraft' | 'vessel' | 'sat'): string {
  if (kind === 'aircraft') return AIRCRAFT
  if (kind === 'vessel') return VESSEL
  return SAT
}

export function craftMarkerElement(
  kind: GeoKind | string,
  color: string,
  heading: number | undefined,
  label: string,
): HTMLDivElement {
  const el = document.createElement('div')
  const ck = craftKind(kind)
  el.className = ck ? `craft-marker craft-${ck}` : 'heading-marker'
  el.style.setProperty('--hm-color', color)
  el.style.color = color
  if (heading != null && Number.isFinite(heading)) {
    el.style.transform = `rotate(${heading}deg)`
  }
  el.title = label
  el.setAttribute('aria-label', label)
  if (ck) el.innerHTML = craftSvg(ck)
  return el
}
