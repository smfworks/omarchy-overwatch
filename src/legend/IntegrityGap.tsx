import { integrityGaps } from './stats'
import { useOverwatch } from '../state/context'

export function IntegrityGap() {
  const { layers } = useOverwatch()
  const gaps = integrityGaps(layers)
  if (!gaps.length) return null
  const hasErr = gaps.some((gap) => gap.status === 'err')
  return (
    <div
      className={`integrity-gap${hasErr ? ' has-err' : ''}`}
      data-testid="integrity-gap"
      role="status"
    >
      <div className="integrity-gap-title">
        GAP · {gaps.length} source{gaps.length === 1 ? '' : 's'}
      </div>
      <ul>
        {gaps.map((gap) => (
          <li key={gap.id} title={gap.detail ?? undefined}>
            <span className={`status-dot ${gap.status}`} />
            {gap.label} {gap.status.toUpperCase()}
            {gap.detail ? <span className="integrity-detail">{gap.detail}</span> : null}
          </li>
        ))}
      </ul>
      <p className="integrity-note">
        Enabled layers in ERR or STALE. A quiet map is a missing feed, not an all-clear. STALE keeps the last good
        points. Off layers are omitted.
      </p>
    </div>
  )
}
