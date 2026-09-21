import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map, Marker, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeedGeometry } from '../globe/types'
import { cellsToFeatureCollection } from '../heat/geojson'
import type { HeatCell } from '../heat/types'
import { BASEMAP_ATTRIBUTION, RASTER_DARK_STYLE } from './basemap'
import { OsmFallback } from './OsmFallback'

export interface ExtraMapMarker {
  id: string
  lat: number
  lng: number
  label: string
  color: string
}

export function LocalityMap({
  lat,
  lng,
  label,
  geometry,
  markerColor = '#3ee0c8',
  heatCells,
  selectedHeatId,
  onHeatClick,
  extraMarkers,
  onMarkerClick,
  fitHeat = false,
}: {
  lat: number
  lng: number
  label: string
  geometry?: FeedGeometry
  markerColor?: string
  heatCells?: HeatCell[]
  selectedHeatId?: string | null
  onHeatClick?: (id: string) => void
  extraMarkers?: ExtraMapMarker[]
  onMarkerClick?: (id: string) => void
  fitHeat?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const heatClickRef = useRef(onHeatClick)
  const markerClickRef = useRef(onMarkerClick)
  heatClickRef.current = onHeatClick
  markerClickRef.current = onMarkerClick

  useEffect(() => {
    const el = ref.current
    if (!el || failed) return
    let map: Map
    try {
      map = new Map({
        container: el,
        style: RASTER_DARK_STYLE,
        center: [lng, lat],
        zoom: fitHeat ? 6.2 : 10.2,
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
    const extras: Marker[] = []
    for (const m of extraMarkers ?? []) {
      const mk = new Marker({ color: m.color, scale: 0.72 }).setLngLat([m.lng, m.lat]).addTo(map)
      mk.setPopup(new Popup({ closeButton: false }).setText(m.label))
      mk.getElement().style.cursor = 'pointer'
      mk.getElement().addEventListener('click', (ev) => {
        ev.stopPropagation()
        markerClickRef.current?.(m.id)
      })
      extras.push(mk)
    }

    map.on('load', () => {
      if (geometry?.type && geometry.coordinates != null) {
        const type = geometry.type
        if (type === 'Polygon' || type === 'MultiPolygon' || type === 'LineString' || type === 'MultiLineString') {
          if (!map.getSource('selection-geom')) {
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
          }
        }
      }

      if (heatCells?.length) {
        map.addSource('heat-cells', {
          type: 'geojson',
          data: cellsToFeatureCollection(heatCells, selectedHeatId),
        })
        map.addLayer({
          id: 'heat-fill',
          type: 'fill',
          source: 'heat-cells',
          paint: {
            'fill-color': ['get', 'fill'],
            'fill-opacity': 1,
          },
        })
        map.addLayer({
          id: 'heat-line',
          type: 'line',
          source: 'heat-cells',
          paint: {
            'line-color': ['get', 'stroke'],
            'line-width': ['case', ['==', ['get', 'selected'], 1], 2.4, 1.2],
            'line-opacity': 0.9,
          },
        })
        map.on('click', 'heat-fill', (ev) => {
          const id = ev.features?.[0]?.properties?.id
          if (typeof id === 'string' && id) heatClickRef.current?.(id)
        })
        map.on('mouseenter', 'heat-fill', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'heat-fill', () => {
          map.getCanvas().style.cursor = ''
        })
        if (fitHeat) {
          const selected = heatCells.find((c) => c.id === selectedHeatId) ?? heatCells[0]
          try {
            const bounds = new LngLatBounds()
            for (const [x, y] of selected.ring) bounds.extend([x, y])
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 7.5, duration: 600 })
          } catch {
            /* keep default zoom */
          }
        }
      }
    })

    return () => {
      try {
        marker.remove()
        extras.forEach((m) => m.remove())
        map.remove()
      } catch {
        /* MapLibre can throw if the WebGL context was already lost */
      }
    }
  }, [lat, lng, label, geometry, markerColor, failed, heatCells, selectedHeatId, extraMarkers, fitHeat])

  if (failed) {
    return <OsmFallback lat={lat} lng={lng} label={label} />
  }

  return <div ref={ref} className="locality-map" role="region" aria-label={`Locality map: ${label}`} />
}
