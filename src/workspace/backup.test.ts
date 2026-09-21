import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT } from '../layout/storage'
import { DEFAULT_FEED_PREFS } from '../feeds/storage'
import { emptyStore } from '../cases/storage'
import { DEFAULT_MAP_STYLE_PREFS } from '../maps/storage'
import { DEFAULT_HEAT_PREFS } from '../heat/storage'
import { emptyViewStore } from '../views/storage'
import { DEFAULT_FAVORITES } from '../favorites/storage'
import { DEFAULT_HUD_PREFS } from '../hud/density'
import { DEFAULT_BRIEF_PREFS } from '../brief/types'
import { buildWorkspaceBackup, parseWorkspaceBackup } from './backup'

describe('workspace backup', () => {
  it('strips the brief API key and round-trips layout/feeds/cases/views/favorites', () => {
    const json = JSON.stringify(
      buildWorkspaceBackup({
        layout: DEFAULT_LAYOUT,
        feeds: DEFAULT_FEED_PREFS,
        cases: emptyStore(),
        mapStyle: DEFAULT_MAP_STYLE_PREFS,
        heat: DEFAULT_HEAT_PREFS,
        views: emptyViewStore(),
        favorites: { ...DEFAULT_FAVORITES, pinned: ['shodan'] },
        hud: DEFAULT_HUD_PREFS,
        brief: { ...DEFAULT_BRIEF_PREFS, apiKey: 'sk-secret' },
      }),
    )
    expect(json).not.toContain('sk-secret')
    const parsed = parseWorkspaceBackup(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.favorites.pinned).toEqual(['shodan'])
    expect(parsed.backup.brief.apiKey).toBe('')
  })

  it('rejects garbage', () => {
    expect(parseWorkspaceBackup('nope').ok).toBe(false)
    expect(parseWorkspaceBackup('{"version":2}').ok).toBe(false)
  })
})
