/**
 * 基礎ステータスの相対評価（パーセンタイルゲージ）
 *
 * 「上位◯%」は比較母集団を明示しないと意味を持たないため、
 * 母集団を選び、ラベルとして表示する:
 *   - 体力・攻撃力・攻撃速度・防御系・射程: 同クラス（DDragonタグの第1要素）内
 *   - 移動速度: 全チャンピオン（共通の土俵）
 * タップで「母集団 ⇄ 全体」を切り替えられる。
 * レベルスライダー（1〜18）で成長値込みの実値と順位を再計算する（＝伸びの可視化）。
 */

import type { DDragonStats } from '../types/ddragon';
import { ROLE_LABELS_JA } from './roleAssets';
import type { Role } from '../types/app';

export interface ChampStatEntry {
  id: string;
  tags: string[];
  stats: DDragonStats;
}

/** 1〜18 */
export type GaugeLevel = number;
export type GaugeScope = 'peer' | 'all';

export const GAUGE_STATS = [
  { key: 'hp',           labelJa: '体力' },
  { key: 'attackdamage', labelJa: '攻撃力' },
  { key: 'attackspeed',  labelJa: '攻撃速度' },
  { key: 'armor',        labelJa: '物理防御' },
  { key: 'spellblock',   labelJa: '魔法防御' },
  { key: 'movespeed',    labelJa: '移動速度' },
  { key: 'attackrange',  labelJa: '射程' },
] as const;
export type GaugeStatKey = (typeof GAUGE_STATS)[number]['key'];

const GROWTH_FIELD: Record<GaugeStatKey, keyof DDragonStats | null> = {
  hp:           'hpperlevel',
  attackdamage: 'attackdamageperlevel',
  attackspeed:  'attackspeedperlevel',
  armor:        'armorperlevel',
  spellblock:   'spellblockperlevel',
  movespeed:    null,
  attackrange:  null,
};

/** 指定レベルでのステータス実値（攻撃速度の成長は%加算） */
export function statValueAt(stats: DDragonStats, key: GaugeStatKey, level: GaugeLevel): number {
  const base = Number(stats[key] ?? 0);
  const growthField = GROWTH_FIELD[key];
  if (!growthField || level <= 1) return base;
  const growth = Number(stats[growthField] ?? 0);
  if (key === 'attackspeed') {
    return base * (1 + (growth * (level - 1)) / 100);
  }
  return base + growth * (level - 1);
}

/**
 * DDragonの成長値欠落（パッチ16.2頃からattackdamageperlevelが全員0）の補完データ。
 * CI（generate_stat_overrides.py）が最後に正常だったバージョンから生成する。
 */
export interface StatOverrides {
  /** 補完値の取得元DDragonバージョン（例 "16.1.1"）。補完なしならnull */
  source: string | null;
  fields: Record<string, Record<string, number>>;
}

/** 現行値が0のフィールドだけ補完値で埋めたstatsを返す（元objectは変更しない） */
export function applyStatOverrides(
  championId: string,
  stats: DDragonStats,
  overrides: StatOverrides | null,
): DDragonStats {
  if (!overrides || !overrides.fields) return stats;
  let out: DDragonStats | null = null;
  for (const [field, perChamp] of Object.entries(overrides.fields)) {
    const value = perChamp[championId];
    if (value == null) continue;
    const key = field as keyof DDragonStats;
    if (Number(stats[key] ?? 0) !== 0) continue; // 現行値があれば触らない
    out = out ?? { ...stats };
    out[key] = value;
  }
  return out ?? stats;
}

/** レベルあたりの成長量（成長概念がない項目=null、成長値0=0を区別して返す） */
export function growthPerLevel(stats: DDragonStats, key: GaugeStatKey): number | null {
  const growthField = GROWTH_FIELD[key];
  if (!growthField) return null;
  return Number(stats[growthField] ?? 0);
}

/** 「+4/Lv」「+2.5%/Lv」「成長なし」の表示文字列 */
export function growthLabel(stats: DDragonStats, key: GaugeStatKey): string | null {
  const g = growthPerLevel(stats, key);
  if (g === null) return null; // 移動速度・射程: 成長という概念がない
  if (g === 0) return '成長なし';
  const n = Math.round(g * 100) / 100;
  return key === 'attackspeed' ? `+${n}%/Lv` : `+${n}/Lv`;
}

function groupOf(
  key: GaugeStatKey,
  self: ChampStatEntry,
  all: ChampStatEntry[],
): { label: string; members: ChampStatEntry[] } {
  if (key === 'movespeed') {
    return { label: '全チャンピオン', members: all };
  }
  const tag = self.tags[0] ?? 'Fighter';
  return {
    label: ROLE_LABELS_JA[tag as Role] ?? tag,
    members: all.filter(e => (e.tags[0] ?? 'Fighter') === tag),
  };
}

export interface GaugeInfo {
  value: number;
  rank: number;
  total: number;
  /** バーの塗り幅（0-100）。母集団内で高いほど大きい */
  fillPct: number;
  groupLabel: string;
  /** 「2位」「上位15%」のような表示文字列 */
  rankLabel: string;
}

export function computeGauge(
  all: ChampStatEntry[],
  self: ChampStatEntry,
  key: GaugeStatKey,
  level: GaugeLevel,
  scope: GaugeScope,
): GaugeInfo {
  const group = scope === 'all'
    ? { label: '全チャンピオン', members: all }
    : groupOf(key, self, all);
  const value = statValueAt(self.stats, key, level);
  const values = group.members.map(e => statValueAt(e.stats, key, level));
  const total = Math.max(values.length, 1);
  const better = values.filter(v => v > value + 1e-9).length;
  const rank = better + 1;
  const fillPct = ((total - rank + 0.5) / total) * 100;
  // 上位3位は順位、上半分は「上位◯%」、下半分は「下位◯%」（上位99%は不自然なため）
  let rankLabel: string;
  if (rank <= 3) {
    rankLabel = `${rank}位`;
  } else {
    const topPct = Math.round((rank / total) * 100);
    rankLabel = topPct <= 50
      ? `上位${Math.max(1, topPct)}%`
      : `下位${Math.max(1, Math.round(((total - rank + 1) / total) * 100))}%`;
  }
  return { value, rank, total, fillPct, groupLabel: group.label, rankLabel };
}

/** 表示用の数値整形（攻撃速度のみ小数、それ以外は整数丸め） */
export function formatGaugeValue(key: GaugeStatKey, value: number): string {
  if (key === 'attackspeed') return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return String(Math.round(value));
}
