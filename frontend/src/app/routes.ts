import { createBrowserRouter } from 'react-router';
import { Home } from './pages/Home';
import { ChampionDetail } from './pages/ChampionDetail';
import { ItemDetail } from './pages/ItemDetail';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/champion/:id',
    Component: ChampionDetail,
  },
  {
    path: '/item/:id',
    Component: ItemDetail,
  },
]);
