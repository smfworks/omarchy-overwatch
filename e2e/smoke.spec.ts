import { expect, test, type Page } from '@playwright/test'

/**
 * SMF runtime smoke — Overwatch critical paths.
 *
 * Pass/fail criteria (skill): hard-fail on dead submit, ~0-size/blank map after
 * locality zoom, broken back-nav restore, uncaught console exceptions on the
 * happy path. Soft notes: aesthetics / usability / brief alignment are runtime
 * interaction checks here — not a screenshot leaderboard. Do not invent live
 * OSINT success when feeds/keys are unset.
 */

const TOUR_KEY = 'omarchy-overwatch.tour.v1'

async function prepareHud(page: Page) {
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.addInitScript((tourKey) => {
    localStorage.setItem(tourKey, JSON.stringify({ version: 1, completed: true }))
  }, TOUR_KEY)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('center-stage')).toBeVisible()
  await expect(page.getByTestId('engine-search')).toBeVisible()
  return consoleErrors
}

async function assertNonZeroPaint(page: Page, locator = page.getByTestId('locality-map')) {
  const map = locator.or(page.getByTestId('osm-fallback'))
  await expect(map.first()).toBeVisible({ timeout: 20_000 })

  const box = await map.first().boundingBox()
  expect(box, 'locality stage must have a layout box').toBeTruthy()
  expect(box!.width, 'map width must be non-zero').toBeGreaterThan(80)
  expect(box!.height, 'map height must be non-zero').toBeGreaterThan(80)

  const paint = await page.evaluate(() => {
    const locality = document.querySelector('[data-testid="locality-map"]')
    if (locality) {
      const canvas = locality.querySelector('canvas')
      if (canvas) {
        const w = canvas.width || canvas.clientWidth
        const h = canvas.height || canvas.clientHeight
        return { kind: 'maplibre' as const, w, h }
      }
      const rect = locality.getBoundingClientRect()
      return { kind: 'empty-container' as const, w: rect.width, h: rect.height }
    }
    const fallback = document.querySelector('[data-testid="osm-fallback"]')
    if (fallback) {
      const frame = fallback.querySelector('iframe')
      const rect = (frame ?? fallback).getBoundingClientRect()
      return { kind: 'osm-fallback' as const, w: rect.width, h: rect.height }
    }
    return { kind: 'missing' as const, w: 0, h: 0 }
  })

  expect(paint.kind, 'map must paint MapLibre canvas or honest OSM fallback').not.toBe('missing')
  expect(paint.kind, 'map container must not stay empty without canvas/fallback').not.toBe(
    'empty-container',
  )
  expect(paint.w, 'painted surface width').toBeGreaterThan(80)
  expect(paint.h, 'painted surface height').toBeGreaterThan(80)
}

test.describe('critical-path smoke', () => {
  test('left-rail search: Enter and Search button both launch results UI', async ({ page }) => {
    const consoleErrors = await prepareHud(page)

    // Launch may open a real browsing context (anchor click and/or window.open).
    // Assert Overwatch's result link, not remote engine HTML.
    page.on('popup', (popup) => {
      void popup.close()
    })

    const query = page.getByTestId('engine-query')
    await query.fill('osint catalog')
    await query.press('Enter')

    const results = page.getByTestId('engine-results')
    await expect(results).toBeVisible()
    const firstLink = page.getByTestId('engine-result-link').first()
    await expect(firstLink).toBeVisible()
    const hrefAfterEnter = await firstLink.getAttribute('href')
    expect(hrefAfterEnter).toMatch(/^https:\/\//)
    expect(hrefAfterEnter).toMatch(/osint|catalog/i)

    // Button path must also mutate results (not dead UI).
    await query.fill('public sources')
    await page.getByTestId('engine-submit').click()
    await expect(page.getByTestId('engine-result-link').first()).toContainText(/public sources/i)
    const hrefAfterClick = await page.getByTestId('engine-result-link').first().getAttribute('href')
    expect(hrefAfterClick).toMatch(/^https:\/\//)
    expect(hrefAfterClick).toMatch(/public|sources/i)

    // Headless may block the auto-open. The result link is the contract; a notice
    // is only the honest fallback and must not claim we scraped the engine.
    await expect(results).toBeVisible()
    const notice = page.locator('.engine-notice')
    if (await notice.count()) {
      await expect(notice).toContainText(/does not scrape/i)
      await expect(notice).toContainText(/result link/i)
    }

    const fatal = consoleErrors.filter(
      (m) => !/ResizeObserver|favicon|Failed to load resource/i.test(m),
    )
    expect(fatal, `uncaught console errors: ${fatal.join(' | ')}`).toEqual([])
  })

  test('hotspot zoom: locality map paints with non-zero size', async ({ page }) => {
    const consoleErrors = await prepareHud(page)

    await page.getByTestId('demo-beacon-kyiv').click()
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'map', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('stage-title')).toContainText(/Locality|Kyiv/i)
    await assertNonZeroPaint(page)

    const fatal = consoleErrors.filter(
      (m) => !/ResizeObserver|favicon|Failed to load resource|WebGL|maplibre/i.test(m),
    )
    expect(fatal, `uncaught console errors: ${fatal.join(' | ')}`).toEqual([])
  })

  test('back / Esc restores globe stage after locality zoom', async ({ page }) => {
    const consoleErrors = await prepareHud(page)

    await page.getByTestId('demo-beacon-kyiv').click()
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'map', {
      timeout: 15_000,
    })
    await assertNonZeroPaint(page)

    // Documented control: ← Globe
    await page.getByTestId('stage-back').click()
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'globe')
    await expect(page.getByTestId('stage-globe')).toBeVisible()
    await expect(page.getByTestId('stage-back')).toHaveCount(0)

    const globeBox = await page.getByTestId('stage-globe').boundingBox()
    expect(globeBox, 'globe stage must regain layout size').toBeTruthy()
    expect(globeBox!.width).toBeGreaterThan(80)
    expect(globeBox!.height).toBeGreaterThan(80)

    // Esc path: clear prior selection so demo beacons list returns, zoom again, then Escape
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('demo-beacon-suez')).toBeVisible()
    await page.getByTestId('demo-beacon-suez').click()
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'map', {
      timeout: 15_000,
    })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'globe')
    await expect(page.getByTestId('stage-globe')).toBeVisible()

    const fatal = consoleErrors.filter(
      (m) => !/ResizeObserver|favicon|Failed to load resource|WebGL|maplibre/i.test(m),
    )
    expect(fatal, `uncaught console errors: ${fatal.join(' | ')}`).toEqual([])
  })

  test('sensor legend toggles, signal guide closes on Esc, theater chip restores on Back', async ({
    page,
  }) => {
    await page.route('**/proxy/usgs/**', (route) => route.abort())
    const consoleErrors = await prepareHud(page)

    await expect(page.getByTestId('integrity-gap')).toContainText(/USGS ERR/i, { timeout: 20_000 })
    await expect(page.getByTestId('layer-legend')).toBeVisible()
    await expect(page.getByTestId('poll-delta')).toBeVisible()
    await expect(page.getByTestId('poll-delta')).toContainText(/no successful poll yet|baseline|no change|Δ /i)
    await expect(page.getByTestId('theater-chips')).toBeVisible()

    const quakes = page.getByTestId('layer-toggle-earthquakes')
    await expect(quakes).toHaveAttribute('aria-pressed', 'true')
    await quakes.click()
    await expect(quakes).toHaveAttribute('aria-pressed', 'false')
    await quakes.click()
    await expect(quakes).toHaveAttribute('aria-pressed', 'true')

    const firms = page.getByTestId('layer-toggle-firms')
    await expect(firms).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('f')
    await expect(firms).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('f')
    await expect(firms).toHaveAttribute('aria-pressed', 'false')

    await page.getByTestId('signal-guide-open').click()
    await expect(page.getByTestId('signal-guide')).toBeVisible()
    await expect(page.getByTestId('signal-guide')).toContainText(/does not scrape/i)
    await expect(page.getByTestId('signal-guide')).toContainText(/country-anchor/i)
    await expect(page.getByTestId('signal-guide')).toContainText(/not strikes/i)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('signal-guide')).toHaveCount(0)

    await page.getByTestId('theater-europe').click()
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'globe')
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-theater', 'europe')
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-camera-lat', '50')
    await expect(page.getByTestId('stage-back')).toBeVisible()
    await expect(page.getByTestId('stage-title')).toContainText(/Camera · EUROPE/i)

    await page.getByTestId('stage-back').click()
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-stage', 'globe')
    await expect(page.getByTestId('center-stage')).toHaveAttribute('data-theater', '')
    await expect(page.getByTestId('center-stage')).not.toHaveAttribute('data-camera-lat', '50')
    await expect(page.getByTestId('stage-back')).toHaveCount(0)
    await expect(page.getByTestId('stage-globe')).toBeVisible()

    const fatal = consoleErrors.filter(
      (m) => !/ResizeObserver|favicon|Failed to load resource|WebGL|maplibre/i.test(m),
    )
    expect(fatal, `uncaught console errors: ${fatal.join(' | ')}`).toEqual([])
  })
})
