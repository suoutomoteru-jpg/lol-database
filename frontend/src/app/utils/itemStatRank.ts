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
  /** 同じ値を持つアイテムが他にもある（同着）か */
  tied: boolean;
}

const MIN_POPULATION = 5;

function parseNum(v: string): number {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
}

function isPercent(v: string): boolean {
  return /%\s*$/.test(v.trim());
}

export function computeItemStatRank(
  list: ItemSummary[],
  label: string,
  selfId: string,
  selfValueRaw: string,
): ItemStatRank | null {
  const selfValue = parseNum(selfValueRaw);
  if (selfValue <= 0) return null;
  const selfPct = isPercent(selfValueRaw);

  // ラベルが一致し、かつ単位（%か実数か）が同じステータス行を持つ
  // アイテムだけを母集団にする（魔法防御貫通の40%と実数18を混ぜない）
  const values: number[] = [];
  let selfIncluded = false;
  for (const it of list) {
    const line = it.stats.find(s => s.label === label);
    if (!line || isPercent(line.value) !== selfPct) continue;
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
  const tiedCount = values.filter(v => Math.abs(v - selfValue) < 1e-9).length;
  const rank = better + 1;
  return {
    rank,
    total,
    topPct: Math.max(1, Math.round((rank / total) * 100)),
    fillPct: ((total - rank + 0.5) / total) * 100,
    tied: tiedCount > 1,
  };
}
