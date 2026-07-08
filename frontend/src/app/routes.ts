import { createBrowserRouter } from 'react-router';
import { Home } from './pages/Home';

// 詳細ページは遅延ロード（初回バンドルを軽くする）
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/champion/:id',
    lazy: () => import('./pages/ChampionDetail').then(m => ({ Component: m.ChampionDetail })),
  },
  {
    path: '/item/:id',
    lazy: () => import('./pages/ItemDetail').then(m => ({ Component: m.ItemDetail })),
  },
]);
