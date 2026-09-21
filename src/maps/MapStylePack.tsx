import { MAP_STYLE_META, MAP_STYLE_IDS, type MapStyleId } from './styles'
import { useOverwatch } from '../state/context'

export function MapStylePack({
  style,
  nvg,
  onStyle,
  onNvg,
}: {
  style: MapStyleId
  nvg: boolean
  onStyle: (id: MapStyleId) => void
  onNvg: (on: boolean) => void
}) {
  const { aoi, setAoi, drawMode, setDrawMode, overlay, setOverlay } = useOverwatch()
  return (
    <div className="map-style-pack" role="group" aria-label="Basemap style">
      {MAP_STYLE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={`map-style-btn${style === id ? ' on' : ''}`}
          title={MAP_STYLE_META[id].note}
          onClick={() => onStyle(id)}
        >
          {MAP_STYLE_META[id].label}
        </button>
      ))}
      <button
        type="button"
        className={`map-style-btn${nvg || overlay === 'nvg' ? ' on' : ''}`}
        title="Aesthetic NVG tint only — not a night-vision sensor, not classified imagery."
        onClick={() => onNvg(!(nvg || overlay === 'nvg'))}
      >
        NVG
      </button>
      <button
        type="button"
        className={`map-style-btn${overlay === 'flir' ? ' on' : ''}`}
        title="Aesthetic FLIR tint only — not a thermal sensor."
        onClick={() => setOverlay(overlay === 'flir' ? 'off' : 'flir')}
      >
        FLIR
      </button>
      <button
        type="button"
        className={`map-style-btn${overlay === 'crt' ? ' on' : ''}`}
        title="Aesthetic CRT overlay only."
        onClick={() => setOverlay(overlay === 'crt' ? 'off' : 'crt')}
      >
        CRT
      </button>
      <button
        type="button"
        className={`map-style-btn${drawMode === 'rect' ? ' on' : ''}`}
        title="Draw a rectangle AOI. Two clicks. Filters visible live points and HEAT."
        onClick={() => setDrawMode(drawMode === 'rect' ? 'off' : 'rect')}
      >
        RECT
      </button>
      <button
        type="button"
        className={`map-style-btn${drawMode === 'poly' ? ' on' : ''}`}
        title="Draw a polygon AOI. Click vertices, double-click to close."
        onClick={() => setDrawMode(drawMode === 'poly' ? 'off' : 'poly')}
      >
        POLY
      </button>
      {aoi && (
        <button type="button" className="map-style-btn on" title="Clear area of interest" onClick={() => setAoi(null)}>
          CLEAR AOI
        </button>
      )}
    </div>
  )
}
