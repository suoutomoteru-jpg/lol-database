/**
 * LoL ステータス台帳（アプリの単一ソース・オブ・トゥルース）
 *
 * アプリのコンセプト:
 *   スキルやアイテムに「ステータスでスケールする値」が出てきたとき、
 *   どのアイテムを積めばそのステータスが得られるかへ最短で辿り着けること。
 *
 * この台帳から以下すべてを導出する:
 *   - アイテムがそのステータスを持つかの判定（stats欄 / tags / 説明文）
 *   - アイテム説明文内でタップ可能にする語（itemKeywords）
 *   - スキル説明文内でタップ可能にする語（skillKeywords）
 *   - DDragon ツールチップタグ（<physicalDamage> 等）との対応（tooltipTags）
 *
 * タップ不可（アイテムで積めない）スケール源は台帳に含めない:
 *   レベル・チャンピオン固有スタック・現在/減少体力・対象の最大体力 など
 */

export interface StatDef {
  /** アプリ内で使う一意キー（BottomSheet の逆引きキー） */
  key: string;
  /** 表示ラベル */
  labelJa: string;
  /** DDragon item.stats のフィールド名（いずれかが非0なら該当） */
  itemStatKeys?: string[];
  /** DDragon item.tags（いずれかを含めば該当） */
  itemTags?: string[];
  /** アイテム説明文（タグ除去後）に対する検出パターン */
  itemDescPattern?: RegExp;
  /** アイテム説明文内でリンク化する語 */
  itemKeywords?: string[];
  /** スキル説明文内でリンク化する語 */
  skillKeywords?: string[];
  /** DDragon ツールチップタグ → このステータスに紐付け */
  tooltipTags?: string[];
}

export const STAT_DEFS: StatDef[] = [
  // ── 攻撃系 ──────────────────────────────────────────
  {
    key: 'stat:FlatPhysicalDamageMod', labelJa: '攻撃力',
    itemStatKeys: ['FlatPhysicalDamageMod'],
    itemKeywords: ['攻撃力'],
    skillKeywords: ['合計攻撃力', '増加攻撃力', '基礎攻撃力', '攻撃力'],
    tooltipTags: ['scaleAD', 'scaleBonusAD', 'physicalDamage'],
  },
  {
    key: 'stat:FlatMagicDamageMod', labelJa: '魔力',
    itemStatKeys: ['FlatMagicDamageMod'],
    itemKeywords: ['魔力'],
    skillKeywords: ['魔力'],
    tooltipTags: ['scaleAP', 'magicDamage'],
  },
  {
    key: 'stat:PercentAttackSpeedMod', labelJa: '攻撃速度',
    itemStatKeys: ['PercentAttackSpeedMod'],
    itemKeywords: ['攻撃速度'],
    skillKeywords: ['攻撃速度'],
    tooltipTags: ['scaleAttackSpeed'],
  },
  {
    key: 'stat:FlatCritChanceMod', labelJa: 'クリティカル率',
    itemStatKeys: ['FlatCritChanceMod'],
    itemKeywords: ['クリティカル率'],
    skillKeywords: ['クリティカル率'],
    tooltipTags: ['scaleCritChance'],
  },
  {
    key: 'custom:CritDamage', labelJa: 'クリティカルダメージ',
    itemStatKeys: ['PercentCritDamageMod'],
    itemDescPattern: /クリティカルダメージ/,
    itemKeywords: ['クリティカルダメージ'],
    skillKeywords: ['クリティカルダメージ'],
  },
  {
    key: 'custom:Lethality', labelJa: '脅威',
    itemStatKeys: ['FlatArmorPenetrationMod'],
    itemDescPattern: /脅威/,
    itemKeywords: ['脅威'],
    skillKeywords: ['脅威'],
  },
  {
    key: 'custom:ArmorPen', labelJa: '物理防御貫通',
    itemStatKeys: ['PercentArmorPenetrationMod'],
    itemDescPattern: /物理防御貫通/,
    itemKeywords: ['物理防御貫通'],
    skillKeywords: ['物理防御貫通'],
  },
  {
    key: 'custom:MagicPen', labelJa: '魔法防御貫通',
    itemStatKeys: ['FlatMagicPenetrationMod', 'PercentMagicPenetrationMod'],
    itemDescPattern: /魔法防御貫通/,
    itemKeywords: ['魔法防御貫通'],
    skillKeywords: ['魔法防御貫通'],
  },
  {
    key: 'custom:LifeSteal', labelJa: 'ライフスティール',
    itemStatKeys: ['PercentLifeStealMod'],
    itemDescPattern: /ライフスティール/,
    itemKeywords: ['ライフスティール'],
    skillKeywords: ['ライフスティール'],
  },
  {
    key: 'custom:Omnivamp', labelJa: 'オムニヴァンプ',
    itemDescPattern: /オムニヴァンプ/,
    itemKeywords: ['オムニヴァンプ'],
    skillKeywords: ['オムニヴァンプ'],
  },
  {
    key: 'custom:OnHit', labelJa: '通常攻撃時効果',
    itemTags: ['OnHit'],
    itemDescPattern: /通常攻撃時効果/,
    itemKeywords: ['通常攻撃時効果'],
    skillKeywords: ['通常攻撃時効果'],
  },

  // ── 防御系 ──────────────────────────────────────────
  {
    key: 'stat:FlatHPPoolMod', labelJa: '体力',
    itemStatKeys: ['FlatHPPoolMod'],
    itemKeywords: ['体力'],
    skillKeywords: ['増加体力', '最大体力'],
    tooltipTags: ['scaleHealth', 'scaleBonusHealth', 'scaleMaxHealth'],
  },
  {
    key: 'stat:FlatArmorMod', labelJa: '物理防御',
    itemStatKeys: ['FlatArmorMod'],
    itemKeywords: ['物理防御', 'アーマー'],
    skillKeywords: ['物理防御'],
    tooltipTags: ['scaleArmor', 'scaleBonusArmor'],
  },
  {
    key: 'stat:FlatSpellBlockMod', labelJa: '魔法防御',
    itemStatKeys: ['FlatSpellBlockMod'],
    itemKeywords: ['魔法防御'],
    skillKeywords: ['魔法防御'],
    tooltipTags: ['scaleMR', 'scaleBonusMR'],
  },
  {
    // 見落とされがち: stat欄が0でも「基礎体力自動回復◯%」を説明文に持つアイテムが多い
    key: 'stat:FlatHPRegenMod', labelJa: '体力自動回復',
    itemStatKeys: ['FlatHPRegenMod'],
    itemDescPattern: /体力自動回復/,
    itemKeywords: ['体力回復速度', '体力自動回復', '体力回復'],
    skillKeywords: ['体力自動回復'],
  },
  {
    key: 'custom:Tenacity', labelJa: '行動妨害耐性',
    itemTags: ['Tenacity'],
    itemDescPattern: /行動妨害耐性/,
    itemKeywords: ['行動妨害耐性'],
    skillKeywords: ['行動妨害耐性'],
  },

  // ── リソース系 ──────────────────────────────────────
  {
    key: 'stat:FlatMPPoolMod', labelJa: 'マナ',
    itemStatKeys: ['FlatMPPoolMod'],
    itemKeywords: ['マナ'],
    skillKeywords: ['最大マナ', '増加マナ'],
    tooltipTags: ['scaleMana', 'scaleBonusMana'],
  },
  {
    // 見落とされがち: マナ自動回復も stat欄0 + 説明文「基礎マナ自動回復◯%」が主流
    key: 'stat:FlatMPRegenMod', labelJa: 'マナ自動回復',
    itemStatKeys: ['FlatMPRegenMod'],
    itemDescPattern: /マナ自動回復/,
    itemKeywords: ['マナ回復速度', 'マナ自動回復', 'マナ回復'],
    skillKeywords: ['マナ自動回復'],
  },
  {
    key: 'custom:AbilityHaste', labelJa: 'スキルヘイスト',
    itemStatKeys: ['AbilityHaste'],
    itemTags: ['AbilityHaste', 'CooldownReduction'],
    itemDescPattern: /スキルヘイスト/,
    itemKeywords: ['スキルヘイスト'],
    skillKeywords: ['スキルヘイスト'],
  },

  // ── ユーティリティ系 ────────────────────────────────
  {
    key: 'stat:FlatMovementSpeedMod', labelJa: '移動速度',
    itemStatKeys: ['FlatMovementSpeedMod', 'PercentMovementSpeedMod'],
    itemKeywords: ['移動速度'],
    skillKeywords: ['移動速度'],
    tooltipTags: ['scaleMovementSpeed', 'speed'],
  },
  {
    // 見落とされがち: 回復・シールドの効果量スケール
    key: 'custom:HealAndShieldPower', labelJa: 'ヒール＆シールドパワー',
    itemStatKeys: ['PercentHealAndShieldPower'],
    itemDescPattern: /ヒール[&＆]シールドパワー/,
    itemKeywords: ['ヒール&シールドパワー', 'ヒール＆シールドパワー', 'シールド量'],
    skillKeywords: ['ヒール＆シールドパワー'],
    tooltipTags: ['shield', 'healing'],
  },
  {
    key: 'custom:Shield', labelJa: 'シールド',
    itemDescPattern: /シールド/,
  },
  {
    key: 'tag:GoldPer', labelJa: 'ゴールド獲得',
    itemTags: ['GoldPer'],
    itemKeywords: ['ゴールド獲得'],
  },
];

// ── 導出テーブル ──────────────────────────────────────

/** key → 表示ラベル */
export const STAT_KEY_LABELS: Record<string, string> = Object.fromEntries(
  STAT_DEFS.map(d => [d.key, d.labelJa]),
);

/** ツールチップタグ名（小文字） → statキー */
export const TOOLTIP_TAG_STAT: Record<string, string> = Object.fromEntries(
  STAT_DEFS.flatMap(d => (d.tooltipTags ?? []).map(t => [t.toLowerCase(), d.key])),
);

function buildKeywordTable(pick: (d: StatDef) => string[] | undefined) {
  // 長い語を優先（部分マッチ防止）
  const pairs = STAT_DEFS.flatMap(d => (pick(d) ?? []).map(text => ({ text, key: d.key })));
  pairs.sort((a, b) => b.text.length - a.text.length);
  return pairs;
}

/** アイテム説明文用のリンク語（長い順） */
export const ITEM_KEYWORDS = buildKeywordTable(d => d.itemKeywords);
/** スキル説明文用のリンク語（長い順） */
export const SKILL_KEYWORDS = buildKeywordTable(d => d.skillKeywords);

/** アイテムがこのステータスを持つか判定する */
export function itemHasStat(
  def: StatDef,
  stats: Record<string, number>,
  tags: string[],
  plainDesc: string,
): boolean {
  if (def.itemStatKeys?.some(k => stats[k])) return true;
  if (def.itemTags?.some(t => tags.includes(t))) return true;
  if (def.itemDescPattern?.test(plainDesc)) return true;
  return false;
}
