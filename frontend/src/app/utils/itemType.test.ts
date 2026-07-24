import { describe, it, expect } from 'vitest';
import { mapItemType } from './itemType';

describe('mapItemType', () => {
  it('デッドマンプレート（Armor+Health+NonbootsMovement）は防御', () => {
    expect(mapItemType(['Armor', 'Health', 'NonbootsMovement'])).toBe('Defense');
  });

  it('脅威アイテム（説明文のみ・tagsになし）はアサシン', () => {
    expect(mapItemType(['Damage', 'CooldownReduction', 'NonbootsMovement'], '脅威 18')).toBe('Assassin');
  });

  it('Lethality/Stealthタグはアサシン', () => {
    expect(mapItemType(['Lethality', 'Damage'])).toBe('Assassin');
    expect(mapItemType(['Stealth'])).toBe('Assassin');
  });

  it('クリティカルはマークスマン', () => {
    expect(mapItemType(['CriticalStrike', 'Damage'])).toBe('Marksman');
  });

  it('AS+APアイテム（ナッシャー・トゥース型）はメイジ', () => {
    expect(mapItemType(['SpellDamage', 'AttackSpeed'])).toBe('Magic');
  });

  it('AD+HPアイテム（ブラック・クリーバー型）はファイター', () => {
    expect(mapItemType(['Damage', 'Health', 'AbilityHaste'])).toBe('Fighter');
  });

  it('サポート系タグはサポート', () => {
    expect(mapItemType(['GoldPer', 'ManaRegen'])).toBe('Support');
  });
});
