# Omarchy Overwatch

Dark-theme OSINT **workbench** for [Omarchy Linux](https://omarchy.org/): a configurable HUD, an interactive globe, and a curated catalog of **public** investigation sources.

It is a **dashboard + launcher**, not a SpiderFoot/Maltego/Recon-ng clone. It does not scan networks, steal credentials, or fabricate intelligence.

**Author:** SMF Works · **License:** MIT

## Lawful use

Use this software only to research information you are legally allowed to access. Overwatch:

- catalogs third-party public websites and self-hosted tools
- visualizes **public** GeoJSON / RSS / ADS-B feeds when they respond
- never claims completeness, freshness, or operational accuracy
- labels each catalog entry **passive** vs **active** OPSEC

**Passive** means the tool primarily queries an existing public index. **Active** means your browser, your IP, or the vendor will contact a third party (and possibly the target). Both can still be logged. You are responsible for accounts, ToS, privacy law, and workplace policy.

Do not use Overwatch to attempt unauthorized access, credential stuffing, malware operations, or harassment.

## Demo

[![Omarchy Overwatch v2 demo](public/screenshots/hud.png)](docs/demo.mp4)

**v2 full feature tour** (~75s): help overlay, catalog + search, dossier/ticker docks, live layer toggles (USGS / EONET / ADS-B / NWS / AIS / FIRMS), globe orbit + beacon, case notes create/note — [`docs/demo.mp4`](docs/demo.mp4)

## Screenshots

Captures from Omarchy on mikesai6 (`npm run preview` at `127.0.0.1:4173`):

| | |
| --- | --- |
| ![Full HUD](public/screenshots/hud.png) | Globe + USGS/EONET LIVE, ticker, status strip |
| ![Case notes](public/screenshots/cases.png) | Case notes drawer (`n` / **N**) — local scratchpad only |

## Quick start

Requires Node.js 20+ and npm.

```bash
npm install
npm test
npm run dev          # http://127.0.0.1:5173
```

Production-style static preview (also used on Omarchy):

```bash
npm run build
npm run preview      # http://127.0.0.1:4173
```

## Omarchy / Arch install

The install script copies or uses this tree under `~/Apps/omarchy-overwatch` (or `~/.local/share/omarchy-overwatch`), builds the UI, and installs a `.desktop` launcher.

On a machine named **mikesai6** (or any Omarchy box):

```bash
git clone https://github.com/smfworks/omarchy-overwatch.git
cd omarchy-overwatch
chmod +x scripts/install.sh
./scripts/install.sh                  # default: ~/Apps/omarchy-overwatch
# or:
./scripts/install.sh ~/.local/share/omarchy-overwatch
```

Then start from the app menu (**Omarchy Overwatch**) or:

```bash
~/.local/bin/omarchy-overwatch
```

The launcher starts `npm run preview` on `127.0.0.1:4173` if needed, then opens the HUD as an **Omarchy web app** via `omarchy-launch-webapp` (Chromium/Chrome `--app=` mode) — a chrome-free full-view window with no browser tabs or URL bar, same as YouTube/X on Omarchy. A second launch focuses the existing Overwatch window when `omarchy-launch-or-focus-webapp` is available. If those helpers are missing, it falls back to Chromium/Chrome `--app=` and finally `xdg-open`.

The `.desktop` `Exec` always points at this launcher (not a bare URL) so the preview server is up before the app window opens.

Dependencies on Arch/Omarchy:

```bash
sudo pacman -S --needed git nodejs npm chromium xdg-utils
```

## Layout

Docks persist in `localStorage` (`omarchy-overwatch.layout.v1`):

| Dock | Default | Contents |
| --- | --- | --- |
| Left | on | Category chips, search, tool cards |
| Right | on | Tool / hotspot / live-point dossier + Open tool / Pin to case |
| Top | on | Clock, filters, live-layer toggles, case-notes control |
| Bottom | on | BBC World / ReliefWeb / GDACS ticker (honest empty/ERR) |

Resize the inner edges. Hide with the × buttons or keys `1` `2` `3` `4`. Reset with the home icon.

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus catalog search |
| `Esc` | Close help → close case notes → clear selection → clear query |
| `1` / `2` / `3` / `4` | Toggle left / right / top / bottom |
| `n` | Case notes drawer |
| `?` | Help overlay |

## Globe layers

Toggles in the status strip. Status is **LIVE**, **STALE**, **ERR**, or **OFF** — never invented points.

| Layer | Source | Key |
| --- | --- | --- |
| USGS | `earthquake.usgs.gov` GeoJSON (M2.5+ day) | none |
| EONET | NASA natural events | none |
| ADS-B | sampled `opensky-network.org` states | optional; see below |
| NWS | `api.weather.gov` (US) | none |
| AIS | AISStream WebSocket snapshot (`stream.aisstream.io`) | `AISSTREAM_API_KEY` |
| FIRMS | NASA FIRMS VIIRS 24h detections | optional `FIRMS_MAP_KEY` |

Demo **hotspots** (Kyiv, Hormuz, Suez, Taiwan Strait, etc.) are static geography for navigation. Clicking one opens a dossier of related catalog tools, not a live situation report.

Dev and `vite preview` proxy `/proxy/*` so the browser can reach those APIs. Direct static file hosting without the Vite preview proxy will show **ERR** on layers/feeds that lack CORS — that is expected and honest.

### Optional env keys

Copy [`.env.example`](.env.example) to `.env` (gitignored) and restart `npm run dev` / `npm run preview`. Keys stay on the local Vite process — they are not committed and are not baked into the static JS bundle.

| Variable | Layer | Notes |
| --- | --- | --- |
| `AISSTREAM_API_KEY` | AIS | Required for LIVE ships. Free key from [aisstream.io](https://aisstream.io). AISStream has **no REST snapshot** and no browser CORS, so Overwatch collects a short sampled WebSocket snapshot via `/proxy/ais/snapshot`. Without a key the toggle is **ERR** and **no vessels are invented**. |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | ADS-B | Optional OAuth2 client credentials (current OpenSky REST method). Raises rate limits vs anonymous. |
| `OPENSKY_USERNAME` / `OPENSKY_PASSWORD` | ADS-B | Optional legacy HTTP Basic Auth. OpenSky stopped accepting username/password for REST in 2026; if set, Overwatch still sends them. A **401** is an honest failure. |
| `FIRMS_MAP_KEY` | FIRMS | Optional. The layer tries the public 24h Suomi NPP VIIRS CSV first (no key). If that is blocked, `/proxy/firms/api/active` injects this MAP_KEY into the FIRMS area API. |

OpenSky **401** (unauthorized) and **429** (rate limited) surface as **ERR** with that status — the globe does not paint placeholder aircraft. Anonymous OpenSky is often blocked.

FIRMS points are a **sampled subset** (highest FRP first, capped) so the globe stays usable. Same for AIS (unique MMSI cap) and ADS-B (stride sample).

### Proxies

| Prefix | Upstream |
| --- | --- |
| `/proxy/usgs` | `https://earthquake.usgs.gov` |
| `/proxy/eonet` | `https://eonet.gsfc.nasa.gov` |
| `/proxy/opensky` | `https://opensky-network.org` (auth headers injected when env is set) |
| `/proxy/nws` | `https://api.weather.gov` |
| `/proxy/firms` | `https://firms.modaps.eosdis.nasa.gov` |
| `/proxy/ais/*` | AISStream snapshot/status (local plugin, not a public REST API) |
| `/proxy/bbc` | `https://feeds.bbci.co.uk` |
| `/proxy/reliefweb` | `https://reliefweb.int` |
| `/proxy/gdacs` | `https://www.gdacs.org` |

## Case notes

Local-only investigation scratchpad. Open with **n**, the **N** control in the status strip, or **Pin to case** on a dossier.

- Create / rename / delete cases
- Pin catalog tools, demo hotspots, and live-layer points (stored as ids, labels, URLs/coordinates — not fabricated intel)
- Freeform notes (plaintext or light markdown; preview is local-only)
- Persist in `localStorage` key `omarchy-overwatch.cases.v1`
- Export / import one case as JSON

Overwatch never auto-fills notes or pins. Importing JSON creates a **new** case id so it will not silently overwrite another case.

## Catalog

`src/catalog/tools.ts` holds 100+ real public tools spanning every domain listed in the product brief (search, social, network, email, media, people, geo, threat intel, metadata, documents, code, usernames, phones, archives, companies, AIS/ADS-B, viz, news, stats, privacy, finance, weather, conflict, disasters).

Schema: `id, name, category, subcategory?, url, description, tags[], opsec, pricing, inputs[], notes?`.

`npm test` (Vitest) validates schema, unique HTTPS URLs, category coverage, and filters.

## Stack

Vite · React 19 · TypeScript · `react-globe.gl` (Three.js) · custom dock layout · dark glass HUD CSS.

## Development notes

See [AGENTS.md](AGENTS.md) for contributor guidance.

## Acknowledgements

Taxonomy inspired by [OSINT Framework](https://osintframework.com/) (`arf.json`) and the [Bellingcat toolkit](https://bellingcat.gitbook.io/toolkit). Live-layer ideas from public USGS / EONET / OpenSky / NWS documentation. HUD language nods to community OSINT dashboards without copying their code or inventing their data.
