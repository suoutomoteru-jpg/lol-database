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
  // '0' は DDragon が effectBurn を未設定の際に入れるプレースホルダーなので無視する
  if (burn != null && burn !== '' && burn !== '0') return burn;

  const eff = (spell.effect ?? [])[n];
  if (Array.isArray(eff)) {
    const vals = (eff[0] === 0 || eff[0] == null) ? eff.slice(1) : eff;
    const nonZero = vals.filter((v): v is number => v != null && v !== 0);
    if (nonZero.length === 0) return '';
    if (nonZero.every(v => v === nonZero[0])) return String(nonZero[0]);
    return nonZero.join('/');
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
    // leveltip.effect は {{ var }} 形式と @var@ 形式の両方が存在する
    const m = effects[i].match(/\{\{\s*(\w+)\s*\}\}/)
           ?? effects[i].match(/@(\w+)(?:\*[\d.]+)?@/);
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
    ['status',         ['slow', 'stun', 'root', 'fear', 'movement slow']],
    ['slow',           ['slow', 'movement slow']],
    ['duration',       ['duration', 'stun duration', 'slow duration', 'shield duration']],
  ];

  const assignFromTag = (varname: string, keywords: string[]) => {
    if (map.has(varname)) return;
    for (const kw of keywords) {
      const stat = wikiData.leveling.find(s => s.label.toLowerCase().includes(kw));
      if (stat) { map.set(varname, stat.value); return; }
    }
  };

  for (const [tagName, keywords] of TAG_KEYWORDS) {
    // {{ var }} 形式
    const tagRe1 = new RegExp(`<${tagName}(?:\\s[^>]*)?>[^<]*\\{\\{\\s*(\\w+)\\s*\\}\\}`, 'gi');
    let m1: RegExpExecArray | null;
    while ((m1 = tagRe1.exec(spell.tooltip)) !== null) {
      assignFromTag(m1[1].toLowerCase(), keywords);
    }

    // @VarName@ 形式（大文字含む）
    const tagRe2 = new RegExp(`<${tagName}(?:\\s[^>]*)?>[^<]*@([A-Za-z]\\w*)(?:\\*[\\d.]+)?@`, 'gi');
    let m2: RegExpExecArray | null;
    while ((m2 = tagRe2.exec(spell.tooltip)) !== null) {
      assignFromTag(m2[1].toLowerCase(), keywords);
    }

    // @Effect{N}Amount@ 形式 → 合成キー 'e{N}'（effectBurn 空白時のフォールバック用）
    const tagRe3 = new RegExp(`<${tagName}(?:\\s[^>]*)?>[^<]*@Effect(\\d+)Amount(?:\\*[\\d.]+)?@`, 'gi');
    let m3: RegExpExecArray | null;
    while ((m3 = tagRe3.exec(spell.tooltip)) !== null) {
      assignFromTag(`e${m3[1]}`, keywords);
    }
  }

  // ── アプローチ2: leveltip ラベル経由（ja_JP 日本語ラベルも変換して対応） ─
  //
  // ja_JP の leveltip.label は "持続時間" など日本語なので、英語 wiki ラベルと
  // 直接一致しない。正規表現マッピングで英語キーワードに変換してから照合する。
  const JP_LABEL_MAP: [RegExp, string][] = [
    [/スタン|気絶|硬直/,                       'stun'],
    [/シールド.*(時間|持続)/,                  'shield duration'],
    [/シールド/,                               'shield'],
    [/スロウ.*(時間|持続)|鈍足.*(時間|持続)/, 'slow duration'],
    [/スロウ|鈍足/,                            'slow'],
    [/持続|時間/,                              'duration'],
    [/物理.*ダメージ|ダメージ.*物理/,          'physical damage'],
    [/魔法.*ダメージ|ダメージ.*魔法/,          'magic damage'],
    [/真.*ダメージ/,                           'true damage'],
    [/ダメージ/,                               'damage'],
    [/回復/,                                   'heal'],
    [/攻撃速度/,                               'attack speed'],
    [/移動速度/,                               'movement speed'],
  ];

  const jpToEn = (jpLabel: string): string => {
    for (const [re, en] of JP_LABEL_MAP) {
      if (re.test(jpLabel)) return en;
    }
    return jpLabel.toLowerCase();
  };

  for (let i = 0; i < effects.length; i++) {
    const m = effects[i].match(/\{\{\s*(\w+)\s*\}\}/)
           ?? effects[i].match(/@(\w+)(?:\*[\d.]+)?@/);
    if (!m || !labels[i]) continue;

    const varname = m[1].toLowerCase();
    if (map.has(varname)) continue;

    const ddLabel    = labels[i];
    const ddLabelLow = ddLabel.toLowerCase();
    const enLabel    = jpToEn(ddLabel);

    const stat = wikiData.leveling.find(s => {
      const wLow = s.label.toLowerCase();
      return (
        wLow === ddLabelLow ||
        ddLabelLow.includes(wLow) ||
        wLow.includes(ddLabelLow) ||
        wLow === enLabel ||
        (enLabel !== ddLabelLow && (wLow.includes(enLabel) || enLabel.includes(wLow)))
      );
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

  // {{ var }} と {{ var*N }} の両形式を処理
  s = s.replace(/\{\{\s*(\w+)(?:\s*\*\s*(\d+(?:\.\d+)?))?\s*\}\}/g, (_match, raw, multStr) => {
    const name = raw.toLowerCase();

    const applyMult = (val: string): string => {
      if (!multStr) return val;
      const m = parseFloat(multStr);
      return val.split('/').map(v => {
        const num = parseFloat(v);
        return isNaN(num) ? v : String(Math.round(num * m));
      }).join('/');
    };

    const eM = name.match(/^e(\d+)$/);
    if (eM) {
      const burn = getEffectBurn(spell, parseInt(eM[1], 10));
      if (burn !== '') return applyMult(burn);
      if (wikiVarMap.has(name)) return applyMult(wikiVarMap.get(name)!);
      return '';
    }

    const fM = name.match(/^f(\d+)$/);
    if (fM) {
      const burn = getEffectBurn(spell, parseInt(fM[1], 10));
      if (burn !== '') return applyMult(burn);
      if (wikiVarMap.has(name)) return applyMult(wikiVarMap.get(name)!);
      return '';
    }

    const aM = name.match(/^a(\d+)$/);
    if (aM) {
      const v = vars[parseInt(aM[1], 10) - 1];
      if (!v) return '';
      const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
      return `${Math.round(coeff * 100)}%`;
    }

    // 名前付き変数: wiki優先（スケーリング情報含む）→ effect配列フォールバック
    if (varMap.has(name)) {
      if (wikiVarMap.has(name)) return applyMult(wikiVarMap.get(name)!);
      const burn = getEffectBurn(spell, varMap.get(name)!);
      if (burn !== '') return applyMult(burn);
      return '';
    }

    if (wikiVarMap.has(name)) return applyMult(wikiVarMap.get(name)!);

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
  // @Effect{N}Amount@ → effectBurn[N] または effect[N] フォールバック、それでも空なら wiki
  s = s.replace(/@Effect(\d+)Amount(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const idx = parseInt(n, 10);
    const val = getEffectBurn(spell, idx) || wikiVarMap.get(`e${idx}`) || '';
    if (!val) return '';
    if (mult) {
      const m = parseFloat(mult);
      return val.split('/').map(v => {
        const num = parseFloat(v);
        return isNaN(num) ? v : String(Math.round(num * m));
      }).join('/');
    }
    return val;
  });

  // @CooldownBurn@ / @ResourceBurn@
  s = s.replace(/@CooldownBurn@/gi, spell.cooldownBurn ?? '');
  s = s.replace(/@ResourceBurn@/gi, spell.costBurn ?? '');

  // @f{N}@ → effectBurn[N] または effect[N] フォールバック
  s = s.replace(/@f(\d+)(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = getEffectBurn(spell, parseInt(n, 10));
    if (!val) return '';
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
    s = s.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi'), '<strong>');
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</strong>');
  }

  // [tag, color, statKey?] — statKey があるとタップでアイテム一覧が開く
  const colorMap: [string, string, string?][] = [
    ['scaleAD',        AD,          'stat:FlatPhysicalDamageMod'],
    ['scaleBonusAD',   AD,          'stat:FlatPhysicalDamageMod'],
    ['scaleAP',        AP,          'stat:FlatMagicDamageMod'],
    ['scaleHealth',    HP,          'stat:FlatHPPoolMod'],
    ['scaleMana',      MANA,        'stat:FlatMPPoolMod'],
    ['scaleLevel',     AD],
    ['physicalDamage', '#FF8C00'],
    ['magicDamage',    AP],
    ['trueDamage',     '#F0E6D2'],
    ['healing',        HP],
    ['shield',         HP,          'custom:HealAndShieldPower'],
    ['speed',          '#F9E4B7'],
  ];

  for (const [tag, color, statKey] of colorMap) {
    const open = statKey
      ? `<span style="color:${color};cursor:pointer;border-bottom:1px dashed ${color}" data-stat="${statKey}">`
      : `<span style="color:${color}">`;
    s = s.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi'), open);
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</span>');
  }

  s = s.replace(/<[^>]+>/g, (match) => {
    const t = match.toLowerCase().trim();
    if (
      t === '<br>' || t === '<br/>' || t === '<br />' ||
      t === '<strong>' || t === '</strong>' ||
      t === '<span>' || t === '</span>' || t.startsWith('<span ')
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

  // ── DEBUG ──────────────────────────────────────────────
  // Step 1: DDragon {{ }} 解決（effectBurn が空の場合は effect[] または Wiki 値でフォールバック）
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
