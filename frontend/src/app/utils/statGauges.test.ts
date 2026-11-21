import { describe, it, expect } from 'vitest';
import {
  statValueAt, computeGauge, formatGaugeValue, growthLabel, applyStatOverrides,
  type ChampStatEntry,
} from './statGauges';
import type { DDragonStats } from '../types/ddragon';

function stats(over: Partial<DDragonStats>): DDragonStats {
  return {
    hp: 600, hpperlevel: 100, mp: 300, mpperlevel: 40,
    movespeed: 335, armor: 30, armorperlevel: 4.5,
    spellblock: 30, spellblockperlevel: 1.5,
    attackrange: 125, hpregen: 8, hpregenperlevel: 0.7,
    mpregen: 7, mpregenperlevel: 0.6, crit: 0, critperlevel: 0,
    attackdamage: 60, attackdamageperlevel: 3,
    attackspeedperlevel: 2.5, attackspeed: 0.65,
    ...over,
  } as DDragonStats;
}

function entry(id: string, tag: string, over: Partial<DDragonStats>): ChampStatEntry {
  return { id, tags: [tag], stats: stats(over) };
}

describe('statValueAt', () => {
  it('Lv18は基礎+成長×17', () => {
    expect(statValueAt(stats({ attackdamage: 60, attackdamageperlevel: 4 }), 'attackdamage', 18))
      .toBe(60 + 4 * 17);
  });

  it('攻撃速度の成長は%加算', () => {
    const v = statValueAt(stats({ attackspeed: 0.6, attackspeedperlevel: 2 }), 'attackspeed', 18);
    expect(v).toBeCloseTo(0.6 * 1.34, 5);
  });

  it('移動速度・射程は成長しない', () => {
    expect(statValueAt(stats({ movespeed: 335 }), 'movespeed', 18)).toBe(335);
    expect(statValueAt(stats({ attackrange: 550 }), 'attackrange', 18)).toBe(550);
  });

  it('中間レベルも計算できる（スライダー用）', () => {
    expect(statValueAt(stats({ hp: 600, hpperlevel: 100 }), 'hp', 10)).toBe(600 + 100 * 9);
  });
});

describe('computeGauge', () => {
  const all = [
    entry('A', 'Fighter', { hp: 700, attackrange: 125 }),
    entry('B', 'Fighter', { hp: 650, attackrange: 175 }),
    entry('C', 'Fighter', { hp: 600, attackrange: 125 }),
    entry('D', 'Mage',    { hp: 550, attackrange: 550 }),
    entry('E', 'Mage',    { hp: 520, attackrange: 525 }),
  ];

  it('体力はクラス内で比較する', () => {
    const g = computeGauge(all, all[1], 'hp', 1, 'peer');
    expect(g.groupLabel).toBe('ファイター');
    expect(g.total).toBe(3);
    expect(g.rank).toBe(2);
    expect(g.rankLabel).toBe('上位67%');
  });

  it('射程・攻撃速度もクラス内で比較する', () => {
    const g = computeGauge(all, all[3], 'attackrange', 1, 'peer');
    expect(g.groupLabel).toBe('メイジ');
    expect(g.total).toBe(2);
    expect(g.rank).toBe(1);
  });

  it('scope=allなら全体で比較する', () => {
    const g = computeGauge(all, all[0], 'hp', 1, 'all');
    expect(g.groupLabel).toBe('全チャンピオン');
    expect(g.total).toBe(5);
    expect(g.rank).toBe(1);
  });

  it('順位は常に「上位n%」で表記される（1位=上位5%、17位=上位85%）', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      entry(`X${i}`, 'Fighter', { hp: 500 + i * 10 }));
    const low = computeGauge(many, many[3], 'hp', 1, 'peer');
    expect(low.rank).toBe(17);
    expect(low.rankLabel).toBe('上位85%');
    const high = computeGauge(many, many[15], 'hp', 1, 'peer');
    expect(high.rank).toBe(5);
    expect(high.rankLabel).toBe('上位25%');
    const top = computeGauge(many, many[19], 'hp', 1, 'peer');
    expect(top.rank).toBe(1);
    expect(top.rankLabel).toBe('上位5%');
  });

  it('Lv18で成長込みの順位が入れ替わる', () => {
    const pair = [
      entry('Low',  'Fighter', { attackdamage: 65, attackdamageperlevel: 2 }),
      entry('High', 'Fighter', { attackdamage: 60, attackdamageperlevel: 5 }),
    ];
    expect(computeGauge(pair, pair[0], 'attackdamage', 1, 'peer').rank).toBe(1);
    expect(computeGauge(pair, pair[0], 'attackdamage', 18, 'peer').rank).toBe(2);
  });
});

describe('formatGaugeValue', () => {
  it('攻撃速度は小数・他は整数', () => {
    expect(formatGaugeValue('attackspeed', 0.625)).toBe('0.625');
    expect(formatGaugeValue('attackspeed', 0.9)).toBe('0.9');
    expect(formatGaugeValue('hp', 654.6)).toBe('655');
  });
});

describe('growthLabel', () => {
  it('通常の成長は +X/Lv、攻撃速度は %表記', () => {
    expect(growthLabel(stats({ attackdamageperlevel: 4 }), 'attackdamage')).toBe('+4/Lv');
    expect(growthLabel(stats({ attackspeedperlevel: 2.5 }), 'attackspeed')).toBe('+2.5%/Lv');
  });

  it('成長値0（セナのAD等）は「成長なし」', () => {
    expect(growthLabel(stats({ attackdamageperlevel: 0 }), 'attackdamage')).toBe('成長なし');
  });

  it('移動速度・射程は成長の概念がないため null', () => {
    expect(growthLabel(stats({}), 'movespeed')).toBeNull();
    expect(growthLabel(stats({}), 'attackrange')).toBeNull();
  });
});

describe('applyStatOverrides', () => {
  const overrides = {
    source: '16.1.1',
    fields: { attackdamageperlevel: { Urgot: 4, Jinx: 3.25 } },
  };

  it('現行値が0のフィールドだけ補完する', () => {
    const s = stats({ attackdamageperlevel: 0 });
    const out = applyStatOverrides('Urgot', s, overrides);
    expect(out.attackdamageperlevel).toBe(4);
    expect(s.attackdamageperlevel).toBe(0); // 元は不変
  });

  it('現行値が入っていれば補完しない（DDragon修復時に自動で現行優先）', () => {
    const s = stats({ attackdamageperlevel: 5 });
    expect(applyStatOverrides('Urgot', s, overrides).attackdamageperlevel).toBe(5);
  });

  it('補完データにないチャンピオンや overrides=null はそのまま', () => {
    const s = stats({ attackdamageperlevel: 0 });
    expect(applyStatOverrides('Senna', s, overrides).attackdamageperlevel).toBe(0);
    expect(applyStatOverrides('Urgot', s, null)).toBe(s);
  });
});
