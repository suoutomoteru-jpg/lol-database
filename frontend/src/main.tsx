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

// パッチ更新の反映が最優先のため、確認なしで即座に新バージョンへ切り替える
registerSW({ immediate: true })
