import { describe, it, expect } from 'vitest';
import { diffItems } from './patchDiff';

const base = {
  gold: { base: 0, total: 3000, sell: 2100 },
  stats: { FlatPhysicalDamageMod: 65 },
  description: '<stats>攻撃力 65</stats>',
};

describe('diffItems', () => {
  it('前パッチに存在しないアイテムは new', () => {
    expect(diffItems({ '9999': base }, {})).toEqual({ '9999': 'new' });
  });

  it('価格変更を検出する', () => {
    const prev = { '3031': base };
    const curr = { '3031': { ...base, gold: { ...base.gold, total: 3100 } } };
    expect(diffItems(curr, prev)).toEqual({ '3031': 'changed' });
  });

  it('ステータス変更を検出する', () => {
    const prev = { '3031': base };
    const curr = { '3031': { ...base, stats: { FlatPhysicalDamageMod: 70 } } };
    expect(diffItems(curr, prev)).toEqual({ '3031': 'changed' });
  });

  it('説明文変更（効果の数値調整）を検出する', () => {
    const prev = { '3031': base };
    const curr = { '3031': { ...base, description: '<stats>攻撃力 65</stats> クリティカルダメージ+45%' } };
    expect(diffItems(curr, prev)).toEqual({ '3031': 'changed' });
  });

  it('変更がなければ空', () => {
    expect(diffItems({ '3031': base }, { '3031': { ...base } })).toEqual({});
  });

  it('削除されたアイテムは差分に含めない（表示できないため）', () => {
    expect(diffItems({}, { '3031': base })).toEqual({});
  });
});
