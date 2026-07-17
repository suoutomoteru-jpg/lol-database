import { Outlet, ScrollRestoration } from 'react-router';
import { SiteFooter } from './components/SiteFooter';

/** 全ページ共通レイアウト（本文 + 法務フッター） */
export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}
