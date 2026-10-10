/**
 * DDragon ツールチップのプレースホルダー解決
 *
 * 生成済みツールチップ（/tooltips/{id}.json）がないチャンピオン向けの
 * フォールバック。DDragon が提供する範囲の値だけで解決し、
 * 解決できない変数は呼び出し側で除去する。
 *
 * プレースホルダー:
 *   {{ eN }} / {{ fN }} → effectBurn[N]（"40/65/90/115/140" など）
 *   {{ aN }}            → vars[N-1] の比率（"33%" など）
 *   {{ 名前付き変数 }}   → leveltip 経由で effectBurn へ対応付け
 *   @Effect{N}Amount@ / @CooldownBurn@ / @ResourceBurn@ / @fN@
 *   {{ abilityresourcename }} / @AbilityResourceName@ → partype
 */

import type { DDragonSpell } from '../types/ddragon';

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

function applyMultiplier(val: string, multStr: string | undefined): string {
  if (!multStr) return val;
  const m = parseFloat(multStr);
  return val.split('/').map(v => {
    const num = parseFloat(v);
    return isNaN(num) ? v : String(Math.round(num * m));
  }).join('/');
}

/** {{ }} 形式のプレースホルダーを解決する */
export function resolveDDragonTemplates(
  tooltip: string,
  spell: DDragonSpell,
  partype: string,
): string {
  const vars   = spell.vars ?? [];
  const varMap = buildLeveltipVarMap(spell);
  let s = tooltip;

  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);

  // {{ var }} と {{ var*N }} の両形式を処理
  s = s.replace(/\{\{\s*(\w+)(?:\s*\*\s*(\d+(?:\.\d+)?))?\s*\}\}/g, (_match, raw, multStr) => {
    const name = raw.toLowerCase();

    const efM = name.match(/^[ef](\d+)$/);
    if (efM) {
      const burn = getEffectBurn(spell, parseInt(efM[1], 10));
      return burn !== '' ? applyMultiplier(burn, multStr) : '';
    }

    const aM = name.match(/^a(\d+)$/);
    if (aM) {
      const v = vars[parseInt(aM[1], 10) - 1];
      if (!v) return '';
      const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
      return `${Math.round(coeff * 100)}%`;
    }

    // 名前付き変数: leveltip 経由で effectBurn へ
    if (varMap.has(name)) {
      const burn = getEffectBurn(spell, varMap.get(name)!);
      return burn !== '' ? applyMultiplier(burn, multStr) : '';
    }

    return _match;
  });

  return s;
}

/** @var@ 形式のプレースホルダーを解決する（未解決は除去） */
export function resolveAtVarTemplates(s: string, spell: DDragonSpell): string {
  // @Effect{N}Amount@
  s = s.replace(/@Effect(\d+)Amount(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = getEffectBurn(spell, parseInt(n, 10));
    return val ? applyMultiplier(val, mult) : '';
  });

  // @CooldownBurn@ / @ResourceBurn@
  s = s.replace(/@CooldownBurn@/gi, spell.cooldownBurn ?? '');
  s = s.replace(/@ResourceBurn@/gi, spell.costBurn ?? '');

  // @f{N}@
  s = s.replace(/@f(\d+)(?:\*(\d+(?:\.\d+)?))?@/gi, (_, n, mult) => {
    const val = getEffectBurn(spell, parseInt(n, 10));
    return val ? applyMultiplier(val, mult) : '';
  });

  // 解決できなかった @var@ は除去
  s = s.replace(/@\w+(?:\*\d+(?:\.\d+)?)?@/g, '');

  return s;
}
