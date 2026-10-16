import { describe, it, expect } from 'vitest';
import { calcBuildGrade, nextGradeGap } from './buildGrade';

describe('calcBuildGrade', () => {
  it('115%以上はS', () => {
    expect(calcBuildGrade(115)).toBe('S');
    expect(calcBuildGrade(130)).toBe('S');
  });

  it('105〜115%はA', () => {
    expect(calcBuildGrade(105)).toBe('A');
    expect(calcBuildGrade(114.9)).toBe('A');
  });

  it('95〜105%はB', () => {
    expect(calcBuildGrade(95)).toBe('B');
    expect(calcBuildGrade(104.9)).toBe('B');
  });

  it('95%未満はC', () => {
    expect(calcBuildGrade(94.9)).toBe('C');
    expect(calcBuildGrade(0)).toBe('C');
  });
});

describe('nextGradeGap', () => {
  it('Sに到達済みならnull', () => {
    expect(nextGradeGap(115)).toBeNull();
    expect(nextGradeGap(140)).toBeNull();
  });

  it('最も近い次のグレードとの差分を返す', () => {
    expect(nextGradeGap(110)).toEqual({ grade: 'S', gap: 5 });
    expect(nextGradeGap(100)).toEqual({ grade: 'A', gap: 5 });
    expect(nextGradeGap(90)).toEqual({ grade: 'B', gap: 5 });
  });

  it('境界値: 閾値ちょうどは到達済み扱い', () => {
    expect(nextGradeGap(105)).toEqual({ grade: 'S', gap: 10 });
    expect(nextGradeGap(95)).toEqual({ grade: 'A', gap: 10 });
  });
});
