import type { StyleSpecification } from 'maplibre-gl'
import { BASEMAP_ATTRIBUTION, OSM_RASTER_TILES, RASTER_DARK_STYLE } from './basemap'

export const MAP_STYLE_IDS = ['default', 'satellite', 'night'] as const
export type MapStyleId = (typeof MAP_STYLE_IDS)[number]

/** Live OpenFreeMap dark vector — URL tracks upstream (no frozen glyph/sprite host). */
export const OPENFREEMAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** Esri World Imagery — keyless raster. Attribution required. Not a classified picture. */
export const ESRI_WORLD_IMAGERY_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
]

export const ESRI_IMAGERY_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'

export const OPENFREEMAP_ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'

export interface MapStyleMeta {
  id: MapStyleId
  label: string
  hud: string
  attribution: string
  note: string
}

export const MAP_STYLE_META: Record<MapStyleId, MapStyleMeta> = {
  default: {
    id: 'default',
    label: 'DEFAULT',
    hud: 'OSM raster',
    attribution: BASEMAP_ATTRIBUTION,
    note: 'Public OpenStreetMap raster tiles (no key). Same path as v2 locality/storm maps.',
  },
  satellite: {
    id: 'satellite',
    label: 'SATELLITE',
    hud: 'Esri imagery',
    attribution: ESRI_IMAGERY_ATTRIBUTION,
    note: 'Esri World Imagery raster. Keyless; attribution required. If tiles 403/fail, the map is empty — no imagery is invented.',
  },
  night: {
    id: 'night',
    label: 'NIGHT',
    hud: 'OpenFreeMap dark',
    attribution: OPENFREEMAP_ATTRIBUTION,
    note: 'OpenFreeMap dark vector style. If the vector style fails, falls back to darkened OSM raster — still OSM, not invented streets.',
  },
}

export function isMapStyleId(raw: unknown): raw is MapStyleId {
  return raw === 'default' || raw === 'satellite' || raw === 'night'
}

export function cycleMapStyleId(current: MapStyleId, dir: 1 | -1): MapStyleId {
  const i = MAP_STYLE_IDS.indexOf(current)
  const next = (i + dir + MAP_STYLE_IDS.length) % MAP_STYLE_IDS.length
  return MAP_STYLE_IDS[next]
}

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Overwatch Esri World Imagery',
  sources: {
    esri: {
      type: 'raster',
      tiles: ESRI_WORLD_IMAGERY_TILES,
      tileSize: 256,
      attribution: ESRI_IMAGERY_ATTRIBUTION,
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
}

/** Darkened OSM raster — NIGHT fallback when OpenFreeMap vector paint fails. */
export const NIGHT_RASTER_FALLBACK: StyleSpecification = {
  version: 8,
  name: 'Overwatch OSM night raster',
  sources: {
    osm: {
      type: 'raster',
      tiles: OSM_RASTER_TILES,
      tileSize: 256,
      attribution: `${BASEMAP_ATTRIBUTION} · night fallback`,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-saturation': -0.82,
        'raster-brightness-min': 0,
        'raster-brightness-max': 0.38,
        'raster-contrast': 0.12,
      },
    },
  ],
}

export function styleSpecFor(id: MapStyleId): StyleSpecification | string {
  if (id === 'satellite') return SATELLITE_STYLE
  if (id === 'night') return OPENFREEMAP_DARK_STYLE_URL
  return RASTER_DARK_STYLE as StyleSpecification
}

export function attributionFor(id: MapStyleId, extras: string[] = []): string {
  const parts = [MAP_STYLE_META[id].attribution, ...extras.filter(Boolean)]
  return [...new Set(parts)].join(' · ')
}
