/// <reference types="vitest/config" />
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

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
  '/proxy/opensky': {
    target: 'https://opensky-network.org',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy\/opensky/, ''),
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
      'User-Agent': 'OmarchyOverwatch/1.0 (https://github.com/smfworks/omarchy-overwatch)',
      Accept: 'application/geo+json',
    },
  },
}

export default defineConfig({
  plugins: [react()],
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
})
