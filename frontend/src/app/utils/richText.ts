/**
 * DDragon 由来のリッチテキスト（スキルツールチップ・アイテム説明文）を
 * 表示用 HTML に変換する共通モジュール。
 *
 * これまで useChampion（スキル）と ItemDetail（アイテム）が
 * ほぼ同じタグ変換表を別々に持っていたものを統合した。
 */

// ── 共通ヘルパー ──────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

/** 許可リスト以外のタグを落とす */
function stripUnknownTags(s: string, isAllowed: (tag: string) => boolean): string {
  return s.replace(/<[^>]+>/g, match => (isAllowed(match.toLowerCase().trim()) ? match : ''));
}

// ── スキルツールチップ ────────────────────────────────

const AD   = 'var(--color-stat-ad)';
const AP   = 'var(--color-stat-ap)';
const HP   = 'var(--color-stat-hp)';
const MANA = 'var(--color-stat-mana)';

const BOLD_TAGS = ['active', 'passive', 'keywordMajor', 'keyword',
                   'attention', 'rarityGeneric', 'rarityLegendary', 'rarityMythic', 'status'];

// [tag, color, statKey?] — statKey があるとタップでアイテム一覧が開く
const COLOR_MAP: [string, string, string?][] = [
  ['scaleAD',            AD,       'stat:FlatPhysicalDamageMod'],
  ['scaleBonusAD',       AD,       'stat:FlatPhysicalDamageMod'],
  ['scaleAP',            AP,       'stat:FlatMagicDamageMod'],
  ['scaleHealth',        HP,       'stat:FlatHPPoolMod'],
  ['scaleBonusHealth',   HP,       'stat:FlatHPPoolMod'],
  ['scaleMaxHealth',     HP,       'stat:FlatHPPoolMod'],
  ['scaleCurrentHealth', HP],
  ['scaleMana',          MANA,     'stat:FlatMPPoolMod'],
  ['scaleBonusMana',     MANA,     'stat:FlatMPPoolMod'],
  ['scaleArmor',         'var(--color-stat-armor)', 'stat:FlatArmorMod'],
  ['scaleBonusArmor',    'var(--color-stat-armor)', 'stat:FlatArmorMod'],
  ['scaleMR',            'var(--color-stat-mr)',    'stat:FlatSpellBlockMod'],
  ['scaleBonusMR',       'var(--color-stat-mr)',    'stat:FlatSpellBlockMod'],
  ['scaleAttackSpeed',   AD,       'stat:PercentAttackSpeedMod'],
  ['scaleMovementSpeed', 'var(--color-stat-ms)',    'stat:FlatMovementSpeedMod'],
  ['scaleCritChance',    AD,       'stat:FlatCritChanceMod'],
  ['scaleLevel',         AD],
  ['physicalDamage',     'var(--color-dmg-physical)'],
  ['magicDamage',        AP],
  ['trueDamage',         'var(--color-dmg-true)'],
  ['healing',            HP],
  ['shield',             HP,       'custom:HealAndShieldPower'],
  ['speed',              'var(--color-stat-ms)'],
  ['unimportant',        '#888888'],
];

/**
 * チャンピオンスキルのツールチップ HTML を整形する。
 * DDragon 独自タグ（physicalDamage 等）を色付き span に変換し、
 * 未知のタグを除去する。
 */
export function processTooltipHtml(raw: string): string {
  let s = raw;

  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<\/li>/gi, '');
  s = s.replace(/<li>/gi, '<br>• ');
  s = s.replace(/<\/p>/gi, '<br>');
  s = s.replace(/<p(?:\s[^>]*)?>/gi, '');

  for (const tag of BOLD_TAGS) {
    s = s.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi'), '<strong>');
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</strong>');
  }

  for (const [tag, color, statKey] of COLOR_MAP) {
    const open = statKey
      ? `<span style="color:${color};cursor:pointer" data-stat="${statKey}">`
      : `<span style="color:${color}">`;
    s = s.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi'), open);
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</span>');
  }

  s = stripUnknownTags(s, t =>
    t === '<br>' || t === '<br/>' || t === '<br />' ||
    t === '<strong>' || t === '</strong>' ||
    t === '<span>' || t === '</span>' || t.startsWith('<span '),
  );

  s = decodeEntities(s);
  return s.replace(/^(<br>\s*)+/, '').trim();
}

// ── アイテム説明文 ────────────────────────────────────

/** アイテム説明文の DDragon タグを表示用 HTML に変換する */
export function processItemDescription(raw: string): string {
  let s = raw;
  s = s.replace(/<mainText>/gi, '').replace(/<\/mainText>/gi, '');
  s = s.replace(/<stats>/gi, '<div class="item-stats">').replace(/<\/stats>/gi, '</div>');
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<attention>/gi, '<strong style="color:#C89B3C">').replace(/<\/attention>/gi, '</strong>');
  s = s.replace(/<passive>/gi, '<strong class="text-muted-foreground">').replace(/<\/passive>/gi, '</strong>');
  s = s.replace(/<active>/gi, '<strong class="text-muted-foreground">').replace(/<\/active>/gi, '</strong>');
  s = s.replace(/<ornnBonus>/gi, '<span class="text-primary/70">').replace(/<\/ornnBonus>/gi, '</span>');
  s = s.replace(/<gold>/gi, '<span style="color:#C89B3C">').replace(/<\/gold>/gi, '</span>');
  s = s.replace(/<keyword>/gi, '<strong>').replace(/<\/keyword>/gi, '</strong>');
  s = s.replace(/<keywordMajor>/gi, '<strong>').replace(/<\/keywordMajor>/gi, '</strong>');
  s = s.replace(/<rarityLegendary>/gi, '<strong style="color:#C89B3C">').replace(/<\/rarityLegendary>/gi, '</strong>');
  s = s.replace(/<rarityMythic>/gi,    '<strong style="color:#5383E8">').replace(/<\/rarityMythic>/gi,    '</strong>');
  s = s.replace(/<rarityGeneric>/gi,   '<strong>').replace(/<\/rarityGeneric>/gi,   '</strong>');
  s = s.replace(/<unimportant>/gi, '<span style="opacity:0.55">').replace(/<\/unimportant>/gi, '</span>');
  s = s.replace(/<rules>/gi, '<em style="opacity:0.7">').replace(/<\/rules>/gi, '</em>');
  s = s.replace(/<flavorText>/gi, '<em style="opacity:0.7">').replace(/<\/flavorText>/gi, '</em>');
  s = s.replace(/<li>/gi, '<br>• ').replace(/<\/li>/gi, '');

  s = stripUnknownTags(s, t =>
    t === '<br>' ||
    t === '<strong>' || t === '</strong>' ||
    t === '<em>' || t === '</em>' ||
    t === '</span>' || t.startsWith('<span ') ||
    t.startsWith('<strong ') ||
    t === '</div>' || t === '<div class="item-stats">',
  );

  s = decodeEntities(s);
  s = s.replace(/^(<br>\s*)+/, '').trim();
  s = s.replace(/(<br>\s*){3,}/g, '<br><br>');
  return s;
}

// ── 日本語キーワード → stat/tag キーのリンク注入 ────────
// 長いものを先に並べる（部分マッチ防止）

const KEYWORD_DEFS: Array<{ text: string; key: string }> = [
  { text: 'ライフスティール',   key: 'custom:LifeSteal' },
  { text: '通常攻撃時効果',     key: 'custom:OnHit' },
  { text: '行動妨害耐性',       key: 'custom:Tenacity' },
  { text: 'スキルヘイスト',     key: 'custom:AbilityHaste' },
  { text: '魔法防御貫通',       key: 'custom:MagicPen' },
  { text: '物理防御貫通',       key: 'custom:ArmorPen' },
  { text: 'クリティカルダメージ', key: 'custom:CritDamage' },
  { text: 'クリティカル率',     key: 'stat:FlatCritChanceMod' },
  { text: 'シールド量',         key: 'custom:Shield' },
  { text: 'ヒール&シールドパワー', key: 'custom:HealAndShieldPower' },
  { text: 'ヒール＆シールドパワー', key: 'custom:HealAndShieldPower' },
  { text: '脅威',               key: 'custom:Lethality' },
  { text: '体力回復速度',       key: 'stat:FlatHPRegenMod' },
  { text: '体力回復',           key: 'stat:FlatHPRegenMod' },
  { text: 'マナ回復速度',       key: 'stat:FlatMPRegenMod' },
  { text: 'マナ回復',           key: 'stat:FlatMPRegenMod' },
  { text: '魔法防御',           key: 'stat:FlatSpellBlockMod' },
  { text: '物理防御',           key: 'stat:FlatArmorMod' },
  { text: '移動速度',           key: 'stat:FlatMovementSpeedMod' },
  { text: '攻撃速度',           key: 'stat:PercentAttackSpeedMod' },
  { text: '攻撃力',             key: 'stat:FlatPhysicalDamageMod' },
  { text: '魔力',               key: 'stat:FlatMagicDamageMod' },
  { text: 'アーマー',           key: 'stat:FlatArmorMod' },
  { text: '体力',               key: 'stat:FlatHPPoolMod' },
  { text: 'マナ',               key: 'stat:FlatMPPoolMod' },
];

const KW_PATTERN = new RegExp(
  KEYWORD_DEFS.map(d => d.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);
const KW_MAP = new Map(KEYWORD_DEFS.map(d => [d.text, d.key]));

/** HTML のテキストノード内のステータス語をクリッカブルな span に置き換える */
export function injectStatLinks(html: string): string {
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) return part;
    return part.replace(KW_PATTERN, kw => {
      const key = KW_MAP.get(kw);
      return key ? `<span data-stat="${key}" class="stat-keyword">${kw}</span>` : kw;
    });
  }).join('');
}
