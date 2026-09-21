import { useState } from 'react'
import { probeOllama } from '../brief/client'
import { OLLAMA_ORIGIN, type BriefProvider } from '../brief/types'
import { useOverwatch } from '../state/context'

export function BriefSettings() {
  const { briefPrefs, setBriefPrefs } = useOverwatch()
  const [probe, setProbe] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)

  const setProvider = (provider: BriefProvider) => {
    setBriefPrefs((prev) => ({
      ...prev,
      provider,
      baseUrl: provider === 'ollama' ? OLLAMA_ORIGIN : prev.baseUrl === OLLAMA_ORIGIN ? '' : prev.baseUrl,
      model: provider === 'ollama' ? prev.model || 'llama3.2' : prev.model,
    }))
  }

  const checkOllama = () => {
    setProbing(true)
    void probeOllama().then((result) => {
      setProbing(false)
      if (result.ok) {
        setProbe(result.models.length ? `LIVE · ${result.models.slice(0, 6).join(', ')}` : 'LIVE · no tags listed')
      } else {
        setProbe(`ERR · ${result.error}`)
      }
    })
  }

  return (
    <div className="brief-settings">
      <div className="count-line">On-screen brief (optional)</div>
      <label className="feed-row">
        <input
          type="checkbox"
          checked={briefPrefs.enabled}
          onChange={() => setBriefPrefs((prev) => ({ ...prev, enabled: !prev.enabled }))}
        />
        <span>Enable on-screen brief (off by default)</span>
      </label>
      <p className="case-hint">
        BYOK or local Ollama only. Keys stay in <code>omarchy-overwatch.brief.v1</code>. No SMF-hosted LLM and no bundled
        cloud key. Input is a JSON dump of enabled layers, heat, selection, and capped headlines.
      </p>
      <div className="brief-fields">
        <label className="case-label">
          Provider
          <select
            className="case-select"
            value={briefPrefs.provider}
            onChange={(e) => setProvider(e.target.value as BriefProvider)}
          >
            <option value="ollama">Local Ollama (127.0.0.1:11434)</option>
            <option value="openai-compat">OpenAI-compatible HTTPS (pasted key)</option>
          </select>
        </label>
        {briefPrefs.provider === 'openai-compat' && (
          <>
            <label className="case-label">
              API base URL
              <input
                className="search"
                value={briefPrefs.baseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(e) => setBriefPrefs((prev) => ({ ...prev, baseUrl: e.target.value }))}
              />
            </label>
            <label className="case-label">
              API key (this browser only)
              <input
                className="search"
                type="password"
                autoComplete="off"
                value={briefPrefs.apiKey}
                placeholder="not committed · never sent to SMF"
                onChange={(e) => setBriefPrefs((prev) => ({ ...prev, apiKey: e.target.value }))}
              />
            </label>
          </>
        )}
        <label className="case-label">
          Model
          <input
            className="search"
            value={briefPrefs.model}
            placeholder={briefPrefs.provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'}
            onChange={(e) => setBriefPrefs((prev) => ({ ...prev, model: e.target.value }))}
          />
        </label>
      </div>
      {briefPrefs.provider === 'ollama' && (
        <div className="actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={checkOllama} disabled={probing}>
            {probing ? 'Probing…' : 'Probe Ollama'}
          </button>
          {probe && <span className="case-hint">{probe}</span>}
        </div>
      )}
    </div>
  )
}
