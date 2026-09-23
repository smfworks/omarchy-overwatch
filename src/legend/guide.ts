/** Overwatch-native glossary. Patterns from public HUDs; copy is not upstream text. */
export const SIGNAL_GUIDE = [
  {
    id: 'live',
    title: 'LIVE',
    body: 'The last fetch succeeded and is inside the freshness window. A LIVE count of 0 means that public feed returned no points. It does not mean the sensor proved that nothing happened.',
  },
  {
    id: 'stale',
    title: 'STALE',
    body: 'The last good payload is still shown, but a later fetch failed or the freshness window passed. Those positions are leftover observations. STALE is a source gap, not an all-clear.',
  },
  {
    id: 'err',
    title: 'ERR',
    body: 'The fetch failed and there is no payload to keep. That layer stays empty. Overwatch does not invent quakes, aircraft, ships, fires, or headlines to fill the gap.',
  },
  {
    id: 'off',
    title: 'OFF',
    body: 'The layer is toggled off and is not being polled. Off is an operator choice, not a source failure.',
  },
  {
    id: 'counts',
    title: 'Counts',
    body: 'A sensor count is how many points from that layer are in the current time window and AOI. It is not a threat score, a casualty figure, or proof of full coverage.',
  },
  {
    id: 'delta',
    title: 'Poll delta',
    body: 'After each successful poll, Δ compares entity IDs with the previous successful payload of that same layer. "+N new" and "−N removed" mean IDs entered or left that payload. The first success is a baseline, not a burst of new events. "No change" means the same IDs. A failed poll does not invent a delta.',
  },
  {
    id: 'search',
    title: 'Search',
    body: 'Left-rail search opens a web engine with your query. Overwatch does not scrape engine result pages, Telegram, or a target site.',
  },
  {
    id: 'theaters',
    title: 'Theaters',
    body: 'WORLD, AMERICAS, EUROPE, MIDEAST, AFRICA, and ASIA-PAC move the camera only. They do not filter feeds and they are not a situation report. Back restores the previous globe camera.',
  },
  {
    id: 'heat',
    title: 'HEAT',
    body: 'L is how many distinct live layers already have a real point in that H3 cell. It is attention overlap, not a prediction and not a combat assessment.',
  },
  {
    id: 'infer',
    title: 'What not to infer',
    body: 'Co-located points are not a causal link. FIRMS rows are thermal detections, not strikes. ADS-B and AIS rows are samples, not every aircraft or vessel. A missing track is not proof of absence. Catalog cards open public sites; they do not scan a target. Headlines stay the publisher’s text and are not turned into map pins.',
  },
] as const

export function signalGuideText(): string {
  return SIGNAL_GUIDE.map((entry) => `${entry.title}\n${entry.body}`).join('\n\n')
}
