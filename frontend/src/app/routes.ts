import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// 遅延読み込みするチャンクはビルド毎にファイル名のハッシュが変わり、デプロイの
// たびに古いハッシュのファイルはサーバーから消える。ページを開きっぱなしの
// タブがデプロイ後に遷移すると、もう存在しないチャンクを取りに行って404になり、
// errorElement未設定のままだと画面が真っ白になる。1回だけ強制リロードして
// 最新のindex.html・チャンク一覧を取り直すことで自己回復させる
// （sessionStorageのフラグで無限リロードを防止。成功時はフラグを消すので、
//  デプロイ跨ぎ以外の一時的なネットワーク不調でも次の機会には再試行できる）
function lazyImport<T>(loader: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      const mod = await loader();
      sessionStorage.removeItem('chunk-reload-attempted');
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem('chunk-reload-attempted')) {
        sessionStorage.setItem('chunk-reload-attempted', '1');
        window.location.reload();
        // リロードでページ遷移するまで解決させない（呼び出し元には返さない）
        return new Promise<T>(() => {});
      }
      throw err;
    }
  };
}

// 詳細ページは遅延ロード（初回バンドルを軽くする）
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      {
        path: 'champion/:id',
        lazy: lazyImport(() => import('./pages/ChampionDetail').then(m => ({ Component: m.ChampionDetail }))),
      },
      {
        path: 'item/:id',
        lazy: lazyImport(() => import('./pages/ItemDetail').then(m => ({ Component: m.ItemDetail }))),
      },
      {
        path: 'privacy',
        lazy: lazyImport(() => import('./pages/Privacy').then(m => ({ Component: m.Privacy }))),
      },
      {
        path: 'scaling',
        lazy: lazyImport(() => import('./pages/ScalingChart').then(m => ({ Component: m.ScalingChart }))),
      },
      {
        path: 'runes',
        lazy: lazyImport(() => import('./pages/Runes').then(m => ({ Component: m.Runes }))),
      },
      { path: '*', Component: NotFound },
    ],
  },
]);
