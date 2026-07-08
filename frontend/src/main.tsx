import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// フォントはセルフホスト（Google Fonts への外部リクエストなし）
// Noto Sans JP は可変フォント1系統で全ウェイトをカバー（CSS・転送量とも削減）
import '@fontsource/marcellus/400.css'
import '@fontsource-variable/noto-sans-jp'
import './styles/theme.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
