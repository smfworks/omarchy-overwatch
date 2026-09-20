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

## Screenshots

Place captures in [`public/screenshots/`](public/screenshots/) after a local run:

| File | Expected content |
| --- | --- |
| `hud.png` | Full HUD: globe, catalog, dossier, ticker |
| `catalog.png` | Category filters + tool cards |
| `hotspot.png` | Hotspot dossier after clicking a beacon |

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

The launcher runs `npm run preview` if port `4173` is free, then opens the HUD in your default browser.

Dependencies on Arch/Omarchy:

```bash
sudo pacman -S --needed git nodejs npm xdg-utils
```

## Layout

Docks persist in `localStorage` (`omarchy-overwatch.layout.v1`):

| Dock | Default | Contents |
| --- | --- | --- |
| Left | on | Category chips, search, tool cards |
| Right | on | Tool / hotspot / live-point dossier + Open tool |
| Top | on | Clock, filters, live-layer toggles |
| Bottom | on | BBC World / ReliefWeb / GDACS ticker (honest empty/ERR) |

Resize the inner edges. Hide with the × buttons or keys `1` `2` `3` `4`. Reset with the home icon.

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus catalog search |
| `Esc` | Close help → clear selection → clear query |
| `1` / `2` / `3` / `4` | Toggle left / right / top / bottom |
| `?` | Help overlay |

## Globe layers

Toggles in the status strip. Status is **LIVE**, **STALE**, **ERR**, or **OFF** — never invented points.

| Layer | Source | Key |
| --- | --- | --- |
| USGS earthquakes | `earthquake.usgs.gov` GeoJSON (M2.5+ day) | none |
| NASA EONET | natural events | none |
| OpenSky ADS-B | sampled `opensky-network.org` states | none; often rate-limited |
| NWS alerts | `api.weather.gov` (US) | none |

Demo **hotspots** (Kyiv, Hormuz, Suez, Taiwan Strait, etc.) are static geography for navigation. Clicking one opens a dossier of related catalog tools, not a live situation report.

Dev and `vite preview` proxy `/proxy/*` so the browser can reach those APIs. Direct static file hosting without the Vite preview proxy will show **ERR** on layers/feeds that lack CORS — that is expected and honest.

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
