/** Overwatch-native glossary. Patterns from public HUDs; copy is not upstream text. */
export interface GuideEntry {
  id: string
  title: string
  meaning: string
  matters: string
  notMeaning: string
}

export const SIGNAL_GUIDE: readonly GuideEntry[] = [
  {
    id: 'live',
    title: 'LIVE',
    meaning: 'The last fetch succeeded and is inside the freshness window.',
    matters: 'A LIVE count of 0 means that public feed returned no points.',
    notMeaning: 'LIVE does not mean the sensor proved that nothing happened.',
  },
  {
    id: 'stale',
    title: 'STALE',
    meaning: 'The last good payload is still shown after a failed refresh or a passed freshness window.',
    matters: 'Those positions are leftover observations. STALE is a source gap, not an all-clear.',
    notMeaning: 'STALE points are not a new observation and not proof the situation is unchanged.',
  },
  {
    id: 'err',
    title: 'ERR',
    meaning: 'The fetch failed and there is no payload to keep. That layer stays empty.',
    matters: 'The gap badge names the failed layer so an empty globe is not read as calm.',
    notMeaning: 'Overwatch does not invent quakes, aircraft, ships, fires, or headlines to fill an error.',
  },
  {
    id: 'off',
    title: 'OFF',
    meaning: 'The layer is toggled off and is not being polled.',
    matters: 'Off is an operator choice. It is omitted from the gap badge.',
    notMeaning: 'Off is not a source failure.',
  },
  {
    id: 'counts',
    title: 'Counts',
    meaning: 'A sensor count is how many points from that layer are in the current time window and AOI.',
    matters: 'The row is a toggle. The number is the current payload in view, not a separate score.',
    notMeaning: 'A count is not a threat score, a casualty figure, or proof of full coverage.',
  },
  {
    id: 'delta',
    title: 'Poll delta',
    meaning:
      'After each successful poll, Δ compares entity IDs with the previous successful payload of that same layer.',
    matters:
      '"+N new" and "−N removed" mean IDs entered or left that payload. The first success is a baseline. "No change" means the same IDs.',
    notMeaning: 'A failed poll does not invent a delta. A baseline is not a burst of new events.',
  },
  {
    id: 'precision',
    title: 'Precision',
    meaning:
      'A real track is a coordinate the feed sent for that entity. A geometry centroid is the center of a polygon that same feed sent. A country-anchor is only a country-level location on the record, such as a ReliefWeb country point.',
    matters:
      'Country-anchors and centroids are coarser than a track. Records with no coordinates are dropped instead of guessed.',
    notMeaning:
      'A country-anchor is not a real track. Overwatch does not add jitter, and it does not invent a pin when the feed omitted a coordinate.',
  },
  {
    id: 'search',
    title: 'Search',
    meaning: 'Left-rail search opens a web engine with your query.',
    matters: 'The result link is the engine URL. Overwatch does not download or parse the result page.',
    notMeaning: 'Overwatch does not scrape engine result pages, Telegram, or a target site.',
  },
  {
    id: 'theaters',
    title: 'Theaters',
    meaning: 'WORLD, AMERICAS, EUROPE, MIDEAST, AFRICA, and ASIA-PAC move the camera only.',
    matters: 'Back restores the previous globe camera. The chips do not filter feeds.',
    notMeaning: 'A theater chip is not a situation report.',
  },
  {
    id: 'heat',
    title: 'HEAT',
    meaning: 'L is how many distinct live layers already have a real point in that H3 cell.',
    matters: 'It is attention overlap of points already fetched.',
    notMeaning: 'HEAT is not a prediction and not a combat assessment.',
  },
  {
    id: 'infer',
    title: 'What not to infer',
    meaning: 'Co-located points are separate public records that happen to share a cell or a view.',
    matters: 'FIRMS rows are thermal detections. ADS-B and AIS rows are samples.',
    notMeaning:
      'FIRMS rows are not strikes. A missing track is not proof of absence. Catalog cards open public sites; they do not scan a target. Headlines stay the publisher’s text and are not turned into map pins.',
  },
]

export function signalGuideText(): string {
  return SIGNAL_GUIDE.map((entry) => `${entry.title}\n${entry.meaning}\n${entry.matters}\n${entry.notMeaning}`).join(
    '\n\n',
  )
}
