/** OpenFreeMap dark vector style — no API key. Roads, borders, water, labels. */
export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark'

export const BASEMAP_ATTRIBUTION =
  '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'

export const RAINVIEWER_MAPS_URL = '/proxy/rainviewer/public/weather-maps.json'

export interface RainViewerFrame {
  time: number
  path: string
}

export interface RainViewerMaps {
  host: string
  frames: RainViewerFrame[]
}

export async function fetchRainViewerMaps(): Promise<RainViewerMaps> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(RAINVIEWER_MAPS_URL, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      host?: string
      radar?: { past?: RainViewerFrame[]; nowcast?: RainViewerFrame[] }
    }
    const past = Array.isArray(data.radar?.past) ? data.radar.past : []
    const nowcast = Array.isArray(data.radar?.nowcast) ? data.radar.nowcast : []
    const frames = [...past, ...nowcast].filter(
      (f) => typeof f?.time === 'number' && typeof f?.path === 'string' && f.path.startsWith('/'),
    )
    if (!frames.length) throw new Error('RainViewer returned no radar frames')
    const host = typeof data.host === 'string' && data.host ? data.host : 'https://tilecache.rainviewer.com'
    return { host: host.replace(/\/$/, ''), frames }
  } finally {
    clearTimeout(t)
  }
}

export function rainviewerTileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`
}
