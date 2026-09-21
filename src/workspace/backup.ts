import { sanitizeFeedPrefs, type FeedPrefsV1 } from '../feeds/storage'
import { sanitizeLayout, type LayoutState } from '../layout/storage'
import { sanitizeStore } from '../cases/storage'
import type { CaseStoreV1 } from '../cases/types'
import { sanitizeMapStylePrefs, type MapStylePrefsV1 } from '../maps/storage'
import { sanitizeHeatPrefs, type HeatPrefsV1 } from '../heat/storage'
import { sanitizeViewStore, type ViewStoreV1 } from '../views/storage'
import { sanitizeFavorites, type FavoritesV1 } from '../favorites/storage'
import { sanitizeHudPrefs, type HudPrefsV1 } from '../hud/density'
import { sanitizeBriefPrefs } from '../brief/storage'
import type { BriefPrefsV1 } from '../brief/types'

export const WORKSPACE_EXPORT_VERSION = 1 as const

export interface WorkspaceBackupV1 {
  version: typeof WORKSPACE_EXPORT_VERSION
  exportedAt: string
  layout: LayoutState
  feeds: FeedPrefsV1
  cases: CaseStoreV1
  mapStyle: MapStylePrefsV1
  heat: HeatPrefsV1
  views: ViewStoreV1
  favorites: FavoritesV1
  hud: HudPrefsV1
  /** Brief prefs with the API key stripped. */
  brief: Omit<BriefPrefsV1, 'apiKey'> & { apiKey: '' }
}

function stripBrief(prefs: BriefPrefsV1): WorkspaceBackupV1['brief'] {
  const clean = sanitizeBriefPrefs(prefs)
  return { ...clean, apiKey: '' }
}

export function buildWorkspaceBackup(parts: {
  layout: LayoutState
  feeds: FeedPrefsV1
  cases: CaseStoreV1
  mapStyle: MapStylePrefsV1
  heat: HeatPrefsV1
  views: ViewStoreV1
  favorites: FavoritesV1
  hud: HudPrefsV1
  brief: BriefPrefsV1
  exportedAt?: string
}): WorkspaceBackupV1 {
  return {
    version: WORKSPACE_EXPORT_VERSION,
    exportedAt: parts.exportedAt ?? new Date().toISOString(),
    layout: sanitizeLayout(parts.layout),
    feeds: sanitizeFeedPrefs(parts.feeds),
    cases: sanitizeStore(parts.cases),
    mapStyle: sanitizeMapStylePrefs(parts.mapStyle),
    heat: sanitizeHeatPrefs(parts.heat),
    views: sanitizeViewStore(parts.views),
    favorites: sanitizeFavorites(parts.favorites),
    hud: sanitizeHudPrefs(parts.hud),
    brief: stripBrief(parts.brief),
  }
}

export function parseWorkspaceBackup(text: string): { ok: true; backup: WorkspaceBackupV1 } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not valid JSON' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'JSON is not a workspace backup' }
  }
  const row = parsed as Record<string, unknown>
  if (row.version !== 1) return { ok: false, error: 'Unsupported workspace backup version' }
  const backup = buildWorkspaceBackup({
    layout: (row.layout ?? {}) as LayoutState,
    feeds: (row.feeds ?? {}) as FeedPrefsV1,
    cases: (row.cases ?? { version: 1, activeId: null, cases: [] }) as CaseStoreV1,
    mapStyle: (row.mapStyle ?? {}) as MapStylePrefsV1,
    heat: (row.heat ?? {}) as HeatPrefsV1,
    views: (row.views ?? { version: 1, views: [] }) as ViewStoreV1,
    favorites: (row.favorites ?? { version: 1, pinned: [], recent: [] }) as FavoritesV1,
    hud: (row.hud ?? {}) as HudPrefsV1,
    brief: (row.brief ?? {}) as BriefPrefsV1,
    exportedAt: typeof row.exportedAt === 'string' ? row.exportedAt : undefined,
  })
  return { ok: true, backup }
}

export function workspaceFilename(at = new Date()): string {
  const stamp = at.toISOString().slice(0, 10)
  return `overwatch-workspace-${stamp}.json`
}
