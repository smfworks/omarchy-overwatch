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
src/globe/       react-globe.gl wrapper + public-feed adapters/parsers
src/maps/        MapLibre locality + storm maps (OpenFreeMap / RainViewer)
src/stage/       center stage (globe / map / storm / depth)
src/cases/       local case-notes store (localStorage, export/import)
src/feeds/       RSS ticker (proxied) + custom feed prefs
src/layout/      dock chrome + localStorage
src/panels/      catalog, dossier, status, ticker, help, case drawer
scripts/         Omarchy install + desktop wrapper
```

## Catalog edits

1. Add rows only for real, currently known public sites or GitHub projects.
2. `opsec: 'active'` if the operator or vendor contacts a third party / target; otherwise `passive`.
3. `pricing` is `free` | `freemium` | `paid`.
4. Keep `id` kebab-case and unique. HTTPS URLs only.
5. Run `npm test` — schema requires ≥100 tools and ≥5 per category.

## Feeds and layers

Browser calls go through Vite `server.proxy` / `preview.proxy` plus `vite.live-feeds.ts` (`/proxy/usgs`, `/proxy/eonet`, `/proxy/opensky`, `/proxy/nws`, `/proxy/firms`, `/proxy/ais`, `/proxy/bbc`, `/proxy/reliefweb`, `/proxy/gdacs`, `/proxy/rainviewer`, `/proxy/rss`). Adding a source means adding a proxy or live-feed handler **and** an honest failure path.

No API keys in the repo. Optional keys live in `.env` (see `.env.example`): `AISSTREAM_API_KEY`, `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`, `OPENSKY_USERNAME` / `OPENSKY_PASSWORD`, `FIRMS_MAP_KEY`. Never commit secrets. If a feed needs a key and none is configured, show `ERR` / empty — do not invent geodata.

OpenFreeMap and RainViewer public endpoints need no key. Custom RSS URLs must be `http`/`https` only.

Case notes persist in `omarchy-overwatch.cases.v1`. Feed prefs persist in `omarchy-overwatch.feeds.v1`. Do not auto-fill notes or pins.

## UI

Dark glass HUD. Cyan/amber status language. Keyboard: `/`, `Esc`, `b`, `1–4`, `n`, `?`. Persist docks in `omarchy-overwatch.layout.v1`.

Globe textures load from unpkg (`three-globe` example night earth). Offline machines will show an untextured globe; that is acceptable. Locality/storm maps use OpenFreeMap vector tiles (offline = empty map + honest ERR/empty, not invented streets).

## Commands

```bash
npm install
npm test
npm run dev
npm run build
npm run preview
```

## Omarchy

Install path defaults to `~/Apps/omarchy-overwatch`. Keep `scripts/install.sh` and `omarchy-overwatch.desktop` in sync with the preview port (`4173`).
