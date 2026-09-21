import { MAP_STYLE_META, MAP_STYLE_IDS, type MapStyleId } from './styles'

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
        className={`map-style-btn${nvg ? ' on' : ''}`}
        title="Aesthetic NVG tint only — not a night-vision sensor, not classified imagery."
        onClick={() => onNvg(!nvg)}
      >
        NVG
      </button>
    </div>
  )
}
