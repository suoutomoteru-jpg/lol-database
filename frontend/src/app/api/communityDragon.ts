/**
 * Community Dragon API クライアント
 *
 * DDragon の tooltip に含まれる名前付き変数（{{ totaldamage }} など）を
 * 解決できない場合の補完ソースとして使用する。
 *
 * 戦略:
 *   CDragon の `effectAmounts` を用いて {{ varname }} を case-insensitive で解決する。
 *   解決できない場合は CDragon の `dynamicDescription`（英語）を最終フォールバックとして使用する。
 *
 * エンドポイント:
 *   https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/{numericId}.json
 *   ※ ja_jp パスにはこのファイルが存在しない（global/default が正規パス）
 */

// global/default が v1/champions/{id}.json の正規パス
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
const CACHE_PREFIX = 'lol-cdragon:v3:default:';

// ── 型定義 ─────────────────────────────────────────────

export interface CDragonSpellData {
  /**
   * @Effect1Amount@ 形式のテンプレート（日本語）。
   * effectAmounts で @var@ を解決することで完全なツールチップが得られる。
   */
  dynamicDescription: string;
  /** 変数名 → 各ランクの数値配列 [rank0, rank1, ..., rank5, rankMax] (7要素) */
  effectAmounts: Record<string, number[]>;
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
  } catch { /* QuotaExceededError は無視 */ }
}

// ── メイン取得関数 ─────────────────────────────────────

export async function fetchCDragonSpells(numericId: string): Promise<CDragonChampionSpells | null> {
  const cacheKey = `${CACHE_PREFIX}${numericId}`;
  const cached = readLocalCache<CDragonChampionSpells>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${CDRAGON_BASE}/v1/champions/${numericId}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[CDragon] fetch failed:', res.status, url);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const result: CDragonChampionSpells = {};

    // ── デバッグ: 最初のスペルの effectAmounts キーを確認 ──
    if (Array.isArray(data.spells) && data.spells.length > 0) {
      const firstSpell = data.spells[0];
      console.log('[CDragon] spells count:', data.spells.length);
      console.log('[CDragon] spell[0].spellKey:', firstSpell.spellKey);
      console.log('[CDragon] spell[0].effectAmounts keys:', Object.keys(firstSpell.effectAmounts ?? {}));
      // W スペルのキーを探して effectAmounts を表示
      const wSpell = data.spells.find((s: any) => String(s.spellKey) === 'W');
      if (wSpell) {
        console.log('[CDragon] W.effectAmounts:', wSpell.effectAmounts);
        console.log('[CDragon] W.dynamicDescription (50chars):', String(wSpell.dynamicDescription ?? '').slice(0, 50));
      }
    }

    if (Array.isArray(data.spells)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const spell of data.spells as any[]) {
        const key = String(spell.spellKey ?? '');
        if (!key) continue;

        result[key] = {
          dynamicDescription: typeof spell.dynamicDescription === 'string'
            ? spell.dynamicDescription
            : '',
          effectAmounts:
            spell.effectAmounts && typeof spell.effectAmounts === 'object'
              ? spell.effectAmounts
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
 * CDragon の effectAmounts 数値配列を "v1/v2/v3/v4/v5" 形式にフォーマットする。
 *
 * CDragon の配列は 7 要素: [rank0, rank1, rank2, rank3, rank4, rank5, rankMax]
 * rank0（index 0）と rankMax（最後）は通常 rank1/rank5 と同値のため除外する。
 * 全要素が同値の場合（定数）は 1 つだけ表示する。
 */
export function formatEffectValues(values: number[], multiplier = 1): string {
  if (!values || values.length === 0) return '';

  // [rank0, rank1, ..., rank5, rankMax] → rank1〜rank5 を取り出す
  const levels = values.length > 2 ? values.slice(1, -1) : values;
  if (levels.length === 0) return '';

  const scaled = levels.map(v => {
    const val = v * multiplier;
    return Number.isInteger(val) ? String(val) : parseFloat(val.toFixed(2)).toString();
  });

  // 全ランクで同値なら 1 つだけ表示（例: "9" ではなく "9/9/9/9/9" にしない）
  const unique = new Set(scaled);
  if (unique.size === 1) return scaled[0];

  return scaled.join('/');
}
