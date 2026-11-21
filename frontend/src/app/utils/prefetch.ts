/**
 * 遷移先の先読み（タップ→表示を体感ゼロ距離にする）
 *
 * カードに触れた時点（pointerenter / touchstart / focus）で
 * ルートチャンクとデータを温めておく。すべて冪等・失敗は無視。
 */

import { getLatestVersion, fetchChampionDetail, fetchItemEnNames } from '../api/dataDragon';
import { fetchGeneratedTooltips } from '../api/generatedTooltips';

const done = new Set<string>();

function once(key: string, fn: () => void): void {
  if (done.has(key)) return;
  done.add(key);
  try { fn(); } catch { /* 先読み失敗は無視（本読み込みで再試行される） */ }
}

export function prefetchItem(): void {
  once('route:item', () => { import('../pages/ItemDetail'); });
  once('data:item-en-names', () => {
    getLatestVersion().then(v => fetchItemEnNames(v)).catch(() => {});
  });
}

export function prefetchChampion(championId: string): void {
  once('route:champion', () => { import('../pages/ChampionDetail'); });
  once(`data:champion:${championId}`, () => {
    getLatestVersion().then(v => fetchChampionDetail(v, championId)).catch(() => {});
    fetchGeneratedTooltips(championId).catch(() => {}); // ブラウザHTTPキャッシュを温める
  });
}
