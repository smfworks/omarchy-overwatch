import { useEffect, useRef, useState } from 'react'
import { Map, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoPoint } from '../globe/types'
import { BASEMAP_ATTRIBUTION, OPENFREEMAP_DARK, fetchRainViewerMaps, rainviewerTileUrl } from './basemap'
import { weatherKindLabel } from './weather'

type RadarState = 'loading' | 'live' | 'err' | 'empty'

export function StormMap({ point }: { point: GeoPoint }) {
  const ref = useRef<HTMLDivElement>(null)
  const [radar, setRadar] = useState<{ status: RadarState; error: string | null; time: string | null }>({
    status: 'loading',
    error: null,
    time: null,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const map = new Map({
      container: el,
      style: OPENFREEMAP_DARK,
      center: [point.lng, point.lat],
      zoom: 6.4,
      keyboard: false,
      attributionControl: {
        compact: true,
        customAttribution: `${BASEMAP_ATTRIBUTION} · radar RainViewer`,
      },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    new Marker({ color: '#ff5d6c' }).setLngLat([point.lng, point.lat]).addTo(map)

    let cancelled = false
    map.on('load', () => {
      const geom = point.geometry
      if (geom?.type && geom.coordinates != null && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
        map.addSource('alert-geom', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: geom.type, coordinates: geom.coordinates } as GeoJSON.Geometry,
          },
        })
        map.addLayer({
          id: 'alert-fill',
          type: 'fill',
          source: 'alert-geom',
          paint: { 'fill-color': '#ff5d6c', 'fill-opacity': 0.22 },
        })
        map.addLayer({
          id: 'alert-line',
          type: 'line',
          source: 'alert-geom',
          paint: { 'line-color': '#ff5d6c', 'line-width': 2 },
        })
      }

      void fetchRainViewerMaps()
        .then((maps) => {
          if (cancelled) return
          const frame = maps.frames[maps.frames.length - 1]
          if (!frame) {
            setRadar({ status: 'empty', error: 'No radar frames', time: null })
            return
          }
          if (map.getSource('radar')) return
          map.addSource('radar', {
            type: 'raster',
            tiles: [rainviewerTileUrl(maps.host, frame.path)],
            tileSize: 256,
            attribution: 'RainViewer',
          })
          map.addLayer(
            {
              id: 'radar',
              type: 'raster',
              source: 'radar',
              paint: { 'raster-opacity': 0.62, 'raster-fade-duration': 0 },
            },
            map.getLayer('alert-fill') ? 'alert-fill' : undefined,
          )
          setRadar({
            status: 'live',
            error: null,
            time: new Date(frame.time * 1000).toISOString(),
          })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setRadar({
            status: 'err',
            error: err instanceof Error ? err.message : 'radar unavailable',
            time: null,
          })
        })
    })

    return () => {
      cancelled = true
      try {
        map.remove()
      } catch {
        /* MapLibre can throw if the WebGL context was already lost */
      }
    }
  }, [point])

  return (
    <div className="storm-map-wrap">
      <div ref={ref} className="locality-map" role="region" aria-label={`Storm map: ${weatherKindLabel(point)}`} />
      <aside className="storm-dossier" aria-live="polite">
        <div className="storm-kicker">
          Dangerous weather
          <span className={`status-dot ${radar.status === 'live' ? 'live' : radar.status === 'err' ? 'err' : radar.status}`} />
          <span className="storm-radar-status">
            radar {radar.status.toUpperCase()}
            {radar.time ? ` · ${radar.time}` : ''}
          </span>
        </div>
        <h2>{point.label}</h2>
        <div className="coords">
          {point.lat.toFixed(3)}°, {point.lng.toFixed(3)}°
          {point.eventType ? ` · ${point.eventType}` : ''}
        </div>
        {point.headline && <p>{point.headline}</p>}
        {point.areaDesc && <p>{point.areaDesc}</p>}
        {point.detail && <p>{point.detail}</p>}
        {point.severity && (
          <dl className="kv">
            <dt>Severity</dt>
            <dd>{point.severity}</dd>
            {point.urgency && (
              <>
                <dt>Urgency</dt>
                <dd>{point.urgency}</dd>
              </>
            )}
          </dl>
        )}
        {radar.status === 'err' && (
          <p className="disclaimer">Radar {radar.error ?? 'ERR'} — map and alert text are still from the selected feed. No weather was invented.</p>
        )}
        {radar.status === 'empty' && (
          <p className="disclaimer">RainViewer returned no frames. Alert geometry (if the feed sent it) still shows.</p>
        )}
        <p className="disclaimer">
          NWS / EONET text only when the feed provided it. RainViewer is a public mosaic, not a forecast. Basemap:{' '}
          {BASEMAP_ATTRIBUTION}.
        </p>
      </aside>
    </div>
  )
}
