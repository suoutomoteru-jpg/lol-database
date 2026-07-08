import { describe, it, expect } from 'vitest';
import { STAT_DEFS, STAT_KEY_LABELS, SKILL_KEYWORDS, ITEM_KEYWORDS, TOOLTIP_TAG_STAT, itemHasStat } from './stats';

describe('ステータス台帳', () => {
  it('キーは一意', () => {
    const keys = STAT_DEFS.map(d => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('キーワードは長い順に並ぶ（部分マッチ防止）', () => {
    for (const table of [SKILL_KEYWORDS, ITEM_KEYWORDS]) {
      for (let i = 1; i < table.length; i++) {
        expect(table[i - 1].text.length).toBeGreaterThanOrEqual(table[i].text.length);
      }
    }
  });

  it('見落とされがちなステータスが登録されている', () => {
    for (const label of ['マナ自動回復', '体力自動回復', 'ヒール＆シールドパワー', 'オムニヴァンプ', '行動妨害耐性']) {
      expect(Object.values(STAT_KEY_LABELS)).toContain(label);
    }
  });

  it('ツールチップタグからstatキーを引ける', () => {
    expect(TOOLTIP_TAG_STAT['physicaldamage']).toBe('stat:FlatPhysicalDamageMod');
    expect(TOOLTIP_TAG_STAT['shield']).toBe('custom:HealAndShieldPower');
  });
});

describe('itemHasStat', () => {
  const def = STAT_DEFS.find(d => d.labelJa === 'マナ自動回復')!;

  it('stat欄が0でも説明文の「基礎マナ自動回復」で検出できる', () => {
    expect(itemHasStat(def, {}, [], '基礎マナ自動回復100%')).toBe(true);
  });

  it('stat欄の値でも検出できる', () => {
    expect(itemHasStat(def, { FlatMPRegenMod: 5 }, [], '')).toBe(true);
    expect(itemHasStat(def, {}, [], '')).toBe(false);
  });
});
