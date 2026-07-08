import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// フォントはセルフホスト（Google Fonts への外部リクエストなし）
import '@fontsource/marcellus/400.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/600.css'
import '@fontsource/noto-sans-jp/700.css'
import './styles/theme.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
