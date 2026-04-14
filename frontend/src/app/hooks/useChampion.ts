import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import { fetchCDragonSpells, formatEffectValues } from '../api/communityDragon';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';
import type { CDragonChampionSpells } from '../api/communityDragon';

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
 *
 * DDragon の effectBurn は "20/35/50/65/80" 形式の文字列だが、
 * 一部のスペルでは null になっている。その際は effect[N] の配列から
 * 各ランクの値を "/" で結合して代用する。
 * effect[N][0] は常に 0 (ランク0プレースホルダー) なので slice(1) で除去する。
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
 *
 * DDragon の leveltip は各ランクで変化する値の一覧で、
 *   leveltip.effect[i] = "{{ totaldamage }}" のとき、
 *   対応する値は effectBurn[i+1] に入っている（effectBurn[0] は常に ""）。
 *
 * これにより `{{ totaldamage }}` のような名前付き変数も解決できる。
 */
function buildLeveltipVarMap(spell: DDragonSpell): Map<string, number> {
  const map = new Map<string, number>();
  const effects = spell.leveltip?.effect ?? [];
  for (let i = 0; i < effects.length; i++) {
    const m = effects[i].match(/\{\{\s*(\w+)\s*\}\}/);
    if (m) {
      // leveltip[i] → effectBurn[i+1]
      map.set(m[1].toLowerCase(), i + 1);
    }
  }
  return map;
}

function resolveDDragonTemplates(tooltip: string, spell: DDragonSpell, partype: string): string {
  const vars    = spell.vars ?? [];
  const varMap  = buildLeveltipVarMap(spell);
  let s = tooltip;

  // {{ abilityresourcename }} を先に置換（名前に "ability" を含むので誤マッチ防止）
  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);

  // すべての {{ varname }} を一括処理
  s = s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, raw) => {
    const name = raw.toLowerCase();

    // {{ eN }} → effectBurn[N]
    const eM = name.match(/^e(\d+)$/);
    if (eM) return getEffectBurn(spell, parseInt(eM[1], 10));

    // {{ fN }} → effectBurn[N]（f は e の別名）
    const fM = name.match(/^f(\d+)$/);
    if (fM) return getEffectBurn(spell, parseInt(fM[1], 10));

    // {{ aN }} → vars[N-1] のスケーリング比率
    const aM = name.match(/^a(\d+)$/);
    if (aM) {
      const v = vars[parseInt(aM[1], 10) - 1];
      if (!v) return '';
      const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
      return `${Math.round(coeff * 100)}%`;
    }

    // 名前付き変数 → leveltip varMap 経由で effectBurn を引く
    if (varMap.has(name)) {
      return getEffectBurn(spell, varMap.get(name)!);
    }

    // varMap にない変数はそのまま保持（resolveAtVarTemplates で CDragon が解決を試みる）
    return _match;
  });

  // 最後に残った {{ abilityresourcename }} / 解決済みのものだけ除去せず return
  return s;
}

// ════════════════════════════════════════════════════════
// Step 2: @var@ 形式のテンプレート解決
// ════════════════════════════════════════════════════════
//
// 新しい DDragon / CDragon のトゥールチップは @VarName@ 形式を使う。
// 解決優先順位:
//   1. 標準パターン (@Effect1Amount@, @CooldownBurn@, @ResourceBurn@, @f1@)
//      → DDragon の effectBurn / cooldownBurn / costBurn から解決
//   2. 名前付き変数 (@WDamage@, @SlowAmount@, ...)
//      → CDragon の effectAmounts から解決
//   3. 乗算パターン (@SlowAmount*100@ など)
//      → 上記の値に乗算を適用
//   4. 解決できなかったものは除去

function resolveAtVarTemplates(
  s: string,
  spellKey: string,
  spell: DDragonSpell,
  cdSpells: CDragonChampionSpells | null,
): string {
  const burns = spell.effectBurn ?? [];

  // ── 2-1: 標準 @EffectNAmount@ → effectBurn[N] ────────
  // 新しい DDragon フォーマット。{{ e1 }} の代替。
  s = s.replace(/@Effect(\d+)Amount(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = burns[parseInt(n, 10)];
    if (val == null || val === '') return '';
    if (mult) {
      const m = parseFloat(mult);
      return val.split('/').map(v => String(Math.round(parseFloat(v) * m))).join('/');
    }
    return val;
  });

  // ── 2-2: @CooldownBurn@ / @ResourceBurn@ ────────────
  s = s.replace(/@CooldownBurn@/gi, spell.cooldownBurn ?? '');
  s = s.replace(/@ResourceBurn@/gi, spell.costBurn ?? '');

  // ── 2-3: @f1@, @f2@, ... → effectBurn[N] ────────────
  s = s.replace(/@f(\d+)(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = burns[parseInt(n, 10)];
    if (val == null || val === '') return '';
    if (mult) {
      const m = parseFloat(mult);
      return val.split('/').map(v => String(Math.round(parseFloat(v) * m))).join('/');
    }
    return val;
  });

  // ── 2-4: @VarName@ → CDragon effectAmounts ──────────
  const cdData = cdSpells?.[spellKey];
  if (cdData) {
    s = s.replace(/@(\w+?)(?:\*(\d+(?:\.\d+)?))?@/g, (match, varName, mult) => {
      const values = cdData.effectAmounts[varName];
      if (!values || values.length === 0) return match;
      const m = mult ? parseFloat(mult) : 1;
      return formatEffectValues(values, m);
    });
  }

  // ── 2-5: 解決できなかった @var@ を除去（{{ }} は buildSkill で処理） ──
  s = s.replace(/@\w+(?:\*\d+(?:\.\d+)?)?@/g, '');

  return s;
}

// ════════════════════════════════════════════════════════
// Step 3: DDragon HTML タグ → styled HTML 変換
// ════════════════════════════════════════════════════════
//
// Data Dragon tooltip の独自タグをゲーム内カラーに変換する:
//   <active>Active:</active>          → <strong>
//   <scaleAD>(+70%AD)</scaleAD>       → gold #C89B3C
//   <scaleAP>(+35%AP)</scaleAP>       → sky blue #7EC8E3
//   <physicalDamage>200</physicalDamage> → orange #FF8C00
//   <magicDamage>100</magicDamage>    → sky blue #7EC8E3
//   <br>                              → 改行

const AD   = '#C89B3C';  // 金色   — AD / 物理ダメージ
const AP   = '#7EC8E3';  // 水色   — AP / 魔法ダメージ
const HP   = '#1ECC1E';  // 緑     — HP スケーリング / 回復
const MANA = '#5383E8';  // 青     — マナスケーリング

function processTooltipHtml(raw: string): string {
  let s = raw;

  // 改行タグ → <br>
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<\/li>/gi, '');
  s = s.replace(/<li>/gi, '<br>• ');
  s = s.replace(/<\/p>/gi, '<br>');
  s = s.replace(/<p(?:\s[^>]*)?>/gi, '');

  // 太字ラベル (active, passive, keyword 系)
  const boldTags = ['active', 'passive', 'keywordMajor', 'keyword',
                    'attention', 'rarityGeneric', 'status'];
  for (const tag of boldTags) {
    s = s.replace(new RegExp(`<${tag}>`, 'gi'), '<strong>');
    s = s.replace(new RegExp(`</${tag}>`, 'gi'), '</strong>');
  }

  // スケーリング / ダメージタイプ → 色付き span
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

  // 残りの不明タグを除去（br / strong / span だけ残す）
  s = s.replace(/<[^>]+>/g, (match) => {
    const t = match.toLowerCase().trim();
    if (
      t === '<br>' || t === '<br/>' || t === '<br />' ||
      t === '<strong>' || t === '</strong>' ||
      t === '</span>' || t.startsWith('<span ')
    ) return match;
    return '';
  });

  // HTML エンティティデコード
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&apos;/g, "'");
  s = s.replace(/&quot;/g, '"');

  // 先頭の余分な改行を除去
  return s.replace(/^(<br>\s*)+/, '').trim();
}

// ── passive の description 処理（tooltip を持たない）────
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
  cdSpells: CDragonChampionSpells | null,
): SkillData {
  const rangeNum = parseInt(spell.rangeBurn, 10);
  const hasRange = spell.rangeBurn !== 'self'
    && spell.rangeBurn !== '0'
    && !isNaN(rangeNum)
    && rangeNum <= 5000;

  // Step 1: DDragon {{ }} 解決（varMap にない変数はそのまま残る）
  let tooltip = resolveDDragonTemplates(spell.tooltip, spell, partype);
  // Step 2: @var@ 解決（未解決の {{ }} は残したまま）
  tooltip = resolveAtVarTemplates(tooltip, key, spell, cdSpells);

  // Step 3: 未解決の {{ varname }} が残っていれば CDragon の dynamicDescription を使う
  const cdData = cdSpells?.[key];
  const hasUnresolved = /\{\{\s*\w+\s*\}\}/.test(tooltip);

  // ── デバッグ（W スキルのみ）──
  if (key === 'W') {
    console.log('[DBG] W tooltip after step1+2:', tooltip);
    console.log('[DBG] W hasUnresolved:', hasUnresolved);
    console.log('[DBG] W cdData:', cdData ? 'available' : 'NULL');
    console.log('[DBG] W dynamicDescription:', cdData?.dynamicDescription?.slice(0, 150) ?? 'EMPTY/MISSING');
  }

  let description: string;
  if (hasUnresolved && cdData?.dynamicDescription) {
    // CDragon dynamicDescription (@EffectNAmount@ 形式) を effectAmounts で解決
    let cdDesc = cdData.dynamicDescription;
    cdDesc = resolveAtVarTemplates(cdDesc, key, spell, cdSpells);
    cdDesc = cdDesc.replace(/\{\{[^}]*\}\}/g, '');
    description = processTooltipHtml(cdDesc);
  } else {
    // 残った {{ }} を除去して DDragon tooltip を使用
    const clean = tooltip.replace(/\{\{[^}]*\}\}/g, '');
    description = processTooltipHtml(clean);
  }

  // costType は "{{ abilityresourcename }}" のままの場合があるので置換する
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
        // 1. DDragon バージョン + チャンピオン詳細を取得
        const v   = await getLatestVersion();
        const raw = await fetchChampionDetail(v, championId!);
        if (cancelled) return;

        // 2. CDragon を並行取得（失敗してもフォールバック可能）
        //    raw.key = 数値 ID 文字列（例: "6"）
        const cdData = await fetchCDragonSpells(raw.key).catch(() => null);
        if (cancelled) return;

        const [Q, W, E, R] = raw.spells;
        const partype = raw.partype;

        const skills: SkillData[] = [
          {
            key:         'P',
            name:        raw.passive.name,
            description: resolvePassiveDescription(raw.passive.description, partype),
            imageUrl:    passiveImageUrl(v, raw.passive.image.full),
          },
          buildSkill('Q', Q, v, partype, cdData),
          buildSkill('W', W, v, partype, cdData),
          buildSkill('E', E, v, partype, cdData),
          buildSkill('R', R, v, partype, cdData),
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
