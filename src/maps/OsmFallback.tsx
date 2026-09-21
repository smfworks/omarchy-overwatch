/** iframe OSM embed — no API key, no WebGL. Used when MapLibre cannot start. */
export function OsmFallback({
  lat,
  lng,
  zoom = 10,
  label,
}: {
  lat: number
  lng: number
  zoom?: number
  label: string
}) {
  const delta = zoom >= 10 ? 0.08 : 0.35
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`
  return (
    <div className="osm-fallback">
      <iframe title={`OpenStreetMap: ${label}`} src={src} className="osm-frame" />
      <div className="disclaimer osm-note">
        MapLibre WebGL was unavailable — showing the public OpenStreetMap embed instead. Roads/borders are OSM
        tiles, not invented. © OpenStreetMap contributors.
      </div>
    </div>
  )
}
