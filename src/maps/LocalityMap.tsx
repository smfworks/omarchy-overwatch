import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map, Marker, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeedGeometry } from '../globe/types'
import type { TrackTrail } from '../globe/tracks'
import { cellsToFeatureCollection } from '../heat/geojson'
import type { HeatCell } from '../heat/types'
import { mapFxClass, markerElement } from './markers'
import { MapStylePack } from './MapStylePack'
import { OsmFallback } from './OsmFallback'
import {
  NIGHT_RASTER_FALLBACK,
  attributionFor,
  styleSpecFor,
  type MapStyleId,
} from './styles'
import { aoiToGeoJSON, sanitizeAoi } from '../aoi/geo'
import { useOverwatch } from '../state/context'
import { craftKind } from '../craft/icons'

export interface ExtraMapMarker {
  id: string
  lat: number
  lng: number
  label: string
  color: string
  heading?: number
  kind?: string
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
  mapStyle = 'default',
  nvg = false,
  onMapStyle,
  onNvg,
  trails,
  heading,
  craftKind: primaryKind,
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
  mapStyle?: MapStyleId
  nvg?: boolean
  onMapStyle?: (id: MapStyleId) => void
  onNvg?: (on: boolean) => void
  trails?: TrackTrail[]
  heading?: number
  craftKind?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [styleReady, setStyleReady] = useState(0)
  const heatClickRef = useRef(onHeatClick)
  const markerClickRef = useRef(onMarkerClick)
  heatClickRef.current = onHeatClick
  markerClickRef.current = onMarkerClick
  const {
    aoi,
    setAoi,
    drawMode,
    setDrawMode,
    requestRegion,
    reportMapView,
    overlay,
    reducedMotion,
  } = useOverwatch()
  const draftRef = useRef<[number, number][]>([])

  useEffect(() => {
    const el = ref.current
    if (!el || failed) return
    let map: Map
    let nightFellBack = false
    try {
      map = new Map({
        container: el,
        style: styleSpecFor(mapStyle),
        center: [lng, lat],
        zoom: fitHeat ? 6.2 : 10.2,
        keyboard: false,
        attributionControl: { compact: true, customAttribution: attributionFor(mapStyle) },
      })
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'MapLibre failed to start')
      return
    }
    mapRef.current = map
    map.on('error', (ev) => {
      const msg = ev.error instanceof Error ? ev.error.message : 'map error'
      if (mapStyle === 'night' && !nightFellBack && /openfreemap|sprite|glyph|ajax|tile/i.test(msg)) {
        nightFellBack = true
        try {
          map.setStyle(NIGHT_RASTER_FALLBACK)
        } catch {
          setFailed(msg)
        }
        return
      }
      if (/webgl|context/i.test(msg)) setFailed(msg)
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    const primaryEl =
      craftKind(primaryKind) || heading != null
        ? markerElement(markerColor, label, { heading, kind: primaryKind })
        : undefined
    const marker = new Marker(primaryEl ? { element: primaryEl } : { color: markerColor }).setLngLat([lng, lat]).addTo(map)
    marker.setPopup(new Popup({ closeButton: false }).setText(label))
    const extras: Marker[] = []
    for (const m of extraMarkers ?? []) {
      if (m.id && m.lat === lat && m.lng === lng) continue
      const elMark = markerElement(m.color, m.label, { heading: m.heading, kind: m.kind })
      const mk = new Marker(elMark ? { element: elMark } : { color: m.color, scale: 0.72 })
        .setLngLat([m.lng, m.lat])
        .addTo(map)
      mk.setPopup(new Popup({ closeButton: false }).setText(m.label))
      mk.getElement().style.cursor = 'pointer'
      mk.getElement().addEventListener('click', (ev) => {
        ev.stopPropagation()
        markerClickRef.current?.(m.id)
      })
      extras.push(mk)
    }

    const onLoad = () => {
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
              if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: reducedMotion ? 0 : 800 })
            } catch {
              /* keep default zoom — do not invent a viewport */
            }
          }
        }
      }

      if (heatCells?.length) {
        if (!map.getSource('heat-cells')) {
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
              'fill-opacity': reducedMotion ? 0.32 : 0.28,
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
        }
        if (fitHeat) {
          const selected = heatCells.find((c) => c.id === selectedHeatId) ?? heatCells[0]
          try {
            const bounds = new LngLatBounds()
            for (const [x, y] of selected.ring) bounds.extend([x, y])
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 7.5, duration: reducedMotion ? 0 : 600 })
          } catch {
            /* keep default zoom */
          }
        }
      }
      setStyleReady((n) => n + 1)
    }
    map.on('load', onLoad)
    map.on('moveend', () => {
      const c = map.getCenter()
      reportMapView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    })
    map.on('contextmenu', (ev) => {
      ev.preventDefault()
      const b = map.getBounds()
      requestRegion(
        { lat: ev.lngLat.lat, lng: ev.lngLat.lng },
        {
          minLat: b.getSouth(),
          minLng: b.getWest(),
          maxLat: b.getNorth(),
          maxLng: b.getEast(),
        },
      )
    })

    return () => {
      try {
        marker.remove()
        extras.forEach((m) => m.remove())
        mapRef.current = null
        map.remove()
      } catch {
        /* MapLibre can throw if the WebGL context was already lost */
      }
    }
  }, [lat, lng, label, geometry, markerColor, failed, heatCells, selectedHeatId, extraMarkers, fitHeat, mapStyle, heading, primaryKind, reducedMotion, reportMapView, requestRegion])

  useEffect(() => {
    const map = mapRef.current
    if (!map || failed) return
    const apply = () => {
      if (!map.getStyle()) return
      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: (trails ?? [])
          .filter((t) => t.coords.length >= 2)
          .map((t) => ({
            type: 'Feature' as const,
            properties: { id: t.id, color: t.color, opacity: t.opacity ?? 0.7 },
            geometry: {
              type: 'LineString' as const,
              coordinates: t.coords.map(([alat, alng]) => [alng, alat]),
            },
          })),
      }
      const src = map.getSource('track-trails')
      if (src && 'setData' in src && typeof src.setData === 'function') {
        src.setData(data)
      } else if (!map.getSource('track-trails') && map.isStyleLoaded()) {
        map.addSource('track-trails', { type: 'geojson', data })
        map.addLayer({
          id: 'track-trails-line',
          type: 'line',
          source: 'track-trails',
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#8b9cff'],
            'line-width': 1.6,
            'line-opacity': ['coalesce', ['get', 'opacity'], 0.7],
          },
        })
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [trails, styleReady, failed])

  useEffect(() => {
    const map = mapRef.current
    if (!map || failed) return
    const apply = () => {
      if (!map.isStyleLoaded()) return
      const data = aoi
        ? { type: 'FeatureCollection' as const, features: [aoiToGeoJSON(aoi)] }
        : { type: 'FeatureCollection' as const, features: [] }
      const src = map.getSource('aoi')
      if (src && 'setData' in src && typeof src.setData === 'function') {
        src.setData(data)
      } else if (!map.getSource('aoi')) {
        map.addSource('aoi', { type: 'geojson', data })
        map.addLayer({
          id: 'aoi-fill',
          type: 'fill',
          source: 'aoi',
          paint: { 'fill-color': '#3ee0c8', 'fill-opacity': 0.12 },
        })
        map.addLayer({
          id: 'aoi-line',
          type: 'line',
          source: 'aoi',
          paint: { 'line-color': '#3ee0c8', 'line-width': 2, 'line-dasharray': [2, 1] },
        })
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [aoi, styleReady, failed])

  useEffect(() => {
    const map = mapRef.current
    if (!map || failed) return
    const onClick = (ev: { lngLat: { lat: number; lng: number } }) => {
      if (drawMode === 'off') return
      const pt: [number, number] = [ev.lngLat.lng, ev.lngLat.lat]
      if (drawMode === 'rect') {
        draftRef.current.push(pt)
        if (draftRef.current.length >= 2) {
          const [a, b] = draftRef.current
          const next = sanitizeAoi({
            kind: 'rect',
            minLng: Math.min(a[0], b[0]),
            minLat: Math.min(a[1], b[1]),
            maxLng: Math.max(a[0], b[0]),
            maxLat: Math.max(a[1], b[1]),
          })
          if (next) setAoi(next)
          draftRef.current = []
          setDrawMode('off')
        }
        return
      }
      draftRef.current.push(pt)
    }
    const onDbl = () => {
      if (drawMode !== 'poly') return
      const ring = draftRef.current
      const next = sanitizeAoi({ kind: 'poly', ring })
      if (next) setAoi(next)
      draftRef.current = []
      setDrawMode('off')
    }
    map.on('click', onClick)
    map.on('dblclick', onDbl)
    map.getCanvas().style.cursor = drawMode === 'off' ? '' : 'crosshair'
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDbl)
      if (map.getCanvas()) map.getCanvas().style.cursor = ''
    }
  }, [drawMode, failed, setAoi, setDrawMode, styleReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || failed || reducedMotion || !heatCells?.length) return
    let dir = 1
    let op = 0.28
    const id = window.setInterval(() => {
      if (!map.getLayer('heat-fill')) return
      op += dir * 0.03
      if (op > 0.42) dir = -1
      if (op < 0.2) dir = 1
      try {
        map.setPaintProperty('heat-fill', 'fill-opacity', op)
      } catch {
        /* style may have swapped */
      }
    }, 180)
    return () => window.clearInterval(id)
  }, [heatCells, failed, reducedMotion, styleReady])

  if (failed) {
    return <OsmFallback lat={lat} lng={lng} label={label} />
  }

  const fx =
    overlay === 'flir' ? 'flir' : overlay === 'crt' ? 'crt' : overlay === 'nvg' || nvg ? 'nvg' : undefined

  return (
    <div className={mapFxClass(nvg || overlay === 'nvg', fx)}>
      <div ref={ref} className="locality-map" role="region" aria-label={`Locality map: ${label}`} />
      {onMapStyle && onNvg && <MapStylePack style={mapStyle} nvg={nvg} onStyle={onMapStyle} onNvg={onNvg} />}
      <div className="map-attrib-note">{attributionFor(mapStyle)}</div>
      {(nvg || overlay === 'nvg') && <div className="map-fx-nvg" aria-hidden="true" />}
      {overlay === 'flir' && <div className="map-fx-flir" aria-hidden="true" />}
      {overlay === 'crt' && <div className="map-fx-crt" aria-hidden="true" />}
    </div>
  )
}
