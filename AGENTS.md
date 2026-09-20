# AGENTS.md

Guidance for humans and coding agents working on **Omarchy Overwatch**.

## What this is

A static OSINT **catalog + visualization HUD**. Ship launcher UX, not a recon engine.

- Do **not** add exploit payloads, credential theft, unauthorized-access helpers, or “run this against a target” scanners.
- Do **not** invent tools, URLs, headlines, or geodata. If a feed fails, show `ERR` / `STALE` / empty.
- Prefer omitting a catalog row over guessing a domain.

## Layout of the tree

```
src/catalog/     types, tools.ts (source of truth), schema + vitest
src/data/        static demo hotspots (geography only)
src/globe/       react-globe.gl wrapper + public-feed adapters
src/feeds/       RSS ticker (proxied)
src/layout/      dock chrome + localStorage
src/panels/      catalog, dossier, status, ticker, help
scripts/         Omarchy install + desktop wrapper
```

## Catalog edits

1. Add rows only for real, currently known public sites or GitHub projects.
2. `opsec: 'active'` if the operator or vendor contacts a third party / target; otherwise `passive`.
3. `pricing` is `free` | `freemium` | `paid`.
4. Keep `id` kebab-case and unique. HTTPS URLs only.
5. Run `npm test` — schema requires ≥100 tools and ≥5 per category.

## Feeds and layers

Browser calls go through Vite `server.proxy` / `preview.proxy` (`/proxy/usgs`, `/proxy/eonet`, `/proxy/opensky`, `/proxy/nws`, `/proxy/bbc`, `/proxy/reliefweb`, `/proxy/gdacs`). Adding a source means adding a proxy entry **and** an honest failure path.

No API keys in the repo. If a feed needs a key, leave it out or document an optional env var without committing secrets.

## UI

Dark glass HUD. Cyan/amber status language. Keyboard: `/`, `Esc`, `1–4`, `?`. Persist docks in `omarchy-overwatch.layout.v1`.

Globe textures load from unpkg (`three-globe` example night earth). Offline machines will show an untextured globe; that is acceptable.

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
