import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// 詳細ページは遅延ロード（初回バンドルを軽くする）
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      {
        path: 'champion/:id',
        lazy: () => import('./pages/ChampionDetail').then(m => ({ Component: m.ChampionDetail })),
      },
      {
        path: 'item/:id',
        lazy: () => import('./pages/ItemDetail').then(m => ({ Component: m.ItemDetail })),
      },
      {
        path: 'privacy',
        lazy: () => import('./pages/Privacy').then(m => ({ Component: m.Privacy })),
      },
      { path: '*', Component: NotFound },
    ],
  },
]);
