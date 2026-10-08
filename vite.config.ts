import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Caminhos relativos: o app funciona em subpasta (GitHub Pages) sem ajuste.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'Rumo — planejamento de viagem',
        short_name: 'Rumo',
        description:
          'Planeje a viagem inteira: descubra, arraste para os dias e veja deslocamento, conflitos e orcamento em tempo real.',
        lang: 'pt-BR',
        theme_color: '#1d6a8c',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Os pacotes de destino sao grandes e nao mudam: cabem no cache.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        runtimeCaching: [
          {
            // Tiles do mapa: cache de uso, nunca pre-carregado.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fontes',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Imagens do Wikimedia: o app funciona sem elas, entao rede primeiro.
            urlPattern: /^https:\/\/upload\.wikimedia\.org\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'imagens',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    // Os pedacos de dado por cidade passam de 500 kB sem minificar; isso e
    // esperado e eles so sao baixados sob demanda.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
