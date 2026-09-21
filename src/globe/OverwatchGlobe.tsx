import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import { HOTSPOTS, nearestHotspot } from '../data/hotspots'
import { cellsToGlobePolygons, type HeatPolygon } from '../heat/geojson'
import { useOverwatch } from '../state/context'
import { colorForKind } from './colors'
import type { GeoPoint } from './layers'
import type { TrackTrail } from './tracks'

const NIGHT = '/globe/earth-night.jpg'
const BUMP = '/globe/earth-topology.png'
const STARS = '/globe/night-sky.png'

interface Marker {
  id: string
  lat: number
  lng: number
  name: string
  color: string
  size: number
  kind: GeoPoint['kind']
  selected: boolean
  heading?: number
}

type HtmlItem =
  | { html: 'beacon'; id: string; lat: number; lng: number; name: string; kind: string }
  | { html: 'track'; id: string; lat: number; lng: number; name: string; heading: number; color: string }

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function OverwatchGlobe() {
  const {
    layers,
    selectHotspot,
    selectPoint,
    selectHeat,
    flyTo,
    selection,
    reportGlobePov,
    stage,
    heatEnabled,
    heatCells,
    trails,
  } = useOverwatch()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const [webgl] = useState(webglAvailable)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const sync = () => setDims({ width: el.clientWidth, height: el.clientHeight })
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const flyToRef = useRef(flyTo)
  flyToRef.current = flyTo

  useEffect(() => {
    if (flyTo) globeRef.current?.pointOfView(flyTo, 900)
  }, [flyTo])

  useEffect(() => {
    const controls = globeRef.current?.controls()
    if (controls) controls.autoRotate = stage === 'globe' && !selection
  }, [stage, selection])

  useEffect(() => {
    const id = window.setInterval(() => {
      const pov = globeRef.current?.pointOfView()
      if (pov && Number.isFinite(pov.lat) && Number.isFinite(pov.lng) && Number.isFinite(pov.altitude)) {
        reportGlobePov({ lat: pov.lat, lng: pov.lng, altitude: pov.altitude })
      }
    }, 800)
    return () => window.clearInterval(id)
  }, [reportGlobePov])

  const selectedId = selection?.kind === 'point' ? selection.point.id : null
  const selectedHotspotId = selection?.kind === 'hotspot' ? selection.hotspot.id : null
  const selectedHeatId = selection?.kind === 'heat' ? selection.cell.id : null

  const liveMarkers = useMemo<Marker[]>(() => {
    return layers.flatMap((layer) =>
      layer.enabled && (layer.status === 'live' || layer.status === 'stale')
        ? layer.points.map((p) => {
            const selected = p.id === selectedId
            const heading = typeof p.heading === 'number' && Number.isFinite(p.heading) ? p.heading : undefined
            return {
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              name: p.label,
              color: colorForKind(p.kind),
              size:
                (p.kind === 'quake'
                  ? Math.min(1.2, 0.28 + (p.mag ?? 2) * 0.12)
                  : p.kind === 'fire'
                    ? 0.22
                    : p.kind === 'alert'
                      ? 0.38
                      : p.kind === 'sat'
                        ? 0.2
                        : 0.28) * (selected ? 1.7 : 1),
              kind: p.kind,
              selected,
              heading,
            }
          })
        : [],
    )
  }, [layers, selectedId])

  const headingMarkers = useMemo(
    () => liveMarkers.filter((m) => m.heading != null && (m.kind === 'aircraft' || m.kind === 'vessel' || m.kind === 'sat')),
    [liveMarkers],
  )
  const blobMarkers = useMemo(() => {
    const headed = new Set(headingMarkers.map((m) => m.id))
    return liveMarkers.filter((m) => !headed.has(m.id))
  }, [liveMarkers, headingMarkers])

  const htmlItems = useMemo<HtmlItem[]>(() => {
    const beacons: HtmlItem[] = HOTSPOTS.map((hs) => ({
      html: 'beacon',
      id: hs.id,
      lat: hs.lat,
      lng: hs.lng,
      name: hs.name,
      kind: hs.kind,
    }))
    const tracks: HtmlItem[] = headingMarkers.map((m) => ({
      html: 'track',
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      name: m.name,
      heading: m.heading ?? 0,
      color: m.color,
    }))
    return [...beacons, ...tracks]
  }, [headingMarkers])

  const makeHtml = useCallback(
    (obj: object) => {
      const item = obj as HtmlItem
      if (item.html === 'track') {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'heading-marker globe-heading'
        el.style.setProperty('--hm-color', item.color)
        el.style.transform = `rotate(${item.heading}deg)`
        el.title = item.name
        el.setAttribute('aria-label', item.name)
        el.style.pointerEvents = 'auto'
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          for (const layer of layers) {
            const pt = layer.points.find((p) => p.id === item.id)
            if (pt) {
              selectPoint(pt)
              return
            }
          }
        })
        return el
      }
      const hs = HOTSPOTS.find((h) => h.id === item.id)
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `beacon ${item.kind}${item.id === selectedHotspotId ? ' selected' : ''}`
      el.title = item.name
      el.setAttribute('aria-label', item.name)
      el.style.pointerEvents = 'auto'
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (hs) selectHotspot(hs)
      })
      return el
    },
    [layers, selectHotspot, selectPoint, selectedHotspotId],
  )

  const rings = useMemo(() => {
    const fromLive = liveMarkers
      .filter((m) => m.kind === 'quake' || m.kind === 'fire' || m.kind === 'alert' || m.kind === 'event' || m.kind === 'hazard')
      .map((m) => ({
        lat: m.lat,
        lng: m.lng,
        maxR: m.selected ? 5.2 : m.kind === 'fire' ? 2.2 : m.kind === 'alert' ? 4.2 : 3.5,
        color: m.color,
      }))
    if (selection?.kind === 'hotspot') {
      fromLive.push({
        lat: selection.hotspot.lat,
        lng: selection.hotspot.lng,
        maxR: 5,
        color: '#3ee0c8',
      })
    }
    return fromLive
  }, [liveMarkers, selection])

  const liveCount = liveMarkers.length
  const heatPolys = useMemo(
    () => (heatEnabled ? cellsToGlobePolygons(heatCells, selectedHeatId) : []),
    [heatEnabled, heatCells, selectedHeatId],
  )

  if (!webgl) {
    return (
      <div className="globe-inner globe-fallback" ref={wrapRef}>
        <p>Globe WebGL is unavailable in this session. Catalog, ticker, and dossier still work. No geodata was invented.</p>
        <p className="disclaimer">
          {liveCount
            ? `${liveCount} live layer points are loaded — open them from the right dossier for locality / storm maps.`
            : 'Enable a live layer in the status strip to list points in the dossier.'}
        </p>
      </div>
    )
  }

  return (
    <div className="globe-inner" ref={wrapRef}>
      <Globe
        ref={globeRef}
        width={dims.width}
        height={dims.height}
        globeImageUrl={NIGHT}
        bumpImageUrl={BUMP}
        backgroundImageUrl={STARS}
        atmosphereColor="#3ee0c8"
        atmosphereAltitude={0.18}
        backgroundColor="#02040a"
        pointsData={blobMarkers}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: object) => ((d as Marker).selected ? 0.035 : 0.01)}
        pointRadius="size"
        pointColor="color"
        pointLabel={(d: object) => (d as Marker).name}
        htmlElementsData={htmlItems}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(d: object) => ((d as HtmlItem).html === 'track' ? 0.012 : 0.02)}
        htmlElement={makeHtml}
        onGlobeReady={() => {
          const controls = globeRef.current?.controls()
          if (controls) {
            controls.autoRotate = true
            controls.autoRotateSpeed = 0.28
            controls.enableDamping = true
          }
          const resume = flyToRef.current
          globeRef.current?.pointOfView(resume ?? { lat: 18, lng: 25, altitude: 2.4 }, 0)
        }}
        onGlobeClick={({ lat, lng }: { lat: number; lng: number }) => {
          const hs = nearestHotspot(lat, lng)
          if (hs) selectHotspot(hs)
        }}
        onPointClick={(d: object) => {
          const m = d as Marker
          for (const layer of layers) {
            const pt = layer.points.find((p) => p.id === m.id)
            if (pt) {
              selectPoint(pt)
              return
            }
          }
        }}
        polygonsData={heatPolys}
        polygonLabel="name"
        polygonGeoJsonGeometry="geometry"
        polygonCapColor={(d: object) => (d as HeatPolygon).color}
        polygonSideColor={() => 'rgba(8, 14, 24, 0.12)'}
        polygonStrokeColor={(d: object) => (d as HeatPolygon).stroke}
        polygonAltitude={(d: object) => (d as HeatPolygon).altitude}
        polygonCapCurvatureResolution={6}
        polygonsTransitionDuration={0}
        onPolygonClick={(d: object) => {
          const poly = d as HeatPolygon
          const cell = heatCells.find((c) => c.id === poly.id)
          if (cell) selectHeat(cell)
        }}
        pathsData={trails}
        pathPoints={(d: object) => (d as TrackTrail).coords.map(([lat, lng]) => [lat, lng, 0.01])}
        pathColor={(d: object) => (d as TrackTrail).color}
        pathStroke={0.55}
        pathDashLength={0.01}
        pathDashGap={0.006}
        pathDashAnimateTime={0}
        onPathClick={(d: object) => {
          const trail = d as TrackTrail
          const id = trail.id.split('·')[0]
          for (const layer of layers) {
            const pt = layer.points.find((p) => p.id === id)
            if (pt) {
              selectPoint(pt)
              return
            }
          }
        }}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={(d: object) => (d as { color: string }).color}
        ringMaxRadius="maxR"
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={1400}
        animateIn={false}
      />
      <div className="globe-hint">
        {selection?.kind === 'hotspot'
          ? `lock: ${selection.hotspot.name}`
          : selection?.kind === 'point'
            ? `lock: ${selection.point.label}`
            : selection?.kind === 'heat'
              ? `heat: L=${selection.cell.layerCount} · ${selection.cell.id}`
              : heatEnabled && heatPolys.length
                ? `${heatPolys.length} attention cells · click a hex`
                : liveCount
                  ? `${liveCount} live highlights${trails.length ? ` · ${trails.length} sampled trails` : ''} · drag to orbit · click a point`
                  : 'drag to orbit · scroll to zoom · click a beacon'}
      </div>
    </div>
  )
}
