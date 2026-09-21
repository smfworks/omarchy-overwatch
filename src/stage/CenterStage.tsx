import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { colorForKind } from '../globe/colors'
import { useOverwatch } from '../state/context'
import { StageErrorBoundary } from './StageErrorBoundary'

const OverwatchGlobe = lazy(() => import('../globe/OverwatchGlobe').then((m) => ({ default: m.OverwatchGlobe })))
const LocalityMap = lazy(() => import('../maps/LocalityMap').then((m) => ({ default: m.LocalityMap })))
const StormMap = lazy(() => import('../maps/StormMap').then((m) => ({ default: m.StormMap })))
const BriefView = lazy(() => import('./BriefView').then((m) => ({ default: m.BriefView })))
const DepthView = lazy(() => import('./DepthView').then((m) => ({ default: m.DepthView })))

function stageTitle(mode: string, label: string | null): string {
  if (mode === 'map') return label ? `Locality · ${label}` : 'Locality map'
  if (mode === 'storm') return label ? `Storm · ${label}` : 'Storm map'
  if (mode === 'depth') return label ? `Dossier · ${label}` : 'In-depth'
  if (mode === 'brief') return 'On-screen brief'
  return 'Globe'
}

function StageFallback() {
  return (
    <div className="stage-fallback">
      Loading stage module… no geodata is invented while this pane is empty.
    </div>
  )
}

export function CenterStage() {
  const {
    stage,
    goBack,
    selection,
    heatEnabled,
    heatCells,
    selectHeat,
    selectPoint,
    layers,
    mapStyle,
    setMapStyle,
    mapNvg,
    setMapNvg,
    trails,
  } = useOverwatch()
  const [globeOn, setGlobeOn] = useState(stage === 'globe')

  useEffect(() => {
    if (stage !== 'globe') {
      setGlobeOn(false)
      return
    }
    const id = window.setTimeout(() => setGlobeOn(true), 120)
    return () => window.clearTimeout(id)
  }, [stage])

  const label =
    selection?.kind === 'tool'
      ? selection.tool.name
      : selection?.kind === 'hotspot'
        ? selection.hotspot.name
        : selection?.kind === 'point'
          ? selection.point.label
          : selection?.kind === 'ticker'
            ? selection.item.title
            : selection?.kind === 'heat'
              ? `Attention L=${selection.cell.layerCount}`
              : null

  const geo =
    selection?.kind === 'hotspot'
      ? { lat: selection.hotspot.lat, lng: selection.hotspot.lng, label: selection.hotspot.name }
      : selection?.kind === 'point'
        ? {
            lat: selection.point.lat,
            lng: selection.point.lng,
            label: selection.point.label,
            geometry: selection.point.geometry,
            color: colorForKind(selection.point.kind),
            heading: selection.point.heading,
          }
        : selection?.kind === 'heat'
          ? {
              lat: selection.cell.lat,
              lng: selection.cell.lng,
              label: `H3 ${selection.cell.id}`,
              color: '#e8b84a',
            }
          : null

  const mapHeat = heatEnabled ? heatCells : undefined
  const extraMarkers = useMemo(() => {
    if (selection?.kind !== 'heat') return undefined
    return selection.cell.events.map((ev) => ({
      id: ev.id,
      lat: ev.lat,
      lng: ev.lng,
      label: `${ev.layerLabel}: ${ev.label}`,
      color: colorForKind(ev.kind),
    }))
  }, [selection])

  const mapTrails = useMemo(() => {
    if (selection?.kind === 'point') {
      return trails.filter((t) => t.id === selection.point.id || t.id.startsWith(`${selection.point.id}·`))
    }
    return trails.slice(0, 40)
  }, [selection, trails])

  const onHeatClick = (id: string) => {
    const cell = heatCells.find((c) => c.id === id)
    if (cell) selectHeat(cell)
  }

  const onMarkerClick = (id: string) => {
    for (const layer of layers) {
      const pt = layer.points.find((p) => p.id === id)
      if (pt) {
        selectPoint(pt)
        return
      }
    }
  }

  return (
    <div className="stage">
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
      <StageErrorBoundary onReset={goBack}>
        <Suspense fallback={<StageFallback />}>
          {stage === 'globe' && globeOn ? (
            <div className="stage-globe">
              <OverwatchGlobe />
            </div>
          ) : null}
          {stage === 'map' && geo && (
            <LocalityMap
              lat={geo.lat}
              lng={geo.lng}
              label={geo.label}
              geometry={'geometry' in geo ? geo.geometry : undefined}
              markerColor={'color' in geo ? geo.color : '#3ee0c8'}
              heatCells={mapHeat}
              selectedHeatId={selection?.kind === 'heat' ? selection.cell.id : null}
              onHeatClick={heatEnabled ? onHeatClick : undefined}
              extraMarkers={extraMarkers}
              onMarkerClick={onMarkerClick}
              fitHeat={selection?.kind === 'heat'}
              mapStyle={mapStyle}
              nvg={mapNvg}
              onMapStyle={setMapStyle}
              onNvg={setMapNvg}
              trails={mapTrails}
              heading={'heading' in geo ? geo.heading : undefined}
            />
          )}
          {stage === 'storm' && selection?.kind === 'point' && (
            <StormMap
              point={selection.point}
              mapStyle={mapStyle}
              nvg={mapNvg}
              onMapStyle={setMapStyle}
              onNvg={setMapNvg}
            />
          )}
          {stage === 'depth' && <DepthView />}
          {stage === 'brief' && <BriefView />}
        </Suspense>
      </StageErrorBoundary>
      {stage !== 'globe' && (
        <div className="stage-chrome">
          <button type="button" className="btn stage-back" onClick={goBack} title="Back to globe (Esc or b)">
            ← Globe
          </button>
          <div className="stage-title">{stageTitle(stage, label)}</div>
        </div>
      )}
      <div className="scanlines" />
    </div>
  )
}
