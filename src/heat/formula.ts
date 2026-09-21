import { HEAT_MIN_LAYERS, HEAT_RES } from './types'

/** Short formula for tooltips and status chrome. */
export const HEAT_FORMULA_LINE =
  `H3 res ${HEAT_RES} (~1,770 km²). L = distinct enabled live/stale layers with a real point in the cell. Attention iff L ≥ ${HEAT_MIN_LAYERS}. Color from L; z = (L − mean L) / σ among attention cells.`

/** Longer copy for help + README. Keep in sync with score.ts. */
export const HEAT_FORMULA_HELP = `Attention heat is a local overlay, not a classified sitrep.

Grid: Uber H3 hexagons at resolution ${HEAT_RES} (average cell area about 1,770 km²). Only the current in-memory poll is used — the same points already on USGS, EONET, ADS-B, NWS, AIS, and FIRMS when those toggles are LIVE or STALE (loading keeps leftover points). Demo hotspots that fall in a cell are listed as navigation geography and do not count toward the score.

Score L = number of distinct live-layer ids with at least one real feed point in the cell. A cell is drawn only when L ≥ ${HEAT_MIN_LAYERS}. Color/intensity maps from L (2 cyan, 3 amber, 4+ red). A z-score of L versus the mean L of currently drawn attention cells is shown in the dossier: z = (L − mean) / population σ; z is 0 when there are fewer than two cells or σ is 0. No ML ranker, no hidden weights, no invented coordinates.`

export function heatFillColor(layerCount: number, selected = false): string {
  const alpha = selected ? 0.42 : 0.22
  if (layerCount >= 4) return `rgba(255, 93, 108, ${alpha})`
  if (layerCount === 3) return `rgba(232, 184, 74, ${alpha})`
  return `rgba(62, 224, 200, ${alpha})`
}

export function heatStrokeColor(layerCount: number, selected = false): string {
  if (selected) return '#d7e4f2'
  if (layerCount >= 4) return '#ff5d6c'
  if (layerCount === 3) return '#e8b84a'
  return '#3ee0c8'
}
