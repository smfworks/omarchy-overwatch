import { TIME_PRESETS, type TimePreset } from '../time/window'
import { useOverwatch } from '../state/context'

export function TimeScrubber() {
  const { timePreset, setTimePreset, playhead, setPlayhead, playbackPlaying, togglePlayback, playbackTimes } =
    useOverwatch()

  return (
    <div className="time-scrubber" role="group" aria-label="Time window">
      {TIME_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className={`map-style-btn${timePreset === preset ? ' on' : ''}`}
          onClick={() => {
            setTimePreset(preset)
            setPlayhead(null)
          }}
        >
          {preset === 'all' ? 'ALL' : preset.toUpperCase()}
        </button>
      ))}
      <button
        type="button"
        className={`map-style-btn${playbackPlaying ? ' on' : ''}`}
        disabled={playbackTimes.length < 2}
        title={
          playbackTimes.length < 2
            ? 'Playback needs at least two dated public points already polled. History is never invented.'
            : 'Play dated points already in the client ring buffer'
        }
        onClick={togglePlayback}
      >
        {playbackPlaying ? 'PAUSE' : 'PLAY'}
      </button>
      {playhead != null && (
        <span className="time-playhead">{new Date(playhead).toISOString().slice(11, 16)}Z</span>
      )}
    </div>
  )
}

export function TimePresetHint(preset: TimePreset): string {
  if (preset === 'all') return 'Showing all currently loaded points (plus dated history already polled).'
  return `Showing dated public points in the last ${preset}. Untimed live snapshots stay visible. No fabricated history.`
}
