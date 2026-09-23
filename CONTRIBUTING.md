# Contributing

Overwatch OSINT for Omarchy is a public-source catalog and HUD. Add a layer only when the upstream site or feed is real, and keep `npm test` green (`src/catalog` schema and the globe registry).

## Honesty blocklist

Do not add any of the following:

- Telegram `t.me/s` HTML scrape, or any scrape of search-engine result pages. Left-rail search opens an engine URL.
- `stealthFetch`-style client spoofing: fake `X-Forwarded-For` / `X-Real-IP` values, or a pretended residential identity.
- Invented or jittered geo pins. A keyword must not become a country centroid presented as a track, and a real centroid must not be shifted by a random offset.
- FIRMS-as-strikes language. FIRMS rows are thermal detections.

Reimplement interaction patterns in this repo’s own TypeScript. Do not paste upstream HUD source. A country-anchor, when a feed only has a country-level coordinate, is not a real track and must be described that way in the Signal Guide.
