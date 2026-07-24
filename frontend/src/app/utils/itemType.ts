import type { ItemType } from '../types/app';

/**
 * Data Dragon のアイテムタグ配列＋説明文から UI カテゴリを導出する
 *
 * 判定順が重要:
 * - 脅威（Lethality）はDDragonのtags/statsに現れないことが多いため、
 *   説明文の「脅威」で判定する（アサシンアイテムの取りこぼし防止）
 * - AbilityHaste はほぼ全カテゴリのアイテムに付くため判定に使わない
 * - 防御系タグは NonbootsMovement より先に見る
 *   （デッドマンプレート等の Armor+Health+NonbootsMovement はタンク系）
 * - 物理系タグ（Damage 等）は SpellDamage の後に見る
 *   （ナッシャー・トゥース等の AS+AP アイテムはメイジのまま）
 */
export function mapItemType(tags: string[], plainDesc = ''): ItemType {
  const has = (...t: string[]) => t.some(x => tags.includes(x));

  if (has('Lethality', 'Stealth') || /脅威/.test(plainDesc)) return 'Assassin';
  if (has('CriticalStrike')) return 'Marksman';
  if (has('SpellDamage')) return 'Magic';
  if (has('Damage', 'OnHit', 'AttackSpeed')) return 'Fighter';
  if (has('Armor', 'SpellBlock', 'Health', 'HealthRegen')) return 'Defense';
  if (has('GoldPer', 'Aura', 'ManaRegen', 'Support')) return 'Support';
  if (has('NonbootsMovement')) return 'Assassin';
  return 'Fighter';
}
