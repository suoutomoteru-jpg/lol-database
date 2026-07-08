import { describe, it, expect } from 'vitest';
import { processTooltipHtml, processItemDescription, injectStatLinks } from './richText';

describe('processTooltipHtml', () => {
  it('ダメージ種別タグを色付き span に変換する', () => {
    const out = processTooltipHtml('<physicalDamage>100の物理ダメージ</physicalDamage>');
    expect(out).toContain('var(--color-dmg-physical)');
    expect(out).toContain('100の物理ダメージ');
    expect(out).not.toContain('<physicalDamage>');
  });

  it('未知のタグを除去しテキストは残す', () => {
    expect(processTooltipHtml('<mystery>本文</mystery>')).toBe('本文');
  });

  it('強調系タグは strong に統一される', () => {
    expect(processTooltipHtml('<status>スタン</status>')).toBe('<strong>スタン</strong>');
  });

  it('HTML エンティティを復元する', () => {
    expect(processTooltipHtml('A&amp;B&nbsp;C')).toBe('A&B C');
  });
});

describe('processItemDescription', () => {
  it('stats ブロックと attention を変換する', () => {
    const out = processItemDescription(
      '<mainText><stats>攻撃力 65</stats><attention>40%</attention>増加</mainText>',
    );
    expect(out).toContain('<div class="item-stats">攻撃力 65</div>');
    expect(out).toContain('<strong style="color:#C89B3C">40%</strong>');
    expect(out).not.toContain('mainText');
  });

  it('3連以上の <br> は2つに畳む', () => {
    const out = processItemDescription('a<br><br><br><br>b');
    expect(out).toBe('a<br><br>b');
  });
});

describe('injectStatLinks', () => {
  it('テキストノード内のステータス語をクリッカブルにする', () => {
    const out = injectStatLinks('攻撃力が増加');
    expect(out).toContain('data-stat="stat:FlatPhysicalDamageMod"');
    expect(out).toContain('class="stat-keyword"');
  });

  it('タグの属性内は書き換えない', () => {
    const html = '<span data-x="攻撃力">text</span>';
    expect(injectStatLinks(html)).toBe(html);
  });

  it('長いキーワードを優先する（部分マッチしない）', () => {
    const out = injectStatLinks('クリティカルダメージ');
    expect(out).toContain('custom:CritDamage');
    expect(out).not.toContain('FlatCritChanceMod');
  });
});
