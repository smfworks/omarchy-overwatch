import { formatEntityDelta } from './stats'
import { useOverwatch } from '../state/context'

export function PollDeltaStrip() {
  const { pollDeltas, layers } = useOverwatch()
  const enabled = new Set(layers.filter((layer) => layer.enabled).map((layer) => layer.id))
  const rows = Object.values(pollDeltas)
    .filter((row) => enabled.has(row.layerId))
    .sort((a, b) => b.at - a.at)

  return (
    <div
      className="poll-delta"
      data-testid="poll-delta"
      title="ID diff of each layer’s last successful payload. Not an AOI or time-window clip, and not an inferred event."
    >
      <div className="poll-delta-title">POLL Δ</div>
      {rows.length === 0 ? (
        <p className="poll-delta-empty">
          No successful poll yet. A delta appears only after a public fetch. Nothing is invented while waiting.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.layerId} data-testid={`poll-delta-${row.layerId}`}>
              {formatEntityDelta(row.label, row.delta)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
