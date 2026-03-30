import type { ItemType } from '../data/mock-data';

/**
 * Data Dragon のアイテムタグ配列から UI カテゴリを導出する
 *
 * Data Dragon 主要タグ:
 *   SpellDamage, AbilityHaste  → Magic
 *   Armor, SpellBlock          → Defense（SpellBlock = MagicResist）
 *   Health, HealthRegen        → Defense
 *   CriticalStrike             → Marksman
 *   Lethality, NonbootsMovement, Stealth → Assassin
 *   GoldPer, Aura, ManaRegen   → Support
 *   Damage, OnHit, AttackSpeed → Fighter（デフォルト攻撃系）
 */
export function mapItemType(tags: string[]): ItemType {
  if (tags.some(t => ['SpellDamage', 'AbilityHaste'].includes(t))) return 'Magic';
  if (tags.some(t => ['Armor', 'SpellBlock'].includes(t))) return 'Defense';
  if (tags.some(t => ['Health', 'HealthRegen'].includes(t))) return 'Defense';
  if (tags.includes('CriticalStrike')) return 'Marksman';
  if (tags.some(t => ['Lethality', 'NonbootsMovement', 'Stealth'].includes(t))) return 'Assassin';
  if (tags.some(t => ['GoldPer', 'Aura', 'ManaRegen', 'Support'].includes(t))) return 'Support';
  return 'Fighter';
}
