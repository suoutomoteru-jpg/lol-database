import { describe, it, expect } from 'vitest';
import { calcGoldEfficiency } from './goldEfficiency';

describe('calcGoldEfficiency', () => {
  it('stat 値から基準ゴールド価値を合算して効率を返す', () => {
    // AD 65 × 35g = 2275g / 2275g = 100%
    expect(calcGoldEfficiency({ FlatPhysicalDamageMod: 65 }, [], '', 2275)).toBeCloseTo(100);
  });

  it('クリティカル率は 0-1 の割合値として扱う', () => {
    // 25% crit = 0.25 × 4000 = 1000g / 500g = 200%
    expect(calcGoldEfficiency({ FlatCritChanceMod: 0.25 }, [], '', 500)).toBeCloseTo(200);
  });

  it('stat 未収録のスキルヘイストを説明文から補完する', () => {
    // AH 20 × 50g = 1000g / 1000g = 100%
    const desc = '<mainText>スキルヘイスト 20</mainText>';
    expect(calcGoldEfficiency({}, [], desc, 1000)).toBeCloseTo(100);
  });

  it('価値ゼロまたは価格ゼロは null を返す', () => {
    expect(calcGoldEfficiency({}, [], '', 1000)).toBeNull();
    expect(calcGoldEfficiency({ FlatPhysicalDamageMod: 10 }, [], '', 0)).toBeNull();
  });
});
