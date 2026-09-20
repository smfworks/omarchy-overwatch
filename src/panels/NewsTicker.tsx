import { useOverwatch } from '../state/context'

export function NewsTicker() {
  const { ticker, tickerStatus, tickerError } = useOverwatch()

  if (tickerStatus === 'loading') {
    return (
      <div className="ticker">
        <div className="ticker-label">Feeds</div>
        <div style={{ padding: '0 12px', color: 'var(--muted)' }}>Fetching public RSS…</div>
      </div>
    )
  }

  if (tickerStatus === 'err' || tickerStatus === 'empty') {
    return (
      <div className="ticker">
        <div className="ticker-label">Feeds</div>
        <div style={{ padding: '0 12px', color: 'var(--muted)' }}>
          {tickerStatus === 'empty' ? 'No headlines in public feeds right now.' : tickerError ?? 'ERR — RSS unavailable'}
        </div>
      </div>
    )
  }

  const loop = [...ticker, ...ticker]
  return (
    <div className="ticker">
      <div className="ticker-label">Feeds</div>
      <div className="ticker-track">
        {loop.map((item, i) => (
          <a key={`${item.id}-${i}`} href={item.url || undefined} target="_blank" rel="noreferrer">
            <span className="ticker-src">{item.source}</span>
            {item.title}
          </a>
        ))}
      </div>
    </div>
  )
}
