import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';

export interface SkillData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  /** HTML string。dangerouslySetInnerHTML で描画すること */
  description: string;
  cooldownBurn?: string;
  costBurn?: string;
  costType?: string;
  rangeBurn?: string;
  imageUrl: string;
}

export interface ChampionDetailData {
  id: string;
  name: string;
  title: string;
  role: string;
  lore: string;
  partype: string;
  tags: string[];
  stats: DDragonChampionDetail['stats'];
  skills: SkillData[];
  version: string;
}

interface UseChampionResult {
  champion: ChampionDetailData | null;
  loading: boolean;
  error: Error | null;
}

// ── HTML 変換 ──────────────────────────────────────────
//
// Data Dragon の tooltip には以下のような独自 HTML タグが含まれる:
//   <active>Active:</active>   → 太字ラベル
//   <scaleAD>(+70%AD)</scaleAD> → 金色（ADスケーリング）
//   <scaleAP>(+35%AP)</scaleAP> → 水色（APスケーリング）
//   <physicalDamage>200</physicalDamage> → 物理ダメージ色
//   <magicDamage>100</magicDamage>       → 魔法ダメージ色
//   <br>                                 → 改行
// これらをゲーム内に近い色付き HTML に変換する。

// LoL クライアントの配色に合わせた色定数
const AD   = '#C89B3C';  // 金色 — AD / 物理ダメージ
const AP   = '#7EC8E3';  // 水色 — AP / 魔法ダメージ
const HP   = '#1ECC1E';  // 緑  — HP スケーリング / 回復
const MANA = '#5383E8';  // 青  — マナスケーリング

/** DDragon 固有タグを標準 HTML (span/strong/br) に変換する */
function processTooltipHtml(raw: string): string {
  let s = raw;

  // ── 改行 ───────────────────────────────────────────
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<\/li>/gi, '');
  s = s.replace(/<li>/gi, '<br>• ');
  s = s.replace(/<\/p>/gi, '<br>');
  s = s.replace(/<p(?:\s[^>]*)?>/gi, '');

  // ── 太字ラベル ─────────────────────────────────────
  const boldTags = ['active', 'passive', 'keywordMajor', 'keyword',
                    'attention', 'rarityGeneric', 'status'];
  for (const tag of boldTags) {
    s = s.replace(new RegExp(`<${tag}>`, 'gi'), '<strong>');
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</strong>');
  }

  // ── スケーリング / ダメージタイプ → 色付き span ──────
  const colorMap: [string, string][] = [
    ['scaleAD',        AD],
    ['scaleBonusAD',   AD],
    ['scaleAP',        AP],
    ['scaleHealth',    HP],
    ['scaleMana',      MANA],
    ['scaleLevel',     AD],
    ['physicalDamage', '#FF8C00'],
    ['magicDamage',    AP],
    ['trueDamage',     '#F0E6D2'],
    ['healing',        HP],
    ['shield',         '#B8C3CC'],
    ['speed',          '#F9E4B7'],
  ];

  for (const [tag, color] of colorMap) {
    s = s.replace(new RegExp(`<${tag}>`, 'gi'), `<span style="color:${color}">`);
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</span>');
  }

  // ── 残りの不明タグを除去（br / strong / span だけ残す） ──
  s = s.replace(/<[^>]+>/g, (match) => {
    const t = match.toLowerCase().trim();
    if (
      t === '<br>' || t === '<br/>' || t === '<br />' ||
      t === '<strong>' || t === '</strong>' ||
      t === '</span>' || t.startsWith('<span ')
    ) return match;
    return '';
  });

  // ── HTML エンティティデコード ──────────────────────
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&apos;/g, "'");
  s = s.replace(/&quot;/g, '"');

  // 先頭の余分な改行を除去
  return s.replace(/^(<br>\s*)+/, '').trim();
}

// ── テンプレート変数解決 ───────────────────────────────
//
// DDragon tooltip のプレースホルダー:
//   {{ eN }}  → effectBurn[N]（"40/65/90/115/140" など）
//   {{ aN }}  → vars[N-1] の比率（"33%" など）
//   {{ fN }}  → effectBurn[N]（fは e の別名）
//   {{ abilityresourcename }} → partype（"マナ" など）

function resolveTooltip(tooltip: string, spell: DDragonSpell, partype: string): string {
  const burns = spell.effectBurn ?? [];
  const vars  = spell.vars      ?? [];

  let s = tooltip;

  // {{ eN }} → effectBurn[N]
  s = s.replace(/\{\{\s*e(\d+)\s*\}\}/g, (_, n) => burns[parseInt(n, 10)] ?? '');

  // {{ aN }} → vars[N-1] をパーセント表記
  s = s.replace(/\{\{\s*a(\d+)\s*\}\}/g, (_, n) => {
    const v = vars[parseInt(n, 10) - 1];
    if (!v) return '';
    const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
    return `${Math.round(coeff * 100)}%`;
  });

  // {{ fN }} → effectBurn[N]（フォールバック）
  s = s.replace(/\{\{\s*f(\d+)\s*\}\}/g, (_, n) => burns[parseInt(n, 10)] ?? '');

  // {{ abilityresourcename }} → partype
  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);

  // 残ったプレースホルダーを除去
  s = s.replace(/\{\{[^}]*\}\}/g, '');

  return processTooltipHtml(s);
}

/** passive は tooltip を持たないため description を使用 */
function resolveDescription(desc: string, partype: string): string {
  let s = desc;
  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);
  s = s.replace(/\{\{[^}]*\}\}/g, '');
  return processTooltipHtml(s);
}

// ── スキルデータ構築 ──────────────────────────────────

function buildSkill(key: 'Q' | 'W' | 'E' | 'R', spell: DDragonSpell, version: string, partype: string): SkillData {
  const rangeNum = parseInt(spell.rangeBurn, 10);
  const hasRange = spell.rangeBurn !== 'self'
    && spell.rangeBurn !== '0'
    && !isNaN(rangeNum)
    && rangeNum <= 5000;

  return {
    key,
    name:         spell.name,
    description:  resolveTooltip(spell.tooltip, spell, partype),
    cooldownBurn: spell.cooldownBurn || undefined,
    costBurn:     spell.costBurn !== '0' ? spell.costBurn : undefined,
    costType:     spell.costType !== 'No Cost' ? spell.costType : undefined,
    rangeBurn:    hasRange ? spell.rangeBurn : undefined,
    imageUrl:     spellImageUrl(version, spell.image.full),
  };
}

// ── フック ────────────────────────────────────────────

export function useChampion(championId: string | undefined): UseChampionResult {
  const [champion, setChampion] = useState<ChampionDetailData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<Error | null>(null);

  useEffect(() => {
    if (!championId) return;
    let cancelled = false;

    setChampion(null);
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const v   = await getLatestVersion();
        const raw = await fetchChampionDetail(v, championId!);
        if (cancelled) return;

        const [Q, W, E, R] = raw.spells;
        const partype = raw.partype;

        const skills: SkillData[] = [
          {
            key:         'P',
            name:        raw.passive.name,
            description: resolveDescription(raw.passive.description, partype),
            imageUrl:    passiveImageUrl(v, raw.passive.image.full),
          },
          buildSkill('Q', Q, v, partype),
          buildSkill('W', W, v, partype),
          buildSkill('E', E, v, partype),
          buildSkill('R', R, v, partype),
        ];

        setChampion({
          id:      raw.id,
          name:    raw.name,
          title:   raw.title,
          role:    raw.tags[0] ?? 'Fighter',
          lore:    raw.lore,
          partype,
          tags:    raw.tags,
          stats:   raw.stats,
          skills,
          version: v,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [championId]);

  return { champion, loading, error };
}
