import { describe, expect, it } from 'vitest'
import { rainviewerTileUrl } from './basemap'

describe('RainViewer tile URL', () => {
  it('builds a public tile template from host + path without inventing a frame', () => {
    expect(rainviewerTileUrl('https://tilecache.rainviewer.com', '/v2/radar/1710000000')).toBe(
      'https://tilecache.rainviewer.com/v2/radar/1710000000/256/{z}/{x}/{y}/2/1_1.png',
    )
  })
})
