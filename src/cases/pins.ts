import type { OsintTool } from '../catalog/types'
import type { Hotspot } from '../data/hotspots'
import type { TickerItem } from '../feeds/rss'
import type { GeoPoint } from '../globe/types'
import type { CasePin } from './types'

export function pinFromTool(tool: OsintTool): CasePin {
  return { type: 'tool', id: tool.id, label: tool.name, url: tool.url }
}

export function pinFromHotspot(hotspot: Hotspot): CasePin {
  return {
    type: 'hotspot',
    id: hotspot.id,
    label: hotspot.name,
    lat: hotspot.lat,
    lng: hotspot.lng,
    url: hotspot.links[0]?.url,
  }
}

export function pinFromPoint(point: GeoPoint): CasePin {
  return {
    type: 'point',
    id: point.id,
    label: point.label,
    lat: point.lat,
    lng: point.lng,
    kind: point.kind,
    extra: point.extra,
    url: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=6/${point.lat}/${point.lng}`,
  }
}

export function pinFromTicker(item: TickerItem): CasePin {
  const pin: CasePin = {
    type: 'ticker',
    id: item.id,
    label: item.title,
    url: item.url,
    source: item.source,
  }
  if (item.published) pin.published = item.published
  if (item.feedId) pin.feedId = item.feedId
  return pin
}
