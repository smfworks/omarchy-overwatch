import {
  fetchAis,
  fetchCelestrak,
  fetchEarthquakes,
  fetchEonet,
  fetchFirms,
  fetchGdacs,
  fetchNhc,
  fetchNifc,
  fetchNwsAlerts,
  fetchOpenSky,
  fetchReliefWeb,
} from './layers'
import type { LayerDef } from './types'

/**
 * Table-driven live-layer registry.
 * Add a row (fetch + poll + note) — App.tsx already maps toggles, status, and heat from this list.
 */
export const LAYER_DEFS: readonly LayerDef[] = [
  {
    id: 'earthquakes',
    label: 'USGS',
    catalogId: 'usgs-eq',
    pollMs: 120_000,
    defaultOn: true,
    note: 'USGS earthquakes M2.5+ past 24h via earthquake.usgs.gov (no key).',
    fetch: fetchEarthquakes,
  },
  {
    id: 'eonet',
    label: 'EONET',
    catalogId: 'eonet',
    pollMs: 180_000,
    defaultOn: true,
    note: 'NASA EONET open natural events (fires, storms, volcanoes).',
    fetch: fetchEonet,
  },
  {
    id: 'opensky',
    label: 'ADS-B',
    catalogId: 'opensky',
    pollMs: 90_000,
    note: 'OpenSky sampled aircraft states (not full-sky). Heading/speed/alt when the feed sent them. Optional OPENSKY_CLIENT_ID/SECRET (OAuth2) or OPENSKY_USERNAME/PASSWORD (legacy). 401/429 are ERR, not fake tracks.',
    fetch: fetchOpenSky,
  },
  {
    id: 'nws',
    label: 'NWS',
    pollMs: 120_000,
    note: 'api.weather.gov active alerts. US-only, no key.',
    fetch: fetchNwsAlerts,
  },
  {
    id: 'ais',
    label: 'AIS',
    pollMs: 90_000,
    note: 'AISStream maritime snapshot. Requires AISSTREAM_API_KEY in .env. Sampled live positions only — never invented. Course/SOG when present.',
    fetch: fetchAis,
  },
  {
    id: 'firms',
    label: 'FIRMS',
    catalogId: 'firms',
    pollMs: 180_000,
    note: 'NASA FIRMS VIIRS detections (public 24h CSV, or FIRMS_MAP_KEY API). Sampled by FRP; no invented fires.',
    fetch: fetchFirms,
  },
  {
    id: 'gdacs',
    label: 'GDACS',
    catalogId: 'gdacs',
    pollMs: 180_000,
    note: 'GDACS hazard GeoJSON (event points + feed bbox; sampled TC/FL polygons when getgeometry returns one). No invented perimeters.',
    fetch: fetchGdacs,
  },
  {
    id: 'celestrak',
    label: 'SAT',
    catalogId: 'celestrak',
    pollMs: 45_000,
    note: 'CelesTrak sampled TLEs (stations + visual groups), SGP4 in a Web Worker. Not a full catalog — empty/ERR if TLEs fail.',
    fetch: fetchCelestrak,
  },
  {
    id: 'nhc',
    label: 'NHC',
    catalogId: 'nhc',
    pollMs: 180_000,
    note: 'NOAA NHC CurrentStorms.json. Empty LIVE off-season is honest. No invented forecast cones.',
    fetch: fetchNhc,
  },
  {
    id: 'nifc',
    label: 'NIFC',
    catalogId: 'nifc-perimeters',
    pollMs: 180_000,
    note: 'NIFC WFIGS current incident perimeters (public ArcGIS GeoJSON, sampled by acres). US only.',
    fetch: fetchNifc,
  },
  {
    id: 'reliefweb',
    label: 'RW',
    catalogId: 'reliefweb',
    pollMs: 180_000,
    note: 'ReliefWeb disasters API with coordinates when the record has them. 406/empty is ERR/empty — no invented geo.',
    fetch: fetchReliefWeb,
  },
]
