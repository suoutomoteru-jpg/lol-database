import { describe, it, expect } from 'vitest';
import { toRomaji, matchesQuery } from './search';

describe('toRomaji', () => {
  it('長音を直前の母音で展開する（ナー→naa）', () => {
    expect(toRomaji('ナー')).toBe('naa');
  });

  it('通常のカタカナ名を変換できる', () => {
    expect(toRomaji('ガングプランク')).toBe('gangupuranku');
  });

  it('促音（ッ）で次の子音を重ねる', () => {
    expect(toRomaji('ロケット')).toBe('roketto');
  });

  it('拗音・外来語の小母音を変換できる', () => {
    expect(toRomaji('フィオラ')).toBe('fiora');
    expect(toRomaji('ヴァイ')).toBe('vai');
  });

  it('ひらがなにも対応する', () => {
    expect(toRomaji('さむらい')).toBe('samurai');
  });

  it('漢字は変換できないため素通しする（クラッシュしない）', () => {
    expect(toRomaji('終わりなき絶望')).toContain('終');
  });
});

describe('matchesQuery', () => {
  it('日本語名の部分一致でヒットする', () => {
    expect(matchesQuery('アーリ', 'アーリ')).toBe(true);
  });

  it('英語名（大文字小文字区別なし）でヒットする', () => {
    expect(matchesQuery('g', 'ガングプランク', 'Gangplank')).toBe(true);
    expect(matchesQuery('G', 'ナー', 'Gnar')).toBe(true);
  });

  it('ローマ字化した日本語名でヒットする（Gnarの「ナー」→naa）', () => {
    expect(matchesQuery('n', 'ナー', 'Gnar')).toBe(true);
  });

  it('無関係な語にはヒットしない', () => {
    expect(matchesQuery('xyz', 'ガングプランク', 'Gangplank')).toBe(false);
  });

  it('空文字は常にヒットする', () => {
    expect(matchesQuery('', 'ガングプランク', 'Gangplank')).toBe(true);
  });
});
