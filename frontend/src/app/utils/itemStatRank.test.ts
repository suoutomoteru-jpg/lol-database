import { describe, it, expect } from 'vitest';
import { computeItemStatRank } from './itemStatRank';
import type { ItemSummary } from '../hooks/useItemsByStats';

function item(id: string, label: string, value: string): ItemSummary {
  return { id, name: id, imageUrl: '', stats: [{ label, value }] };
}

const AD_ITEMS: ItemSummary[] = [
  item('a', '攻撃力', '80'),
  item('b', '攻撃力', '70'),
  item('c', '攻撃力', '60'),
  item('d', '攻撃力', '55'),
  item('e', '攻撃力', '40'),
];

describe('computeItemStatRank', () => {
  it('母集団内の順位を上位n%で返す', () => {
    const r = computeItemStatRank(AD_ITEMS, '攻撃力', 'b', '70');
    expect(r).not.toBeNull();
    expect(r!.rank).toBe(2);
    expect(r!.total).toBe(5);
    expect(r!.topPct).toBe(40);
  });

  it('1位は上位n%の最小値（切り上げで1%未満にならない）', () => {
    const r = computeItemStatRank(AD_ITEMS, '攻撃力', 'a', '80');
    expect(r!.rank).toBe(1);
    expect(r!.topPct).toBe(20);
  });

  it('%つきの値も数値として比較できる', () => {
    const list = [
      item('a', 'クリティカル率', '25%'),
      item('b', 'クリティカル率', '20%'),
      item('c', 'クリティカル率', '25%'),
      item('d', 'クリティカル率', '15%'),
      item('e', 'クリティカル率', '10%'),
    ];
    const r = computeItemStatRank(list, 'クリティカル率', 'b', '20%');
    expect(r!.rank).toBe(3); // 25%が2つ上にいる
  });

  it('母集団にいないアイテム（コンポーネント等）は自分を加えて比較する', () => {
    const r = computeItemStatRank(AD_ITEMS, '攻撃力', 'outsider', '65');
    expect(r!.total).toBe(6);
    expect(r!.rank).toBe(3); // 80, 70 の下
  });

  it('母集団が5件未満なら null（ノイズ回避）', () => {
    expect(computeItemStatRank(AD_ITEMS.slice(0, 3), '攻撃力', 'a', '80')).toBeNull();
  });

  it('該当ラベルを持たないアイテムは母集団に数えない', () => {
    const mixed = [...AD_ITEMS, item('x', '魔力', '100'), item('y', '魔力', '90')];
    const r = computeItemStatRank(mixed, '攻撃力', 'b', '70');
    expect(r!.total).toBe(5);
  });

  it('値が0や空なら null', () => {
    expect(computeItemStatRank(AD_ITEMS, '攻撃力', 'b', '')).toBeNull();
    expect(computeItemStatRank(AD_ITEMS, '攻撃力', 'b', '0')).toBeNull();
  });
});
