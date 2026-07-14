/**
 * アイテムの金銭効率計算
 *
 * 各ステータス1単位あたりの基準ゴールド価値（最安の単体ステータス
 * アイテムから算出）に基づき、合計価値 ÷ 実売価格 を効率として返す。
 */

export const GOLD_PER_STAT: Record<string, number> = {
  FlatPhysicalDamageMod:         35,      // Long Sword: 350g / 10 AD
  FlatMagicDamageMod:            20,      // Amplifying Tome: 400g / 20 AP
  FlatArmorMod:                  20,      // Cloth Armor: 300g / 15 Armor
  FlatSpellBlockMod:             20,      // Null-Magic Mantle: 400g / 25 MR
  FlatHPPoolMod:                 2.67,    // Ruby Crystal: 400g / 150 HP
  FlatMPPoolMod:                 1,       // Sapphire Crystal baseline: 1g/mana
  FlatMovementSpeedMod:          12,      // 12g per 1 flat MS
  FlatCritChanceMod:             4000,    // 40g per 1% → ×100 for fraction (0-1)
  PercentAttackSpeedMod:         2500,    // 25g per 1% → ×100 for fraction
  PercentLifeStealMod:           5355,    // Vampiric Scepter: 53.55g per 1% → ×100
  PercentMovementSpeedMod:       5000,    // 2% = 100g → ×100 for fraction
  FlatArmorPenetrationMod:       30,      // Lethality: 30g per 1
  PercentArmorPenetrationMod:    4167,    // 41.67g per 1% → ×100
  FlatMagicPenetrationMod:       35,      // Sorcerer's Shoes: 700g / 18 → ~39g; ~35g/unit
  PercentMagicPenetrationMod:    4167,    // Void Staff: same baseline as armor pen → ×100
  FlatHPRegenMod:                3,       // Rejuvenation Bead baseline: 3g/unit
  FlatMPRegenMod:                5,       // 25% = 125g → 5g/unit (% 単位の場合)
  // DDragonがstat値を持つ場合のフォールバック（説明文解析も併用）
  AbilityHaste:                  50,      // Glowing Mote: 250g / 5 AH
  PercentHealAndShieldPower:     7760,    // Forbidden Idol: (800-24)g / 10% → ×100
  PercentCritDamageMod:          437.5,   // 40% = 175g → ×100 for fraction
};

// DDragonのstatフィールドに含まれない指標を説明文から抽出して算入する
const AH_RATE          = 50;    // Glowing Mote: 250g / 5 AH
const HS_RATE          = 7760;  // Forbidden Idol: (800-24)g / 10% → 7760g/fraction
const TENACITY_RATE    = 200;   // Mercury's: 1100 - 25*20 - 45*12 = 60g for 30% → 200g/fraction
const MANA_REGEN_RATE  = 5;     // 25% = 125g → 5g per 1%
const CRIT_DAMAGE_RATE = 4.375; // 40% = 175g → 4.375g per 1%

function extractNum(text: string, pattern: RegExp): number {
  const m = text.match(pattern);
  return m ? parseInt(m[1], 10) : 0;
}

export function calcGoldEfficiency(
  stats: Record<string, number>,
  tags: string[],
  rawDesc: string,
  totalCost: number,
): number | null {
  if (totalCost <= 0) return null;
  let totalValue = 0;

  for (const [key, val] of Object.entries(stats)) {
    const rate = GOLD_PER_STAT[key];
    if (rate && val) totalValue += val * rate;
  }

  const plain = rawDesc.replace(/<[^>]+>/g, '');

  // スキルヘイスト（stat未収録の場合、説明文から抽出）
  if (!stats['AbilityHaste']) {
    const ah = extractNum(plain, /スキルヘイスト\D{0,10}?(\d+)/);
    if (ah) totalValue += ah * AH_RATE;
  }

  // クリティカルダメージ（stat未収録の場合、説明文から抽出）
  if (!stats['PercentCritDamageMod']) {
    const cd = extractNum(plain, /クリティカルダメージ\D{0,10}?(\d+)/);
    if (cd) totalValue += cd * CRIT_DAMAGE_RATE;
  }

  // ヒール&シールドパワー（stat未収録の場合、説明文から抽出）
  if (!stats['PercentHealAndShieldPower']) {
    const hs = extractNum(plain, /ヒール[&＆]シールドパワー\D{0,10}?(\d+)/);
    if (hs) totalValue += (hs / 100) * HS_RATE;
  }

  // マナ自動回復（説明文から %を抽出; stat の FlatMPRegenMod が 0/未収録の場合のフォールバック）
  if (!stats['FlatMPRegenMod']) {
    const mr = extractNum(plain, /マナ自動回復\D{0,10}?(\d+)/);
    if (mr) totalValue += mr * MANA_REGEN_RATE;
  }

  // 行動妨害耐性（DDragonではタグのみでstat値なし → 説明文から%を抽出）
  if (tags.includes('Tenacity')) {
    const t = extractNum(plain, /行動妨害耐性\D{0,20}?(\d+)/);
    if (t) totalValue += (t / 100) * TENACITY_RATE;
  }

  return totalValue > 0 ? (totalValue / totalCost) * 100 : null;
}
