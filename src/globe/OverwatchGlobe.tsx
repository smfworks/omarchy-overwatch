import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import { HOTSPOTS, nearestHotspot } from '../data/hotspots'
import { useOverwatch } from '../state/context'
import type { GeoPoint } from './layers'

const NIGHT = '//unpkg.com/three-globe/example/img/earth-night.jpg'
const BUMP = '//unpkg.com/three-globe/example/img/earth-topology.png'
const STARS = '//unpkg.com/three-globe/example/img/night-sky.png'

interface Marker {
  id: string
  lat: number
  lng: number
  name: string
  color: string
  size: number
  kind: GeoPoint['kind']
  selected: boolean
}

function colorFor(kind: GeoPoint['kind']): string {
  if (kind === 'quake') return '#ff8a3d'
  if (kind === 'aircraft') return '#8b9cff'
  if (kind === 'alert') return '#ff5d6c'
  if (kind === 'vessel') return '#4cc9f0'
  if (kind === 'fire') return '#ff7a3d'
  return '#3ee0c8'
}

export function OverwatchGlobe() {
  const { layers, selectHotspot, selectPoint, flyTo, selection, reportGlobePov, stage } = useOverwatch()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })

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

  const liveMarkers = useMemo<Marker[]>(() => {
    return layers.flatMap((layer) =>
      layer.enabled && (layer.status === 'live' || layer.status === 'stale')
        ? layer.points.map((p) => {
            const selected = p.id === selectedId
            return {
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              name: p.label,
              color: colorFor(p.kind),
              size:
                (p.kind === 'quake'
                  ? Math.min(1.2, 0.28 + (p.mag ?? 2) * 0.12)
                  : p.kind === 'fire'
                    ? 0.22
                    : p.kind === 'alert'
                      ? 0.38
                      : 0.28) * (selected ? 1.7 : 1),
              kind: p.kind,
              selected,
            }
          })
        : [],
    )
  }, [layers, selectedId])

  const makeBeacon = useCallback(
    (obj: object) => {
      const hs = obj as (typeof HOTSPOTS)[number]
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `beacon ${hs.kind}${hs.id === selectedHotspotId ? ' selected' : ''}`
      el.title = hs.name
      el.setAttribute('aria-label', hs.name)
      el.style.pointerEvents = 'auto'
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        selectHotspot(hs)
      })
      return el
    },
    [selectHotspot, selectedHotspotId],
  )

  const rings = useMemo(() => {
    const fromLive = liveMarkers
      .filter((m) => m.kind === 'quake' || m.kind === 'fire' || m.kind === 'alert' || m.kind === 'event')
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
        pointsData={liveMarkers}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: object) => ((d as Marker).selected ? 0.035 : 0.01)}
        pointRadius="size"
        pointColor="color"
        pointLabel={(d: object) => (d as Marker).name}
        htmlElementsData={HOTSPOTS}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.02}
        htmlElement={makeBeacon}
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
            : liveCount
              ? `${liveCount} live highlights · drag to orbit · click a point`
              : 'drag to orbit · scroll to zoom · click a beacon'}
      </div>
    </div>
  )
}
