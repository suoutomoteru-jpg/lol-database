import type { ItemType } from '../types/app';

/**
 * DDragonの英語アイテム名 → サポートカテゴリの明示的な上書き。
 *
 * DDragonのtagsには実は「Support」に相当するタグが存在しない。
 * サポート専用完成アイテム（贖罪・アイアンソラリのロケット等）は
 * Health/Armor/SpellDamage 等の一般タグも同時に持つため、tagsベースの
 * 判定だけでは必ずDefense/Magicに先取りされてSupportに一切辿り着けない
 * （フィルタで「サポート」を選ぶと何も出ない不具合の原因）。
 * そのため既知のサポートアイテムは名前で確実にSupportへ固定する。
 *
 * 新シーズンでサポートアイテムの入れ替えがあった場合はここを更新すること。
 */
const SUPPORT_ITEM_NAMES = new Set([
  'Redemption',
  'Locket of the Iron Solari',
  "Shurelya's Battlesong",
  'Staff of Flowing Water',
  'Moonstone Renewer',
  'Echoes of Helia',
  "Zeke's Convergence",
  'Solstice Sleigh',
  'Celestial Opposition',
  'Dream Maker',
  'Vigilant Wardstone',
  'Imperial Mandate',
  'Chemtech Putrifier',
  "Zaz'Zak's Realmspike",
]);

/**
 * Data Dragon のアイテムタグ配列＋説明文から UI カテゴリを導出する
 *
 * 判定順が重要:
 * - サポート専用アイテムは他カテゴリのタグに先取りされるため、
 *   名前による明示判定を最優先で行う
 * - 脅威（Lethality）はDDragonのtags/statsに現れないことが多いため、
 *   説明文の「脅威」で判定する（アサシンアイテムの取りこぼし防止）
 * - AbilityHaste はほぼ全カテゴリのアイテムに付くため判定に使わない
 * - 防御系タグは NonbootsMovement より先に見る
 *   （デッドマンプレート等の Armor+Health+NonbootsMovement はタンク系）
 * - 物理系タグ（Damage 等）は SpellDamage の後に見る
 *   （ナッシャー・トゥース等の AS+AP アイテムはメイジのまま）
 */
export function mapItemType(tags: string[], plainDesc = '', englishName?: string): ItemType {
  if (englishName && SUPPORT_ITEM_NAMES.has(englishName)) return 'Support';

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
