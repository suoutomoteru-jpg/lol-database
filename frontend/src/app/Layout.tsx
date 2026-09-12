import { Outlet, ScrollRestoration } from 'react-router';
import { SiteFooter } from './components/SiteFooter';

/**
 * 全ページ共通レイアウト（本文 + 法務フッター）
 *
 * iOSでPWAとしてホーム画面から起動すると
 * （apple-mobile-web-app-status-bar-style: black-translucent）、
 * コンテンツがステータスバー（時計等）の下まで描画範囲に含まれてしまう。
 * env(safe-area-inset-top) で先頭に余白を取り、被らないようにする。
 */
export function Layout() {
  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}
