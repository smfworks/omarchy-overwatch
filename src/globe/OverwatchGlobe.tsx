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
}

export function OverwatchGlobe() {
  const { layers, selectHotspot, selectPoint, flyTo, selection } = useOverwatch()
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

  useEffect(() => {
    if (flyTo) globeRef.current?.pointOfView(flyTo, 900)
  }, [flyTo])

  const liveMarkers = useMemo<Marker[]>(() => {
    return layers.flatMap((layer) =>
      layer.enabled && (layer.status === 'live' || layer.status === 'stale')
        ? layer.points.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            name: p.label,
            color:
              p.kind === 'quake'
                ? '#ff8a3d'
                : p.kind === 'aircraft'
                  ? '#8b9cff'
                  : p.kind === 'alert'
                    ? '#ff5d6c'
                    : p.kind === 'vessel'
                      ? '#4cc9f0'
                      : p.kind === 'fire'
                        ? '#ff7a3d'
                        : '#3ee0c8',
            size:
              p.kind === 'quake'
                ? Math.min(1.2, 0.28 + (p.mag ?? 2) * 0.12)
                : p.kind === 'fire'
                  ? 0.22
                  : 0.28,
            kind: p.kind,
          }))
        : [],
    )
  }, [layers])

  const makeBeacon = useCallback(
    (obj: object) => {
      const hs = obj as (typeof HOTSPOTS)[number]
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `beacon ${hs.kind}`
      el.title = hs.name
      el.setAttribute('aria-label', hs.name)
      el.style.pointerEvents = 'auto'
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        selectHotspot(hs)
      })
      return el
    },
    [selectHotspot],
  )

  const rings = useMemo(
    () =>
      liveMarkers
        .filter((m) => m.kind === 'quake' || m.kind === 'fire')
        .map((m) => ({
          lat: m.lat,
          lng: m.lng,
          maxR: m.kind === 'fire' ? 2.2 : 3.5,
          color: m.color,
        })),
    [liveMarkers],
  )

  return (
    <div className="stage" ref={wrapRef}>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
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
        pointAltitude={0.01}
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
          globeRef.current?.pointOfView({ lat: 18, lng: 25, altitude: 2.4 }, 0)
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
      <div className="scanlines" />
      <div className="globe-hint">
        {selection?.kind === 'hotspot'
          ? `lock: ${selection.hotspot.name}`
          : 'drag to orbit · scroll to zoom · click a beacon'}
      </div>
    </div>
  )
}
