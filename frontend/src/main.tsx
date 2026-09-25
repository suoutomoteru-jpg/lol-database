import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// フォントはセルフホスト（Google Fonts への外部リクエストなし）
// Zen Maru Gothic（丸ゴ）がサイトの声。Noto Sans JP 可変はグリフ欠け時のフォールバック
import '@fontsource/zen-maru-gothic/400.css'
import '@fontsource/zen-maru-gothic/500.css'
import '@fontsource/zen-maru-gothic/700.css'
import '@fontsource/zen-maru-gothic/900.css'
import '@fontsource-variable/noto-sans-jp'
import './styles/theme.css'
import App from './app/App.tsx'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// パッチ更新の反映が最優先のため、確認なしで即座に新バージョンへ切り替える。
// registerType:'autoUpdate' は新SWが activated になった時点で自動的に
// location.reload() する（vite-plugin-pwaのデフォルト挙動）。
// ただし「activated になる」には、ブラウザがsw.jsの差分を検知するチェックが
// 先に走る必要があり、これは通常ページへの実際のナビゲーション時にしか発生しない。
// ホーム画面PWAはバックグラウンドから復帰しても実ナビゲーションが起きないため、
// このチェック自体が走らず更新が反映されない。そのため復帰時・定期的に
// registration.update() を明示的に呼び、チェックの機会を作る。
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
    setInterval(() => registration.update(), 15 * 60 * 1000)
  },
})
