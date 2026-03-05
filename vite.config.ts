import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'RequestMaker',
        short_name: 'RequestMaker',
        description: 'Request builder con collection, team e sync Firebase',
        theme_color: '#2563EB',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
