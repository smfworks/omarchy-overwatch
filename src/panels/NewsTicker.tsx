import { useState, type FormEvent } from 'react'
import {
  addCustomFeed,
  removeCustom,
  toggleBuiltin,
  toggleCustom,
  type BuiltinFeedId,
} from '../feeds/storage'
import { FEED_SOURCES } from '../feeds/rss'
import { useOverwatch } from '../state/context'

export function NewsTicker() {
  const { ticker, tickerStatus, tickerError, tickerFeeds, feedPrefs, setFeedPrefs, selectTicker, selection } =
    useOverwatch()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const addFeed = (e: FormEvent) => {
    e.preventDefault()
    const next = addCustomFeed(feedPrefs, url, label)
    if ('error' in next) {
      setFormError(next.error)
      return
    }
    setFeedPrefs(next)
    setUrl('')
    setLabel('')
    setFormError(null)
  }

  const loop = ticker.length ? [...ticker, ...ticker] : []

  return (
    <div className="ticker">
      <div className="ticker-label">Feeds</div>
      <div className="ticker-pips" aria-label="Feed status">
        {tickerFeeds.map((feed) => (
          <span key={feed.id} className="ticker-pip" title={`${feed.label}: ${feed.status.toUpperCase()}${feed.error ? ` · ${feed.error}` : ''}`}>
            <span className={`status-dot ${feed.enabled ? feed.status : 'off'}`} />
            {feed.label}
          </span>
        ))}
      </div>
      <button
        className={`icon-btn ticker-gear${open ? ' on' : ''}`}
        aria-expanded={open}
        aria-label="Feed settings"
        title="Custom RSS / enable feeds"
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>
      <div className="ticker-main">
        {tickerStatus === 'loading' && <div className="ticker-msg">Fetching public RSS…</div>}
        {(tickerStatus === 'err' || tickerStatus === 'empty' || tickerStatus === 'off') && !ticker.length && (
          <div className="ticker-msg">
            {tickerStatus === 'off'
              ? 'All feeds off — enable one in settings.'
              : tickerStatus === 'empty'
                ? 'No headlines in enabled public feeds right now.'
                : tickerError ?? 'ERR — RSS unavailable'}
          </div>
        )}
        {loop.length > 0 && (
          <div className="ticker-track">
            {loop.map((item, i) => (
              <button
                key={`${item.id}-${i}`}
                type="button"
                className={`ticker-item${selection?.kind === 'ticker' && selection.item.id === item.id ? ' selected' : ''}`}
                onClick={() => selectTicker(item)}
              >
                <span className="ticker-src">{item.source}</span>
                {item.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {tickerStatus === 'stale' && tickerError && <div className="ticker-stale">STALE · {tickerError}</div>}
      {open && (
        <div className="ticker-pop" role="dialog" aria-label="Feed settings">
          <div className="count-line">Built-in</div>
          {FEED_SOURCES.map((src) => {
            const runtime = tickerFeeds.find((f) => f.id === src.id)
            const on = feedPrefs.builtinEnabled[src.id]
            return (
              <label key={src.id} className="feed-row">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setFeedPrefs(toggleBuiltin(feedPrefs, src.id as BuiltinFeedId))}
                />
                <span>{src.label}</span>
                <span className={`badge ${on ? '' : ''}`}>
                  <span className={`status-dot ${runtime?.status ?? (on ? 'loading' : '')}`} />
                  {(runtime?.status ?? (on ? 'loading' : 'off')).toUpperCase()}
                </span>
              </label>
            )
          })}
          <div className="count-line">Custom RSS / Atom</div>
          {feedPrefs.custom.map((feed) => {
            const runtime = tickerFeeds.find((f) => f.id === feed.id)
            return (
              <div key={feed.id} className="feed-row">
                <input
                  type="checkbox"
                  checked={feed.enabled}
                  onChange={() => setFeedPrefs(toggleCustom(feedPrefs, feed.id))}
                />
                <span title={feed.url}>{feed.label}</span>
                <span className="badge">
                  <span className={`status-dot ${runtime?.status ?? (feed.enabled ? 'loading' : '')}`} />
                  {(runtime?.status ?? (feed.enabled ? 'loading' : 'off')).toUpperCase()}
                </span>
                <button className="btn ghost" type="button" onClick={() => setFeedPrefs(removeCustom(feedPrefs, feed.id))}>
                  Remove
                </button>
              </div>
            )
          })}
          <form className="feed-add" onSubmit={addFeed}>
            <input
              className="search feed-url"
              placeholder="https://example.com/rss.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Custom feed URL"
            />
            <input
              className="search feed-name"
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Custom feed label"
            />
            <button className="btn" type="submit">
              Add
            </button>
          </form>
          {formError && <div className="ticker-msg">{formError}</div>}
          <p className="disclaimer">
            http/https only. Custom feeds are fetched through the local Vite <code>/proxy/rss</code> and stored in{' '}
            <code>omarchy-overwatch.feeds.v1</code>. Status is LIVE / STALE / ERR / OFF per feed — no invented
            headlines.
          </p>
        </div>
      )}
    </div>
  )
}
