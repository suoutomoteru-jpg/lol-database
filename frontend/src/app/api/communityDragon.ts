/**
 * Community Dragon API クライアント
 *
 * DDragon の tooltip に含まれる @VariableName@ プレースホルダーを
 * 解決するために使用する。
 *
 * エンドポイント:
 *   https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/{numericId}.json
 *
 * キャッシュ: localStorage に永続保存（パッチアップ時は自動失効）
 */

const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
const CACHE_PREFIX = 'lol-cdragon:v1:';

// ── 型定義 ─────────────────────────────────────────────

export interface CDragonSpellData {
  /** 変数名 → 各ランクの数値配列 (index 0 = ランク1 か、index 0 = 0 の場合はランク1〜5 = index 1〜5) */
  effectAmounts: Record<string, number[]>;
  /** スケーリング係数 (coefficient1, coefficient2 ...) */
  coefficients: Record<string, number>;
  /** クールダウン（各ランク） */
  cooldownCoefficients: number[];
  /** コスト（各ランク） */
  costCoefficients: number[];
}

/** スペルキー ('Q'|'W'|'E'|'R') → CDragonSpellData */
export type CDragonChampionSpells = Record<string, CDragonSpellData>;

// ── localStorage ヘルパー ──────────────────────────────

function readLocalCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // QuotaExceededError は無視（キャッシュなしで動作継続）
  }
}

// ── メイン取得関数 ─────────────────────────────────────

/**
 * CDragon からチャンピオンのスペルデータを取得する。
 *
 * @param numericId チャンピオンの数値ID（DDragon の champion.key, e.g. "6"）
 * @returns スペルキーでインデックスされたスペルデータ、失敗時は null
 */
export async function fetchCDragonSpells(numericId: string): Promise<CDragonChampionSpells | null> {
  const cacheKey = `${CACHE_PREFIX}${numericId}`;
  const cached = readLocalCache<CDragonChampionSpells>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${CDRAGON_BASE}/v1/champions/${numericId}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();

    const result: CDragonChampionSpells = {};

    if (Array.isArray(data.spells)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const spell of data.spells as any[]) {
        const key = String(spell.spellKey ?? '');
        if (!key) continue;

        result[key] = {
          effectAmounts:
            spell.effectAmounts && typeof spell.effectAmounts === 'object'
              ? spell.effectAmounts
              : {},
          coefficients:
            spell.coefficients && typeof spell.coefficients === 'object'
              ? spell.coefficients
              : {},
          cooldownCoefficients: Array.isArray(spell.cooldownCoefficients)
            ? spell.cooldownCoefficients
            : [],
          costCoefficients: Array.isArray(spell.costCoefficients)
            ? spell.costCoefficients
            : [],
        };
      }
    }

    writeLocalCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ── ユーティリティ ─────────────────────────────────────

/**
 * 数値の配列を "v1/v2/v3/v4/v5" 形式の文字列にフォーマットする。
 *
 * CDragon の effectAmounts では index 0 が 0 であることが多いため、
 * 先頭が 0 かつ残りが非 0 の場合は index 1 以降を使う。
 */
export function formatEffectValues(values: number[], multiplier = 1): string {
  const levels = values[0] === 0 && values.length > 1 ? values.slice(1) : values;
  return levels
    .map(v => {
      const val = v * multiplier;
      // 整数なら小数点なし、小数なら末尾の 0 を除去
      return Number.isInteger(val) ? String(val) : parseFloat(val.toFixed(2)).toString();
    })
    .join('/');
}
