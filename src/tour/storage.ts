export const TOUR_KEY = 'omarchy-overwatch.tour.v1'

export interface TourPrefsV1 {
  version: 1
  completed: boolean
}

export const TOUR_STEPS = [
  {
    id: 'honesty',
    title: 'Honesty first',
    body: 'Every live layer is LIVE, STALE, ERR, or OFF. Empty means the public feed sent nothing — Overwatch OSINT for Omarchy never invents quakes, ships, fires, or sitreps.',
  },
  {
    id: 'layers',
    title: 'Public layers',
    body: 'The sensor legend and status strip toggle USGS, EONET, ADS-B, NWS, AIS, FIRMS, GDACS, SAT, NHC, NIFC, and ReliefWeb. Keys q, e, a, and f toggle USGS, EONET, ADS-B, and FIRMS. A missing key is ERR, not fake tracks. Poll Δ compares ids after a real fetch.',
  },
  {
    id: 'heat',
    title: 'HEAT attention',
    body: 'HEAT is an H3 overlay. L is the count of distinct enabled live/stale layers that already have a real point in that cell. Color maps from L only. Not a threat score.',
  },
  {
    id: 'brief',
    title: 'On-screen brief',
    body: 'BRIEF is off by default. Enable it in Help (?) with local Ollama or a BYOK HTTPS key stored only in this browser. The model sees on-screen public feeds — not classified intel.',
  },
  {
    id: 'styles',
    title: 'MAP styles',
    body: 'Locality and storm maps use DEFAULT (OSM), SATELLITE (Esri, attributed), or NIGHT (OpenFreeMap). Keys [ and ] cycle. NVG / FLIR / CRT are aesthetic overlays, not sensors.',
  },
  {
    id: 'search',
    title: 'Global search',
    body: 'Press ⌘K or Ctrl+K to search catalog tools, live points, HEAT cells, ticker headlines, and case pins. Select a hit to focus the globe/map or open depth. / still filters the catalog.',
  },
  {
    id: 'aoi',
    title: 'AOI + time',
    body: 'On a locality map, draw a rectangle or polygon AOI to clip visible points and heat. Use the time scrubber (1h / 6h / 24h) only on dated public points already polled — history is never fabricated.',
  },
] as const

export function loadTourCompleted(): boolean {
  try {
    const raw = localStorage.getItem(TOUR_KEY)
    if (!raw) return false
    const row = JSON.parse(raw) as { version?: unknown; completed?: unknown }
    return row.version === 1 && row.completed === true
  } catch {
    return false
  }
}

export function saveTourCompleted(completed: boolean): void {
  localStorage.setItem(TOUR_KEY, JSON.stringify({ version: 1, completed }))
}
