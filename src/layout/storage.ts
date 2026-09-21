export type PanelId = 'left' | 'right' | 'top' | 'bottom'

export interface LayoutState {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
  leftWidth: number
  rightWidth: number
  topHeight: number
  bottomHeight: number
}

export const DEFAULT_LAYOUT: LayoutState = {
  left: true,
  right: true,
  top: true,
  bottom: true,
  leftWidth: 360,
  rightWidth: 380,
  topHeight: 84,
  bottomHeight: 52,
}

const KEY = 'omarchy-overwatch.layout.v1'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function sanitizeLayout(partial: Partial<LayoutState> | null | undefined): LayoutState {
  const base = { ...DEFAULT_LAYOUT, ...(partial ?? {}) }
  return {
    left: Boolean(base.left),
    right: Boolean(base.right),
    top: Boolean(base.top),
    bottom: Boolean(base.bottom),
    leftWidth: clamp(Number(base.leftWidth) || DEFAULT_LAYOUT.leftWidth, 240, 640),
    rightWidth: clamp(Number(base.rightWidth) || DEFAULT_LAYOUT.rightWidth, 260, 640),
    topHeight: clamp(Number(base.topHeight) || DEFAULT_LAYOUT.topHeight, 44, 120),
    bottomHeight: clamp(Number(base.bottomHeight) || DEFAULT_LAYOUT.bottomHeight, 36, 160),
  }
}

export function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_LAYOUT }
    return sanitizeLayout(JSON.parse(raw) as Partial<LayoutState>)
  } catch {
    return { ...DEFAULT_LAYOUT }
  }
}

export function saveLayout(layout: LayoutState): void {
  localStorage.setItem(KEY, JSON.stringify(sanitizeLayout(layout)))
}

export function resetLayout(): LayoutState {
  localStorage.removeItem(KEY)
  return { ...DEFAULT_LAYOUT }
}
