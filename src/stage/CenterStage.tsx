import { OverwatchGlobe } from '../globe/OverwatchGlobe'
import { LocalityMap } from '../maps/LocalityMap'
import { StormMap } from '../maps/StormMap'
import { useOverwatch } from '../state/context'
import { DepthView } from './DepthView'

function stageTitle(mode: string, label: string | null): string {
  if (mode === 'map') return label ? `Locality · ${label}` : 'Locality map'
  if (mode === 'storm') return label ? `Storm · ${label}` : 'Storm map'
  if (mode === 'depth') return label ? `Dossier · ${label}` : 'In-depth'
  return 'Globe'
}

export function CenterStage() {
  const { stage, goBack, selection } = useOverwatch()

  const label =
    selection?.kind === 'tool'
      ? selection.tool.name
      : selection?.kind === 'hotspot'
        ? selection.hotspot.name
        : selection?.kind === 'point'
          ? selection.point.label
          : selection?.kind === 'ticker'
            ? selection.item.title
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
            color: selection.point.kind === 'alert' ? '#ff5d6c' : '#3ee0c8',
          }
        : null

  return (
    <div className="stage">
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
      <div className={`stage-globe${stage === 'globe' ? '' : ' is-hidden'}`} data-hidden={stage !== 'globe'}>
        <OverwatchGlobe />
      </div>
      {stage === 'map' && geo && (
        <LocalityMap
          lat={geo.lat}
          lng={geo.lng}
          label={geo.label}
          geometry={'geometry' in geo ? geo.geometry : undefined}
          markerColor={'color' in geo ? geo.color : '#3ee0c8'}
        />
      )}
      {stage === 'storm' && selection?.kind === 'point' && <StormMap point={selection.point} />}
      {stage === 'depth' && <DepthView />}
      {stage !== 'globe' && (
        <div className="stage-chrome">
          <button className="btn stage-back" onClick={goBack} title="Back to globe (Esc)">
            ← Globe
          </button>
          <div className="stage-title">{stageTitle(stage, label)}</div>
        </div>
      )}
      <div className="scanlines" />
    </div>
  )
}
