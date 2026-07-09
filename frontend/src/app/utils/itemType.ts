import type { ItemType } from '../types/app';

/**
 * Data Dragon のアイテムタグ配列から UI カテゴリを導出する
 *
 * 判定順が重要:
 * - AbilityHaste はほぼ全カテゴリのアイテムに付くため判定に使わない
 *   （かつて AbilityHaste → Magic としていたため、ブラッククリーバー等の
 *   ADアイテムがメイジに分類されていた）
 * - 物理系タグ（Damage 等）は SpellDamage の後に見る
 *   （ナッシャー・トゥース等の AS+AP アイテムはメイジのまま）
 * - NonbootsMovement は Magic より後（リッチベイン対策）
 */
export function mapItemType(tags: string[]): ItemType {
  const has = (...t: string[]) => t.some(x => tags.includes(x));

  if (has('CriticalStrike')) return 'Marksman';
  if (has('Lethality', 'Stealth')) return 'Assassin';
  if (has('SpellDamage')) return 'Magic';
  if (has('Damage', 'OnHit', 'AttackSpeed')) return 'Fighter';
  if (has('NonbootsMovement')) return 'Assassin';
  if (has('Armor', 'SpellBlock', 'Health', 'HealthRegen')) return 'Defense';
  if (has('GoldPer', 'Aura', 'ManaRegen', 'Support')) return 'Support';
  return 'Fighter';
}
