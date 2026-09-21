import type { CasePin, CaseRecord } from './types'

export function pinsToGeoJSON(pins: CasePin[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const pin of pins) {
    if (pin.type !== 'hotspot' && pin.type !== 'point') continue
    features.push({
      type: 'Feature',
      id: pin.id,
      properties: {
        type: pin.type,
        label: pin.label,
        kind: pin.type === 'point' ? pin.kind : 'hotspot',
        extra: pin.type === 'point' ? pin.extra ?? null : null,
        url: pin.url ?? null,
      },
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}

function mdEscape(value: string): string {
  return value.replace(/\|/g, '\\|')
}

export function exportCaseMarkdown(record: CaseRecord, exportedAt = new Date().toISOString()): string {
  const lines = [
    `# ${record.name}`,
    '',
    `_Local Overwatch OSINT for Omarchy case packet. Not a classified sitrep. Pins are ids/labels/coords the operator saved — nothing is auto-filled._`,
    '',
    `- Exported: ${exportedAt}`,
    `- Case id: \`${record.id}\``,
    `- Updated: ${new Date(record.updatedAt).toISOString()}`,
    '',
    '## Notes',
    '',
    record.notes.trim() ? record.notes.trim() : '_No operator notes._',
    '',
    '## Pins',
    '',
  ]
  if (!record.pins.length) {
    lines.push('_No pins._', '')
  } else {
    lines.push('| Type | Label | Detail |', '| --- | --- | --- |')
    for (const pin of record.pins) {
      const detail =
        pin.type === 'tool' || pin.type === 'ticker'
          ? pin.url
          : `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
      lines.push(`| ${pin.type} | ${mdEscape(pin.label)} | ${mdEscape(detail)} |`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

export function filenameForPacket(record: CaseRecord, ext: 'md' | 'geojson'): string {
  const slug = record.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `overwatch-case-${slug || 'untitled'}.${ext}`
}
