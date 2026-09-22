/**
 * Open an http(s) URL in a new browsing context from the current user gesture.
 *
 * Omarchy launches Overwatch with Chromium `--app=`. In that window `window.open`
 * often returns null, so Enter/Search never leaves the HUD. A real `<a>` activation
 * in the same gesture (form submit or button click) is usually allowed.
 *
 * Chrome permits one new window per activation. The temporary anchor therefore
 * runs first, aimed at a unique target name. `window.open('', name)` then either
 * returns that context (no second window, no navigation) or, when the anchor was
 * blocked and popups are still allowed, creates the fallback window. `rel=noopener`
 * is not set on this anchor: it makes the new context unreachable, so a successful
 * open is indistinguishable from a block. `opener` is cleared once a handle exists,
 * and `referrerpolicy=no-referrer` keeps the app origin off the request.
 * Result links in the HUD keep `target="_blank"` and `rel="noopener noreferrer"`.
 */
export function openExternal(href: string): boolean {
  const url = httpUrl(href)
  if (!url) return false

  const target = `overwatch-${newId()}`
  if (activateAnchor(url, target)) {
    const named = safeOpen('', target)
    if (named && !named.closed) {
      severOpener(named)
      return true
    }
  }

  const fallback = safeOpen(url, '_blank')
  if (!fallback || fallback.closed) return false
  severOpener(fallback)
  return true
}

function httpUrl(href: string): string | null {
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.href
  } catch {
    return null
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Click a hidden anchor. Returns false when the DOM cannot host the click. */
function activateAnchor(href: string, target: string): boolean {
  try {
    const body = globalThis.document?.body
    if (!body) return false
    const anchor = globalThis.document.createElement('a')
    anchor.href = href
    anchor.target = target
    anchor.referrerPolicy = 'no-referrer'
    anchor.hidden = true
    anchor.tabIndex = -1
    anchor.setAttribute('aria-hidden', 'true')
    body.appendChild(anchor)
    try {
      anchor.click()
    } finally {
      anchor.remove()
    }
    return true
  } catch {
    return false
  }
}

function safeOpen(url: string, target: string): Window | null {
  try {
    return globalThis.window.open(url, target) ?? null
  } catch {
    return null
  }
}

function severOpener(popup: Window) {
  try {
    popup.opener = null
  } catch {
    // Already cross-origin or severed.
  }
}
