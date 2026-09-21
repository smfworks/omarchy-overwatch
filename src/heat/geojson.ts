import { heatFillColor, heatStrokeColor } from './formula'
import { HEAT_GLOBE_CAP, type HeatCell } from './types'

export interface HeatPolygon {
  id: string
  name: string
  color: string
  stroke: string
  altitude: number
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
}

export function cellsToFeatureCollection(
  cells: HeatCell[],
  selectedId?: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature' as const,
      id: cell.id,
      properties: {
        id: cell.id,
        layerCount: cell.layerCount,
        pointCount: cell.pointCount,
        selected: cell.id === selectedId ? 1 : 0,
        fill: heatFillColor(cell.layerCount, cell.id === selectedId),
        stroke: heatStrokeColor(cell.layerCount, cell.id === selectedId),
      },
      geometry: { type: 'Polygon' as const, coordinates: [cell.ring] },
    })),
  }
}

export function cellsToGlobePolygons(cells: HeatCell[], selectedId?: string | null): HeatPolygon[] {
  return cells.slice(0, HEAT_GLOBE_CAP).map((cell) => ({
    id: cell.id,
    name: `L=${cell.layerCount} · ${cell.pointCount} pts · H3 ${cell.id}`,
    color: heatFillColor(cell.layerCount, cell.id === selectedId),
    stroke: heatStrokeColor(cell.layerCount, cell.id === selectedId),
    altitude: cell.id === selectedId ? 0.008 : 0.003,
    geometry: { type: 'Polygon', coordinates: [cell.ring] },
  }))
}
