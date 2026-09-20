import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import { HOTSPOTS } from '../data/hotspots'
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
  kind: 'hotspot' | GeoPoint['kind']
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

  const markers = useMemo<Marker[]>(() => {
    const hs: Marker[] = HOTSPOTS.map((h) => ({
      id: `hs-${h.id}`,
      lat: h.lat,
      lng: h.lng,
      name: h.name,
      color: h.kind === 'chokepoint' ? '#e8b84a' : h.kind === 'hazard-watch' ? '#ff5d6c' : '#3ee0c8',
      size: 0.55,
      kind: 'hotspot',
    }))
    const live: Marker[] = layers.flatMap((layer) =>
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
                    : '#3ee0c8',
            size: p.kind === 'quake' ? Math.min(1.2, 0.28 + (p.mag ?? 2) * 0.12) : 0.28,
            kind: p.kind,
          }))
        : [],
    )
    return [...hs, ...live]
  }, [layers])

  const rings = useMemo(
    () =>
      markers
        .filter((m) => m.kind === 'quake' || m.kind === 'hotspot')
        .map((m) => ({
          lat: m.lat,
          lng: m.lng,
          maxR: m.kind === 'quake' ? 3.5 : 2.2,
          color: m.color,
        })),
    [markers],
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
        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.01}
        pointRadius="size"
        pointColor="color"
        pointLabel={(d: object) => (d as Marker).name}
        onGlobeReady={() => {
          const controls = globeRef.current?.controls()
          if (controls) {
            controls.autoRotate = true
            controls.autoRotateSpeed = 0.28
            controls.enableDamping = true
          }
          globeRef.current?.pointOfView({ lat: 18, lng: 25, altitude: 2.4 }, 0)
        }}
        onPointClick={(d: object) => {
          const m = d as Marker
          if (m.kind === 'hotspot') {
            const hs = HOTSPOTS.find((h) => `hs-${h.id}` === m.id)
            if (hs) selectHotspot(hs)
            return
          }
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
