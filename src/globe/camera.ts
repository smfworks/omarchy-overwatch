import type { CameraPov } from '../state/context'

/** Default globe camera used on first ready and when no pre-zoom POV was captured. */
export const HOME_GLOBE_POV: CameraPov = { lat: 18, lng: 25, altitude: 2.4 }

export function isUsablePov(pov: CameraPov | null | undefined): pov is CameraPov {
  return Boolean(
    pov &&
      Number.isFinite(pov.lat) &&
      Number.isFinite(pov.lng) &&
      Number.isFinite(pov.altitude) &&
      pov.altitude > 0,
  )
}

/**
 * Remember the globe camera from before a hotspot/locality fly.
 * A later zoomed reading must not replace a POV already captured.
 */
export function captureRestorePov(saved: CameraPov | null, live: CameraPov | null): CameraPov {
  if (isUsablePov(saved)) return { lat: saved.lat, lng: saved.lng, altitude: saved.altitude }
  if (isUsablePov(live)) return { lat: live.lat, lng: live.lng, altitude: live.altitude }
  return { ...HOME_GLOBE_POV }
}
