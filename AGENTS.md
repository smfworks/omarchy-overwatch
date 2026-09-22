# AGENTS.md

Guidance for humans and coding agents working on **Overwatch OSINT for Omarchy**.

The GitHub repo path remains `smfworks/omarchy-overwatch` and the CLI/bin name remains `omarchy-overwatch`. Product name is Overwatch OSINT for Omarchy.

## What this is

A static OSINT **catalog + visualization HUD**. Ship launcher UX, not a recon engine.

- Do **not** add exploit payloads, credential theft, unauthorized-access helpers, or “run this against a target” scanners.
- Do **not** invent tools, URLs, headlines, or geodata. If a feed fails, show `ERR` / `STALE` / empty.
- Prefer omitting a catalog row over guessing a domain.

## Layout of the tree

```
src/catalog/     types, tools.ts (source of truth), schema + vitest
src/data/        static demo hotspots (geography only)
src/globe/       react-globe.gl wrapper + public-feed adapters/parsers + layer registry + tracks
src/heat/        H3 attention overlay (client-side score + MapLibre/globe)
src/brief/       optional BYOK / Ollama on-screen brief (localStorage key only)
src/maps/        MapLibre locality + storm maps (OSM / Esri imagery / OpenFreeMap + RainViewer)
src/stage/       center stage (globe / map / storm / depth / brief)
src/cases/       local case-notes store (localStorage, export/import, markdown/geojson packet)
src/feeds/       RSS ticker (proxied) + custom feed prefs
src/layout/      dock chrome + localStorage
src/panels/      catalog, dossier, status, ticker, help, case drawer, guided open
src/search/      ⌘K palette across catalog + currently loaded public data
src/aoi/         locality-map rectangle/polygon clip
src/views/       named camera/layer snapshots
src/time/        1h/6h/24h window + poll ring buffer (no fabricated history)
src/deeplink/    ?lat=&lon=&z=&layers=&style=&aoi=
src/favorites/   pinned + recent catalog tools
src/workspace/   layout/feeds/cases/views/favorites backup JSON
src/hud/         density modes + reduced-motion helpers
src/tour/        first-run honesty tour
scripts/         Omarchy install + desktop wrapper
```

## Catalog edits

1. Add rows only for real, currently known public sites or GitHub projects.
2. `opsec: 'active'` if the operator or vendor contacts a third party / target; otherwise `passive`.
3. `pricing` is `free` | `freemium` | `paid`.
4. Keep `id` kebab-case and unique. HTTPS URLs only.
5. Run `npm test` — schema requires ≥100 tools and ≥5 per category.

## Feeds and layers

Browser calls go through Vite `server.proxy` / `preview.proxy` plus `vite.live-feeds.ts` and `vite.brief-proxy.ts` (`/proxy/usgs`, `/proxy/eonet`, `/proxy/opensky`, `/proxy/nws`, `/proxy/firms`, `/proxy/ais`, `/proxy/bbc`, `/proxy/reliefweb`, `/proxy/rwapi`, `/proxy/gdacs`, `/proxy/celestrak`, `/proxy/nhc`, `/proxy/nifc`, `/proxy/rainviewer`, `/proxy/rss`, `/proxy/brief`). Adding a source means adding a **registry row** in `src/globe/registry.ts`, a proxy or live-feed handler, **and** an honest failure path.

No API keys in the repo. Optional keys live in `.env` (see `.env.example`): `AISSTREAM_API_KEY`, `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`, `OPENSKY_USERNAME` / `OPENSKY_PASSWORD`, `FIRMS_MAP_KEY`. Never commit secrets. If a feed needs a key and none is configured, show `ERR` / empty — do not invent geodata.

OpenStreetMap raster (DEFAULT), Esri World Imagery (SATELLITE, attributed), OpenFreeMap dark (NIGHT) and RainViewer public endpoints need no key. Custom RSS URLs must be `http`/`https` only.

Case notes persist in `omarchy-overwatch.cases.v1`. Feed prefs persist in `omarchy-overwatch.feeds.v1`. Heat toggle persists in `omarchy-overwatch.heat.v1`. Map style persists in `omarchy-overwatch.mapstyle.v1`. Optional brief prefs/key persist in `omarchy-overwatch.brief.v1` (never commit). Named views persist in `omarchy-overwatch.views.v1`. Favorites/recents persist in `omarchy-overwatch.favorites.v1`. HUD density/overlay persist in `omarchy-overwatch.hud.v1`. First-run tour completion persists in `omarchy-overwatch.tour.v1`. Do not auto-fill notes or pins.

## UI

Dark glass HUD. Cyan/amber status language. Keyboard: `/`, `⌘K`, `Esc`, `b`, `1–4`, `n`, `d`, `[` `]`, `?`. Persist docks in `omarchy-overwatch.layout.v1`.

Globe textures live in `public/globe/` (no unpkg). Offline machines will show an untextured globe if those files are missing; that is acceptable. Locality/storm maps use the style pack (OSM / Esri / OpenFreeMap) — offline = empty map or OSM embed + honest ERR/empty, not invented streets. HEAT is a documented H3 overlay (L = distinct live layers in a cell). On-screen brief is opt-in BYOK/Ollama only.

## Commands

```bash
npm install
npm test
npm run build
npm run preview
npm run test:smoke   # Playwright critical-path gate (search / map / back)
```

## Omarchy

Install path defaults to `~/Apps/omarchy-overwatch`. Keep `scripts/install.sh` and `omarchy-overwatch.desktop` in sync with the preview port (`4173`).
