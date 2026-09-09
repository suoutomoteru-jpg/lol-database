import { useState, useEffect } from 'react';
import { getLatestVersion, fetchSummonerSpells, spellImageUrl } from '../api/dataDragon';

export interface SummonerSpellInfo {
  id: string;        // "SummonerFlash"
  name: string;       // "フラッシュ"
  cooldown: number;   // 基本CT(秒、CDR未適用)
  icon: string;
}

interface UseSummonerSpellsResult {
  spells: SummonerSpellInfo[];
  loading: boolean;
  error: Error | null;
}

// サモナーズリフト(CLASSIC)で使われるスペルのみ、タイマーで使う固定順で並べる。
// ARAM専用(スノーボール等)やアリーナ専用スペルはここには含めない。
const DISPLAY_ORDER = [
  'SummonerFlash',
  'SummonerDot',     // イグナイト
  'SummonerHeal',
  'SummonerBarrier',
  'SummonerExhaust',
  'SummonerBoost',   // クレンズ
  'SummonerHaste',   // ゴースト
  'SummonerTeleport',
  'SummonerSmite',
  'SummonerMana',    // クラリティ
];

export function useSummonerSpells(): UseSummonerSpellsResult {
  const [spells, setSpells] = useState<SummonerSpellInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const v = await getLatestVersion();
        const raw = await fetchSummonerSpells(v);
        if (cancelled) return;

        const list = DISPLAY_ORDER
          .map(id => raw[id])
          .filter((s): s is NonNullable<typeof s> => !!s)
          .map(s => ({
            id: s.id,
            name: s.name,
            cooldown: Number(s.cooldownBurn) || s.cooldown[0] || 0,
            icon: spellImageUrl(v, s.image.full),
          }));

        setSpells(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { spells, loading, error };
}
