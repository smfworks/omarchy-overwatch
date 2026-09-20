import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map, Marker, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeedGeometry } from '../globe/types'
import { BASEMAP_ATTRIBUTION, OPENFREEMAP_DARK } from './basemap'
import { OsmFallback } from './OsmFallback'

export function LocalityMap({
  lat,
  lng,
  label,
  geometry,
  markerColor = '#3ee0c8',
}: {
  lat: number
  lng: number
  label: string
  geometry?: FeedGeometry
  markerColor?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || failed) return
    let map: Map
    try {
      map = new Map({
        container: el,
        style: OPENFREEMAP_DARK,
        center: [lng, lat],
        zoom: 10.2,
        keyboard: false,
        attributionControl: { compact: true, customAttribution: BASEMAP_ATTRIBUTION },
      })
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'MapLibre failed to start')
      return
    }
    map.on('error', (ev) => {
      const msg = ev.error instanceof Error ? ev.error.message : 'map error'
      if (/webgl|context/i.test(msg)) setFailed(msg)
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    const marker = new Marker({ color: markerColor }).setLngLat([lng, lat]).addTo(map)
    marker.setPopup(new Popup({ closeButton: false }).setText(label))

    map.on('load', () => {
      if (!geometry?.type || geometry.coordinates == null) return
      const type = geometry.type
      if (type !== 'Polygon' && type !== 'MultiPolygon' && type !== 'LineString' && type !== 'MultiLineString') {
        return
      }
      if (map.getSource('selection-geom')) return
      map.addSource('selection-geom', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type, coordinates: geometry.coordinates } as GeoJSON.Geometry,
        },
      })
      map.addLayer({
        id: 'selection-fill',
        type: 'fill',
        source: 'selection-geom',
        filter: ['in', '$type', 'Polygon'],
        paint: { 'fill-color': markerColor, 'fill-opacity': 0.16 },
      })
      map.addLayer({
        id: 'selection-line',
        type: 'line',
        source: 'selection-geom',
        paint: { 'line-color': markerColor, 'line-width': 2, 'line-opacity': 0.85 },
      })
      try {
        const bounds = new LngLatBounds()
        const walk = (c: unknown): void => {
          if (!Array.isArray(c)) return
          if (typeof c[0] === 'number' && typeof c[1] === 'number') {
            bounds.extend([c[0] as number, c[1] as number])
            return
          }
          c.forEach(walk)
        }
        walk(geometry.coordinates)
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 800 })
      } catch {
        /* keep default zoom — do not invent a viewport */
      }
    })

    return () => {
      try {
        marker.remove()
        map.remove()
      } catch {
        /* MapLibre can throw if the WebGL context was already lost */
      }
    }
  }, [lat, lng, label, geometry, markerColor, failed])

  if (failed) {
    return <OsmFallback lat={lat} lng={lng} label={label} />
  }

  return <div ref={ref} className="locality-map" role="region" aria-label={`Locality map: ${label}`} />
}
