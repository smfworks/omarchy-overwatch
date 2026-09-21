/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { liveFeedsPlugin } from './vite.live-feeds'
import { briefProxyPlugin } from './vite.brief-proxy'

const proxy: Record<string, ProxyOptions> = {
  '/proxy/usgs': {
    target: 'https://earthquake.usgs.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/usgs/, ''),
  },
  '/proxy/eonet': {
    target: 'https://eonet.gsfc.nasa.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/eonet/, ''),
  },
  '/proxy/bbc': {
    target: 'https://feeds.bbci.co.uk',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/bbc/, ''),
  },
  '/proxy/reliefweb': {
    target: 'https://reliefweb.int',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/reliefweb/, ''),
  },
  '/proxy/gdacs': {
    target: 'https://www.gdacs.org',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/gdacs/, ''),
  },
  '/proxy/nws': {
    target: 'https://api.weather.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/nws/, ''),
    headers: {
      'User-Agent': 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)',
      Accept: 'application/geo+json',
    },
  },
  '/proxy/firms': {
    target: 'https://firms.modaps.eosdis.nasa.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/firms/, ''),
    headers: {
      'User-Agent': 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)',
    },
  },
  '/proxy/rainviewer': {
    target: 'https://api.rainviewer.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/rainviewer/, ''),
  },
  '/proxy/celestrak': {
    target: 'https://celestrak.org',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/celestrak/, ''),
    headers: {
      'User-Agent': 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)',
      Accept: 'text/plain, application/json, */*',
    },
  },
  '/proxy/nhc': {
    target: 'https://www.nhc.noaa.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/nhc/, ''),
    headers: {
      'User-Agent': 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)',
      Accept: 'application/json',
    },
  },
  '/proxy/nifc': {
    target: 'https://services3.arcgis.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/nifc/, ''),
  },
  '/proxy/rwapi': {
    target: 'https://api.reliefweb.int',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/rwapi/, ''),
    headers: {
      'User-Agent': 'OverwatchOsint/1.0 (https://github.com/smfworks/omarchy-overwatch)',
      Accept: 'application/json',
    },
  },
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), liveFeedsPlugin(env), briefProxyPlugin()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/h3-js')) return 'h3'
            if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
            if (id.includes('node_modules/satellite.js')) return 'sgp4'
            if (
              id.includes('node_modules/three') ||
              id.includes('node_modules/three-globe') ||
              id.includes('node_modules/react-globe.gl') ||
              id.includes('node_modules/globe.gl')
            ) {
              return 'globe'
            }
            if (id.includes('/src/brief/')) return 'brief'
            if (id.includes('/src/search/')) return 'search'
            if (id.includes('/src/tour/')) return 'tour'
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      proxy,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
