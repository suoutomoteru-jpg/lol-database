import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import { fetchWikiChampionSpells } from '../api/lolWiki';
import type { WikiSpellData } from '../api/lolWiki';
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
  /** Wiki から取得したランク毎の数値情報 */
  leveling?: Array<{ label: string; value: string }>;
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

// ════════════════════════════════════════════════════════
// Step 1: DDragon {{ }} テンプレート解決
// ════════════════════════════════════════════════════════
//
// DDragon tooltip のプレースホルダー:
//   {{ eN }}  → effectBurn[N]（"40/65/90/115/140" など）
//   {{ aN }}  → vars[N-1] の比率（"33%" など）
//   {{ fN }}  → effectBurn[N]（f は e の別名）
//   {{ abilityresourcename }} → partype（"マナ" など）

/**
 * effectBurn[N] の値を返す。null/空の場合は effect[N] から再構築する。
 */
function getEffectBurn(spell: DDragonSpell, n: number): string {
  const burn = (spell.effectBurn ?? [])[n];
  if (burn != null && burn !== '') return burn;

  const eff = (spell.effect ?? [])[n];
  if (Array.isArray(eff)) {
    const vals = eff[0] === 0 ? eff.slice(1) : eff;
    const nonZero = vals.filter((v): v is number => v != null && v !== 0);
    if (nonZero.length > 0) return nonZero.join('/');
  }
  return '';
}

/**
 * leveltip.effect から「変数名 → effectBurn インデックス」のマップを構築する。
 */
function buildLeveltipVarMap(spell: DDragonSpell): Map<string, number> {
  const map = new Map<string, number>();
  const effects = spell.leveltip?.effect ?? [];
  for (let i = 0; i < effects.length; i++) {
    const m = effects[i].match(/\{\{\s*(\w+)\s*\}\}/);
    if (m) {
      map.set(m[1].toLowerCase(), i + 1);
    }
  }
  return map;
}

function resolveDDragonTemplates(tooltip: string, spell: DDragonSpell, partype: string): string {
  const vars   = spell.vars ?? [];
  const varMap = buildLeveltipVarMap(spell);
  let s = tooltip;

  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);

  s = s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, raw) => {
    const name = raw.toLowerCase();

    const eM = name.match(/^e(\d+)$/);
    if (eM) return getEffectBurn(spell, parseInt(eM[1], 10));

    const fM = name.match(/^f(\d+)$/);
    if (fM) return getEffectBurn(spell, parseInt(fM[1], 10));

    const aM = name.match(/^a(\d+)$/);
    if (aM) {
      const v = vars[parseInt(aM[1], 10) - 1];
      if (!v) return '';
      const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
      return `${Math.round(coeff * 100)}%`;
    }

    if (varMap.has(name)) {
      return getEffectBurn(spell, varMap.get(name)!);
    }

    return _match;
  });

  return s;
}

// ════════════════════════════════════════════════════════
// Step 2: @var@ 形式のテンプレート解決
// ════════════════════════════════════════════════════════

function resolveAtVarTemplates(s: string, spell: DDragonSpell): string {
  const burns = spell.effectBurn ?? [];

  // @Effect{N}Amount@ → effectBurn[N]
  s = s.replace(/@Effect(\d+)Amount(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = burns[parseInt(n, 10)];
    if (val == null || val === '') return '';
    if (mult) {
      const m = parseFloat(mult);
      return val.split('/').map(v => String(Math.round(parseFloat(v) * m))).join('/');
    }
    return val;
  });

  // @CooldownBurn@ / @ResourceBurn@
  s = s.replace(/@CooldownBurn@/gi, spell.cooldownBurn ?? '');
  s = s.replace(/@ResourceBurn@/gi, spell.costBurn ?? '');

  // @f{N}@ → effectBurn[N]
  s = s.replace(/@f(\d+)(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = burns[parseInt(n, 10)];
    if (val == null || val === '') return '';
    if (mult) {
      const m = parseFloat(mult);
      return val.split('/').map(v => String(Math.round(parseFloat(v) * m))).join('/');
    }
    return val;
  });

  // 解決できなかった @var@ を除去
  s = s.replace(/@\w+(?:\*\d+(?:\.\d+)?)?@/g, '');

  return s;
}

// ════════════════════════════════════════════════════════
// Step 3: DDragon HTML タグ → styled HTML 変換
// ════════════════════════════════════════════════════════

const AD   = '#C89B3C';
const AP   = '#7EC8E3';
const HP   = '#1ECC1E';
const MANA = '#5383E8';

function processTooltipHtml(raw: string): string {
  let s = raw;

  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<\/li>/gi, '');
  s = s.replace(/<li>/gi, '<br>• ');
  s = s.replace(/<\/p>/gi, '<br>');
  s = s.replace(/<p(?:\s[^>]*)?>/gi, '');

  const boldTags = ['active', 'passive', 'keywordMajor', 'keyword',
                    'attention', 'rarityGeneric', 'status'];
  for (const tag of boldTags) {
    s = s.replace(new RegExp(`<${tag}>`, 'gi'), '<strong>');
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</strong>');
  }

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

  s = s.replace(/<[^>]+>/g, (match) => {
    const t = match.toLowerCase().trim();
    if (
      t === '<br>' || t === '<br/>' || t === '<br />' ||
      t === '<strong>' || t === '</strong>' ||
      t === '</span>' || t.startsWith('<span ')
    ) return match;
    return '';
  });

  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&apos;/g, "'");
  s = s.replace(/&quot;/g, '"');

  return s.replace(/^(<br>\s*)+/, '').trim();
}

function resolvePassiveDescription(desc: string, partype: string): string {
  let s = desc;
  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);
  s = s.replace(/\{\{[^}]*\}\}/g, '');
  s = s.replace(/@\w+(?:\*\d+(?:\.\d+)?)?@/g, '');
  return processTooltipHtml(s);
}

// ════════════════════════════════════════════════════════
// スキルデータ構築
// ════════════════════════════════════════════════════════

function buildSkill(
  key: 'Q' | 'W' | 'E' | 'R',
  spell: DDragonSpell,
  version: string,
  partype: string,
  wikiData: WikiSpellData | undefined,
): SkillData {
  const rangeNum = parseInt(spell.rangeBurn, 10);
  const hasRange = spell.rangeBurn !== 'self'
    && spell.rangeBurn !== '0'
    && !isNaN(rangeNum)
    && rangeNum <= 5000;

  // Step 1: DDragon {{ }} 解決
  let tooltip = resolveDDragonTemplates(spell.tooltip, spell, partype);
  // Step 2: @var@ 解決
  tooltip = resolveAtVarTemplates(tooltip, spell);
  // 未解決変数を除去
  tooltip = tooltip.replace(/\{\{[^}]*\}\}/g, '');

  const description = processTooltipHtml(tooltip);

  const rawCostType = spell.costType ?? '';
  const resolvedCostType = rawCostType
    .replace(/\{\{\s*abilityresourcename\s*\}\}/gi, partype)
    .replace(/@abilityresourcename@/gi, partype)
    .trim();

  return {
    key,
    name:         spell.name,
    description,
    cooldownBurn: spell.cooldownBurn || undefined,
    costBurn:     spell.costBurn !== '0' ? spell.costBurn : undefined,
    costType:     resolvedCostType !== 'No Cost' && resolvedCostType !== '' ? resolvedCostType : undefined,
    rangeBurn:    hasRange ? spell.rangeBurn : undefined,
    imageUrl:     spellImageUrl(version, spell.image.full),
    leveling:     wikiData?.leveling,
  };
}

// ════════════════════════════════════════════════════════
// useChampion フック
// ════════════════════════════════════════════════════════

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
        // 1. DDragon バージョン + チャンピオン詳細を取得（メインソース）
        const v   = await getLatestVersion();
        const raw = await fetchChampionDetail(v, championId!);
        if (cancelled) return;

        const [Q, W, E, R] = raw.spells;
        const partype = raw.partype;

        // 2. Wiki からスキル数値情報を並行取得（失敗してもフォールバック可能）
        const wikiSpells = await fetchWikiChampionSpells(
          raw.id,
          [
            { key: 'Q', name: Q.name, maxrank: Q.maxrank },
            { key: 'W', name: W.name, maxrank: W.maxrank },
            { key: 'E', name: E.name, maxrank: E.maxrank },
            { key: 'R', name: R.name, maxrank: R.maxrank },
          ],
        ).catch(() => null);
        if (cancelled) return;

        const skills: SkillData[] = [
          {
            key:         'P',
            name:        raw.passive.name,
            description: resolvePassiveDescription(raw.passive.description, partype),
            imageUrl:    passiveImageUrl(v, raw.passive.image.full),
          },
          buildSkill('Q', Q, v, partype, wikiSpells?.['Q']),
          buildSkill('W', W, v, partype, wikiSpells?.['W']),
          buildSkill('E', E, v, partype, wikiSpells?.['E']),
          buildSkill('R', R, v, partype, wikiSpells?.['R']),
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
