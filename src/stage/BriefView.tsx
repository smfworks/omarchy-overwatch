import { useOverwatch } from '../state/context'

export function BriefView() {
  const { brief, briefPrefs, runBrief, setHelpOpen } = useOverwatch()

  return (
    <div className="depth-view brief-view">
      <div className="brief-banner" role="note">
        Model-generated from on-screen public feeds. Not a sitrep. Not classified. Cite only provided items; UNKNOWN
        when missing.
      </div>
      {brief.status === 'loading' && (
        <div className="empty">Requesting a local brief from {briefPrefs.provider === 'ollama' ? 'Ollama' : 'your API'}…</div>
      )}
      {brief.status === 'err' && (
        <div className="empty">
          ERR — {brief.error ?? 'brief unavailable'}. Nothing was invented.
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn ghost" onClick={() => setHelpOpen(true)}>
              Brief settings
            </button>
            <button type="button" className="btn" onClick={runBrief}>
              Retry
            </button>
          </div>
        </div>
      )}
      {brief.status === 'live' && brief.text && (
        <>
          <div className="depth-kicker">
            On-screen brief
            {brief.model ? ` · ${brief.model}` : ''}
            {brief.provider ? ` · ${brief.provider}` : ''}
          </div>
          <pre className="brief-body">{brief.text}</pre>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={runBrief}>
              Regenerate
            </button>
            <button type="button" className="btn ghost" onClick={() => setHelpOpen(true)}>
              Settings
            </button>
          </div>
          <div className="disclaimer">
            Output is whatever the local/BYOK model returned from the structured JSON dump of this HUD. Feeds may be
            STALE or ERR. Overwatch OSINT for Omarchy does not host an LLM and does not verify the model.
          </div>
        </>
      )}
      {brief.status === 'live' && !brief.text && (
        <div className="empty">ERR — model returned empty text. Nothing was invented.</div>
      )}
    </div>
  )
}
