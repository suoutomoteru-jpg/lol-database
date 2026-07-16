import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionList } from '../api/dataDragon';
import type { ChampStatEntry } from '../utils/statGauges';

/**
 * 全チャンピオンの基礎ステータス＋クラスタグ
 * （相対評価ゲージのパーセンタイル計算用。champion.json はキャッシュ済み）
 */
export function useChampionStatEntries(): ChampStatEntry[] {
  const [entries, setEntries] = useState<ChampStatEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    getLatestVersion()
      .then(v => fetchChampionList(v))
      .then(data => {
        if (cancelled) return;
        setEntries(
          Object.values(data).map(c => ({ id: c.id, tags: c.tags, stats: c.stats })),
        );
      })
      .catch(() => { /* ゲージなしで動作継続 */ });
    return () => { cancelled = true; };
  }, []);

  return entries;
}
