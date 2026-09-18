import { describe, it, expect } from 'vitest';
import { processTooltipHtml, processItemDescription, injectStatLinks, toPlainText } from './richText';

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

  // 外部データ（第三者CDN）にXSSペイロードが混入した場合の防御
  it('span/strong に紛れ込んだイベントハンドラ属性を除去する', () => {
    const out = processTooltipHtml('<status onmouseover="alert(1)">x</status>');
    expect(out).not.toMatch(/onmouseover/i);
    expect(out).toContain('x');
  });

  it('危険な style（url/expression）を除去し安全な color は残す', () => {
    // 生の span はスキル側では未知タグ扱いだが、念のため style 経路も検証
    const dmg = processTooltipHtml('<physicalDamage>100</physicalDamage>');
    expect(dmg).toContain('color:'); // 自前の安全なstyleは維持
    const evil = processTooltipHtml('<span style="background:url(javascript:alert(1))">x</span>');
    expect(evil).not.toMatch(/javascript:/i);
    expect(evil).not.toMatch(/background/i);
  });
});

describe('processItemDescription', () => {
  it('stats ブロックと attention を変換する', () => {
    const out = processItemDescription(
      '<mainText><stats>攻撃力 65</stats><attention>40%</attention>増加</mainText>',
    );
    expect(out).toContain('<div class="item-stats">攻撃力 65</div>');
    expect(out).toContain('<strong class="item-desc-num" style="color:#E8B34B">40%</strong>');
    expect(out).not.toContain('mainText');
  });

  it('3連以上の <br> は2つに畳む', () => {
    const out = processItemDescription('a<br><br><br><br>b');
    expect(out).toBe('a<br><br>b');
  });

  it('span に紛れ込んだ onclick / 危険な style を除去する', () => {
    const out = processItemDescription(
      '<mainText><span onclick="alert(1)" style="color:#fff">安全</span></mainText>',
    );
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain('安全');
    expect(out).toContain('color:#fff'); // 安全な color は保持
  });

  it('img/script などのタグは通さない', () => {
    const out = processItemDescription('<mainText><img src=x onerror=alert(1)>本文</mainText>');
    expect(out).not.toMatch(/<img/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain('本文');
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

  it('パッシブ名ラベルの中身はステータス語としてハイライトしない（ユン・タル・ワイルドアロー対策）', () => {
    // processItemDescriptionが<passive>を<strong class="text-muted-foreground">に変換した後の形
    const html = '<strong class="text-muted-foreground">熟練の末に脅威となる</strong>: 通常攻撃が真の脅威となる';
    const out = injectStatLinks(html);
    // ラベル内の「脅威」はハイライトされない
    expect(out).toContain('<strong class="text-muted-foreground">熟練の末に脅威となる</strong>');
    // ラベルの外（本文）の「脅威」は通常どおりハイライトされる
    expect(out).toContain('data-stat="custom:Lethality"');
  });
});

describe('toPlainText', () => {
  it('パッシブ/アクティブ名ラベルの中身を除去してからプレーンテキスト化する', () => {
    const html = '<passive>熟練の末に脅威となる</passive>: 攻撃力 65を得る';
    expect(toPlainText(html)).not.toContain('脅威');
    expect(toPlainText(html)).toContain('攻撃力 65を得る');
  });
});
