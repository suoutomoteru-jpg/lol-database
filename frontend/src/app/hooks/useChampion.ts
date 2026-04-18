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

/**
 * leveltip のラベルと Wiki leveling データを照合し、
 * DDragon 変数名 → Wiki 値のマップを構築する。
 *
 * 仕組み:
 *   leveltip.effect[i] = "{{ totaldamage }}"  ← DDragon 変数名
 *   leveltip.label[i]  = "Physical Damage"    ← 人間可読ラベル
 *   wiki.leveling[j]   = { label: "Physical Damage", value: "60/95/130/165/200 (+ 100% bonus AD)" }
 *   → map.set("totaldamage", "60/95/130/165/200 (+ 100% bonus AD)")
 *
 * ラベルの照合は case-insensitive で、部分一致も許容する。
 */
function buildWikiVarMap(
  spell: DDragonSpell,
  wikiData: WikiSpellData | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!wikiData?.leveling?.length) return map;

  const labels  = spell.leveltip?.label  ?? [];
  const effects = spell.leveltip?.effect ?? [];

  // ── アプローチ1: tooltip の HTML タグから変数名を推論 ─────────────
  //
  // DDragon leveltip ラベルは日本語（"ダメージ"）になっており wiki の英語ラベルと
  // 一致しない。またスペル名によって変数名が異なる（totaldamage / rmaindamage 等）。
  // そこで tooltip 内の <physicalDamage>{{ totaldamage }}</physicalDamage> のような
  // HTML タグを手がかりに「この変数はこのダメージ種別」と推論する。
  const TAG_KEYWORDS: [string, string[]][] = [
    ['physicaldamage', ['physical damage', 'physical', 'damage']],
    ['magicdamage',    ['magic damage', 'magic', 'damage']],
    ['truedamage',     ['true damage', 'damage']],
    ['healing',        ['heal', 'restore', 'health']],
    ['shield',         ['shield']],
    ['attackspeed',    ['attack speed', 'bonus attack speed']],
    ['speed',          ['movement speed', 'move speed']],
  ];

  for (const [tagName, keywords] of TAG_KEYWORDS) {
    const tagRe = new RegExp(`<${tagName}>[^<]*\\{\\{\\s*(\\w+)\\s*\\}\\}`, 'gi');
    let tm: RegExpExecArray | null;
    while ((tm = tagRe.exec(spell.tooltip)) !== null) {
      const varname = tm[1].toLowerCase();
      if (map.has(varname)) continue;

      for (const kw of keywords) {
        const stat = wikiData.leveling.find(s => s.label.toLowerCase().includes(kw));
        if (stat) { map.set(varname, stat.value); break; }
      }
    }
  }

  // ── アプローチ2: leveltip ラベル経由（英語 DDragon の場合のみ有効） ─
  for (let i = 0; i < effects.length; i++) {
    const m = effects[i].match(/\{\{\s*(\w+)\s*\}\}/)
           ?? effects[i].match(/@(\w+)(?:\*[\d.]+)?@/);
    if (!m || !labels[i]) continue;

    const varname    = m[1].toLowerCase();
    if (map.has(varname)) continue;

    const ddLabelLow = labels[i].toLowerCase();
    const stat = wikiData.leveling.find(s => {
      const wLow = s.label.toLowerCase();
      return wLow === ddLabelLow || ddLabelLow.includes(wLow) || wLow.includes(ddLabelLow);
    });
    if (stat) map.set(varname, stat.value);
  }

  return map;
}

function resolveDDragonTemplates(
  tooltip: string,
  spell: DDragonSpell,
  partype: string,
  wikiVarMap: Map<string, string>,
): string {
  const vars   = spell.vars ?? [];
  const varMap = buildLeveltipVarMap(spell);
  let s = tooltip;

  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);

  s = s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, raw) => {
    const name = raw.toLowerCase();

    const eM = name.match(/^e(\d+)$/);
    if (eM) {
      const burn = getEffectBurn(spell, parseInt(eM[1], 10));
      if (burn !== '') return burn;
      if (wikiVarMap.has(name)) return wikiVarMap.get(name)!;
      return '';
    }

    const fM = name.match(/^f(\d+)$/);
    if (fM) {
      const burn = getEffectBurn(spell, parseInt(fM[1], 10));
      if (burn !== '') return burn;
      if (wikiVarMap.has(name)) return wikiVarMap.get(name)!;
      return '';
    }

    const aM = name.match(/^a(\d+)$/);
    if (aM) {
      const v = vars[parseInt(aM[1], 10) - 1];
      if (!v) return '';
      const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
      return `${Math.round(coeff * 100)}%`;
    }

    // 名前付き変数 → leveltip varMap 経由で effectBurn を引く
    if (varMap.has(name)) {
      const burn = getEffectBurn(spell, varMap.get(name)!);
      // effectBurn に値がある場合はそれを優先
      if (burn !== '') return burn;
      // effectBurn が空（AD/AP スケーリングのみ等）→ Wiki 値でフォールバック
      if (wikiVarMap.has(name)) return wikiVarMap.get(name)!;
      return '';
    }

    // Wiki 変数マップで直接解決を試みる
    if (wikiVarMap.has(name)) return wikiVarMap.get(name)!;

    return _match;
  });

  return s;
}

// ════════════════════════════════════════════════════════
// Step 2: @var@ 形式のテンプレート解決
// ════════════════════════════════════════════════════════

function resolveAtVarTemplates(
  s: string,
  spell: DDragonSpell,
  wikiVarMap: Map<string, string>,
): string {
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

  // 解決できなかった @var@ を Wiki データで補完、なければ除去
  // （@TotalDamage@ など DDragon 標準パターン以外の変数名に対応）
  s = s.replace(/@(\w+)(?:\*(\d+(?:\.\d+)?))?@/g, (_, varName, mult) => {
    const key = varName.toLowerCase();
    const wikiVal = wikiVarMap.get(key);
    if (wikiVal) {
      if (mult) {
        const m = parseFloat(mult);
        return wikiVal.split('/').map(v => {
          const num = parseFloat(v);
          return isNaN(num) ? v : String(Math.round(num * m));
        }).join('/');
      }
      return wikiVal;
    }
    return ''; // 解決できない場合は除去
  });

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

  // Wiki 変数マップ: leveltip ラベル ↔ Wiki leveling を照合
  const wikiVarMap = buildWikiVarMap(spell, wikiData);

  // Step 1: DDragon {{ }} 解決（effectBurn が空の場合は Wiki 値でフォールバック）
  let tooltip = resolveDDragonTemplates(spell.tooltip, spell, partype, wikiVarMap);
  // Step 2: @var@ 解決（未解決の @var@ は Wiki データで補完）
  tooltip = resolveAtVarTemplates(tooltip, spell, wikiVarMap);

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
