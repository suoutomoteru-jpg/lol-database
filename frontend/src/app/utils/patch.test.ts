import { describe, it, expect } from 'vitest';
import { displayPatch } from './patch';

describe('displayPatch', () => {
  it('2025年以降の DDragon バージョンは +10 の季節表記に変換する', () => {
    expect(displayPatch('16.13.1')).toBe('26.13');
    expect(displayPatch('15.1.1')).toBe('25.1');
  });

  it('旧表記（14.x 以前）はそのまま major.minor を返す', () => {
    expect(displayPatch('14.24.1')).toBe('14.24');
  });

  it('解釈できない文字列はそのまま返す', () => {
    expect(displayPatch('lolpatch_7.20')).toBe('lolpatch_7.20');
    expect(displayPatch('')).toBe('');
  });
});
