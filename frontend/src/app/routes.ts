import { createBrowserRouter } from 'react-router';
import { Home } from './pages/Home';
import { ChampionDetail } from './pages/ChampionDetail';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/champion/:id',
    Component: ChampionDetail,
  },
]);
