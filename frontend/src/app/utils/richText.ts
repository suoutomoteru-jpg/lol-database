/**
 * DDragon 由来のリッチテキスト（スキルツールチップ・アイテム説明文）を
 * 表示用 HTML に変換する共通モジュール。
 *
 * タップ可能なステータス語の定義は utils/stats.ts の台帳から導出する。
 */

import { TOOLTIP_TAG_STAT, ITEM_KEYWORDS, SKILL_KEYWORDS } from './stats';

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

// [tag, color] — タップ可否（statキー）は台帳（TOOLTIP_TAG_STAT）から引く
const COLOR_MAP: [string, string][] = [
  ['scaleAD',            AD],
  ['scaleBonusAD',       AD],
  ['scaleAP',            AP],
  ['scaleHealth',        HP],
  ['scaleBonusHealth',   HP],
  ['scaleMaxHealth',     HP],
  ['scaleCurrentHealth', HP],
  ['scaleMana',          MANA],
  ['scaleBonusMana',     MANA],
  ['scaleArmor',         'var(--color-stat-armor)'],
  ['scaleBonusArmor',    'var(--color-stat-armor)'],
  ['scaleMR',            'var(--color-stat-mr)'],
  ['scaleBonusMR',       'var(--color-stat-mr)'],
  ['scaleAttackSpeed',   AD],
  ['scaleMovementSpeed', 'var(--color-stat-ms)'],
  ['scaleCritChance',    AD],
  ['scaleLevel',         AD],
  ['physicalDamage',     'var(--color-dmg-physical)'],
  ['magicDamage',        AP],
  ['trueDamage',         'var(--color-dmg-true)'],
  ['healing',            HP],
  ['shield',             HP],
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

  for (const [tag, color] of COLOR_MAP) {
    const statKey = TOOLTIP_TAG_STAT[tag.toLowerCase()];
    const open = statKey
      ? `<span style="color:${color};cursor:pointer" data-stat="${statKey}" role="button" tabindex="0">`
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

// ── ステータス語のリンク注入（台帳から導出）─────────────

function buildInjector(
  pairs: Array<{ text: string; key: string }>,
  className: string,
): (html: string) => string {
  const pattern = new RegExp(
    pairs.map(d => d.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'g',
  );
  const map = new Map(pairs.map(d => [d.text, d.key]));

  return (html: string) =>
    html.split(/(<[^>]+>)/).map(part => {
      if (part.startsWith('<')) return part;
      return part.replace(pattern, kw => {
        const key = map.get(kw);
        return key ? `<span data-stat="${key}" class="${className}" role="button" tabindex="0">${kw}</span>` : kw;
      });
    }).join('');
}

/** アイテム説明文のテキストノード内のステータス語をタップ可能にする */
export const injectStatLinks = buildInjector(ITEM_KEYWORDS, 'stat-keyword');

/** スキル説明文のテキストノード内のステータス語をタップ可能にする */
export const injectSkillStatLinks = buildInjector(SKILL_KEYWORDS, 'stat-link');
