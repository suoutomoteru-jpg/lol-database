import type { ItemSummary } from '../hooks/useItemsByStats';

/**
 * アイテムのステータスカテゴリ内ランキング
 *
 * 「そのステータスを持つ完成アイテム」の中で、このアイテムの数値が
 * 上から何%に位置するかを計算する（チャンピオンのゲージと同じ文法）。
 * 母集団が小さすぎると%表示がノイズになるため、5件未満は null を返す。
 */

export interface ItemStatRank {
  rank: number;
  total: number;
  /** 「上位n%」のn（1〜100） */
  topPct: number;
  /** バーの塗り幅（0-100）。母集団内で高いほど大きい */
  fillPct: number;
}

const MIN_POPULATION = 5;

function parseNum(v: string): number {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
}

export function computeItemStatRank(
  list: ItemSummary[],
  label: string,
  selfId: string,
  selfValueRaw: string,
): ItemStatRank | null {
  const selfValue = parseNum(selfValueRaw);
  if (selfValue <= 0) return null;

  // ラベルが一致するステータス行を持つアイテムだけを母集団にする
  const values: number[] = [];
  let selfIncluded = false;
  for (const it of list) {
    const line = it.stats.find(s => s.label === label);
    if (!line) continue;
    if (it.id === selfId) {
      selfIncluded = true;
      values.push(selfValue);
    } else {
      values.push(parseNum(line.value));
    }
  }
  // 自分が母集団に含まれない（コンポーネント等）場合は自分を加えて比較する
  if (!selfIncluded) values.push(selfValue);

  const total = values.length;
  if (total < MIN_POPULATION) return null;

  const better = values.filter(v => v > selfValue + 1e-9).length;
  const rank = better + 1;
  return {
    rank,
    total,
    topPct: Math.max(1, Math.round((rank / total) * 100)),
    fillPct: ((total - rank + 0.5) / total) * 100,
  };
}
