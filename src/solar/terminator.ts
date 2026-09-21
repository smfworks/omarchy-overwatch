/** Approximate solar subsolar point and terminator ring. Aesthetic globe overlay only. */

export function solarSubpoint(at = Date.now()): { lat: number; lng: number } {
  const date = new Date(at)
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const day = (at - start) / 86_400_000
  const decl = -23.44 * Math.cos((2 * Math.PI * (day + 10)) / 365)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lng = 15 * (12 - utcHours)
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180
  return { lat: decl, lng: wrapped }
}

function dest(lat: number, lng: number, bearingDeg: number, distRad: number): [number, number] {
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const br = (bearingDeg * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distRad) + Math.cos(lat1) * Math.sin(distRad) * Math.cos(br))
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(distRad) * Math.cos(lat1),
      Math.cos(distRad) - Math.sin(lat1) * Math.sin(lat2),
    )
  return [(lat2 * 180) / Math.PI, ((((lng2 * 180) / Math.PI + 180) % 360) + 360) % 360 - 180]
}

/** Great-circle ring 90° from the subsolar point. Split if it crosses the antimeridian. */
export function terminatorCoords(at = Date.now(), steps = 72): [number, number][][] {
  const sun = solarSubpoint(at)
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 360
    pts.push(dest(sun.lat, sun.lng, bearing, Math.PI / 2))
  }
  const parts: [number, number][][] = []
  let current: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const prev = current[current.length - 1]
    const next = pts[i]
    if (Math.abs(next[1] - prev[1]) > 180) {
      if (current.length >= 2) parts.push(current)
      current = [next]
    } else {
      current.push(next)
    }
  }
  if (current.length >= 2) parts.push(current)
  return parts
}
