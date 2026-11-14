import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionList } from '../api/dataDragon';
import { applyStatOverrides, type ChampStatEntry, type StatOverrides } from '../utils/statGauges';

export interface ChampionStatData {
  /** 補完適用済みの全チャンピオンエントリ（パーセンタイル母集団） */
  entries: ChampStatEntry[];
  /** 自チャンピオンのstatsへ適用するための補完データ */
  overrides: StatOverrides | null;
}

/**
 * 全チャンピオンの基礎ステータス＋クラスタグ（相対評価ゲージ用）。
 * DDragonの成長値欠落は CI生成の stat-overrides.json で補完する。
 */
export function useChampionStatEntries(): ChampionStatData {
  const [data, setData] = useState<ChampionStatData>({ entries: [], overrides: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const overrides: StatOverrides | null = await fetch('/tooltips/stat-overrides.json')
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);

      const v = await getLatestVersion();
      const list = await fetchChampionList(v);
      if (cancelled) return;

      const entries = Object.values(list).map(c => ({
        id: c.id,
        tags: c.tags,
        stats: applyStatOverrides(c.id, c.stats, overrides),
      }));
      setData({ entries, overrides });
    }

    load().catch(() => { /* ゲージなしで動作継続 */ });
    return () => { cancelled = true; };
  }, []);

  return data;
}
