import { THEATER_PRESETS } from './theaters'
import { useOverwatch } from '../state/context'

export function TheaterChips() {
  const { activeTheater, flyTheater } = useOverwatch()
  return (
    <div className="theater-chips" data-testid="theater-chips" role="group" aria-label="Camera theaters">
      {THEATER_PRESETS.map((theater) => (
        <button
          key={theater.id}
          type="button"
          className={`layer-btn${activeTheater === theater.id ? ' on' : ''}`}
          data-testid={`theater-${theater.id}`}
          aria-pressed={activeTheater === theater.id}
          title="Camera preset only. Does not filter feeds and is not a situation report. Back restores the previous globe view."
          onClick={() => flyTheater(theater.id)}
        >
          {theater.label}
        </button>
      ))}
    </div>
  )
}
