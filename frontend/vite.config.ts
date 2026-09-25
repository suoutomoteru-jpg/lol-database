import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // パッチ更新のたびに新しいビルドをすぐ配信したいため、確認ダイアログなしで自動更新する
      registerType: 'autoUpdate',
      // main.tsx側で明示的に registerSW() を呼ぶため、自動インジェクトのスクリプトは使わない
      injectRegister: false,
      includeAssets: ['favicon-16.png', 'favicon-32.png', 'favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'nunune.gg — はやくて見やすい、LoLのデータベース',
        short_name: 'nunune',
        description: '全チャンピオンのスキル実数値と全アイテムの金銭効率を日本語でサクッと確認できるLoLデータベース',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#171226',
        theme_color: '#171226',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // アプリ本体（JS/CSS/フォント/ツールチップJSON）はビルド時にプリキャッシュ
        globPatterns: ['**/*.{js,css,html,woff2,woff}'],
        runtimeCaching: [
          {
            // DDragon/CommunityDragonの画像はバージョンURLに紐づき不変なのでCacheFirst
            urlPattern: ({ url }) =>
              url.hostname === 'ddragon.leagueoflegends.com' || url.hostname === 'raw.communitydragon.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'riot-cdn-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // ツールチップ静的JSONはパッチ更新があるためStaleWhileRevalidate
            urlPattern: ({ url }) => url.pathname.startsWith('/tooltips/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tooltips-json' },
          },
        ],
      },
    }),
  ],
})
