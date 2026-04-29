/**
 * League of Legends Wiki API クライアント
 *
 * DDragon の日本語スキル説明文に欠けている数値情報（ダメージ、スケーリング等）を
 * LoL Wiki から補完するためのモジュール。
 *
 * データ取得戦略:
 *   Wiki の MediaWiki API を使い Template:Data_{Champion}/{SpellKey} を取得する。
 *   `&redirects=1` を付与することでスペル名への転送も自動的に辿る。
 *   例: Template:Data_Ashe/W → Template:Data_Ashe/Volley（自動リダイレクト）
 *
 * パース戦略:
 *   Wikitext の |leveling セクションから {{st|Label|Value}} を抽出し、
 *   {{ap|X to Y}} は線形補間でランク毎の値に変換する。
 *   {{as|(+ 100% bonus AD)}} はスケーリング情報として表示する。
 *
 * キャッシュ:
 *   localStorage に champion ID 単位で保存する。
 *
 * エンドポイント:
 *   https://wiki.leagueoflegends.com/en-us/api.php
 *   （CORS: origin=* パラメータでブラウザから直接アクセス可能）
 */

const WIKI_API = 'https://wiki.leagueoflegends.com/en-us/api.php';
const CACHE_PREFIX = 'lol-wiki:v3:';

// ── 型定義 ────────────────────────────────────────────

/** スキルのランク毎の数値情報（1行分） */
export interface WikiLevelingStat {
  /** ラベル（例: "Physical Damage", "Arrows"） */
  label: string;
  /** 値文字列（例: "60/95/130/165/200 (+ 100% bonus AD)"） */
  value: string;
}

/** Wikiから取得した1スキル分のデータ */
export interface WikiSpellData {
  leveling: WikiLevelingStat[];
  /** ボディパラメータから抽出した定数値（例: { "stunduration": "0.75", "shieldduration": "4" }） */
  constants?: Record<string, string>;
}

/** スペルキー ('Q'|'W'|'E'|'R') → WikiSpellData */
export type WikiChampionSpells = Record<string, WikiSpellData>;

// ── チャンピオン名変換 ───────────────────────────────

/**
 * DDragon の champion ID を Wiki のページ名に変換する。
 *
 * DDragon は ID にスペースや記号を含まない（例: "KogMaw", "DrMundo"）が、
 * Wiki のページ名は本来の英語表記（例: "Kog'Maw", "Dr. Mundo"）を使う。
 */
export function toWikiName(ddId: string): string {
  const SPECIAL: Record<string, string> = {
    // スペース区切り
    AurelionSol:  'Aurelion Sol',
    DrMundo:      'Dr. Mundo',
    JarvanIV:     'Jarvan IV',
    LeeSin:       'Lee Sin',
    MasterYi:     'Master Yi',
    MissFortune:  'Miss Fortune',
    RenataGlasc:  'Renata Glasc',
    Renata:       'Renata Glasc',
    TahmKench:    'Tahm Kench',
    TwistedFate:  'Twisted Fate',
    XinZhao:      'Xin Zhao',
    // アポストロフィ
    Belveth:      "Bel'Veth",
    BelVeth:      "Bel'Veth",
    Chogath:      "Cho'Gath",
    Kaisa:        "Kai'Sa",
    Khazix:       "Kha'Zix",
    KogMaw:       "Kog'Maw",
    Ksante:       "K'Sante",
    RekSai:       "Rek'Sai",
    Velkoz:       "Vel'Koz",
    // DDragon 独自 ID → 現在の名前
    MonkeyKing:   'Wukong',
    Nunu:         'Nunu & Willump',
    NunuWillump:  'Nunu & Willump',
  };
  return SPECIAL[ddId] ?? ddId;
}

// ── Wikitext パーサー ────────────────────────────────

/**
 * {{ap|X to Y}} または {{ap|v1|v2|...|vN}} テンプレートを
 * "v1/v2/.../vN" 形式の文字列に変換する。
 *
 * "X to Y" 形式の場合は maxrank 段階の線形補間を行う。
 */
function parseApTemplate(content: string, maxrank: number): string {
  const trimmed = content.trim();

  // "X to Y" 形式 → 線形補間
  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)$/i);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1]);
    const end   = parseFloat(rangeMatch[2]);
    if (maxrank === 1) return String(start);

    const vals: string[] = [];
    for (let i = 0; i < maxrank; i++) {
      const raw = start + (end - start) * i / (maxrank - 1);
      const v   = parseFloat(raw.toFixed(2));
      vals.push(Number.isInteger(v) ? String(v) : String(v));
    }
    const unique = new Set(vals);
    return unique.size === 1 ? vals[0] : vals.join('/');
  }

  // "|" 区切りの列挙形式
  const parts = trimmed.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) {
    const unique = new Set(parts);
    return unique.size === 1 ? parts[0] : parts.join('/');
  }

  return trimmed;
}

/**
 * 値文字列内の Wiki テンプレートを解決する。
 *
 * {{fd|X}}    → X（小数点表示テンプレート、ネスト解決のため最初に処理）
 * {{ap|...}}  → ランク毎の数値（線形補間または列挙）
 * {{as|(...)}} → スケーリング情報テキスト（括弧付き）
 * {{sti|type|text}} → text
 * {{tt|text|tooltip}} → text
 * '''bold'''  → 装飾除去
 * [[link]]    → テキスト抽出
 */
function resolveWikiValue(raw: string, maxrank: number): string {
  let s = raw;

  // {{fd|X}} → X（{{as|...}} 内のネストを解決するため最初に処理）
  s = s.replace(/\{\{fd\|([^|{}]+)\}\}/gi, (_, x) => x.trim());

  // {{ap|...}} を解決
  s = s.replace(/\{\{ap\|([^}]+)\}\}/gi, (_, content) =>
    parseApTemplate(content, maxrank));

  // {{as|(...)}} → スケーリングテキスト
  s = s.replace(/\{\{as\|([^}]+)\}\}/gi, (_, content) => content.trim());

  // {{sti|type|text}} → text（スタイル付きインライン）
  s = s.replace(/\{\{sti\|[^|{}]+\|([^{}]*)\}\}/gi, (_, text) => text.trim());

  // {{tt|text|tooltip}} → text
  s = s.replace(/\{\{tt\|([^|{}]+)\|[^{}]*\}\}/gi, (_, text) => text.trim());

  // 残存する未知テンプレートを除去
  s = s.replace(/\{\{[^{}]*\}\}/g, '');

  // Wiki マークアップ除去
  s = s.replace(/'{2,3}/g, '');                          // '''bold'''
  s = s.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1'); // [[link|text]]

  return s.trim();
}

/**
 * Wikitext の |leveling / |leveling2 / |leveling3 ... セクションから
 * {{st|Label|Value}} 対をすべて抽出する。
 *
 * st テンプレートのネスト構造（2段まで許容）:
 *   {{st|Label|{{ap|X to Y}} {{as|(+ {{fd|N}}% stat)}}}}
 */
function parseLeveling(wikitext: string, maxrank: number): WikiLevelingStat[] {
  const stats: WikiLevelingStat[] = [];

  // |leveling, |leveling2, |leveling3 ... を全て対象にする
  const sectionRe = /\|\s*leveling\d*\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\}|$)/gi;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRe.exec(wikitext)) !== null) {
    const section = sectionMatch[1];

    // Value部分は2段ネスト（{{as|(+ {{fd|X}}% ...)}}）まで許容
    const stRegex = /\{\{st\|([^|{}]+)\|((?:[^{}]|\{\{(?:[^{}]|\{\{[^{}]*\}\})*\}\})*)\}\}/gi;
    let match: RegExpExecArray | null;

    while ((match = stRegex.exec(section)) !== null) {
      const label = match[1].trim();
      const value = resolveWikiValue(match[2].trim(), maxrank);
      if (label && value) {
        stats.push({ label, value });
      }
    }
  }

  return stats;
}

/**
 * Wikitext のボディパラメータから定数値を抽出する。
 *
 * 例: "|stun duration = 0.75" → { "stunduration": "0.75" }
 *     "|shield duration = 4"  → { "shieldduration": "4"   }
 *
 * キーはスペースを除去した小文字に正規化する。leveling セクションには
 * 現れないランク不変の値（CC時間・シールド持続等）を補完するために使用する。
 */
/**
 * Wikitext の |description* セクションから持続時間定数を抽出する。
 *
 * "for X seconds" / "for {{fd|X}} seconds" パターンを検出し、
 * 前後のキーワード（shield / stun / slow 等）から変数名を推定する。
 * 同じ種別が複数出現する場合は最後の値（より詳細な記述）を採用する。
 *
 * 例:
 *   |description  = ...{{tip|shield}} for 4 seconds.
 *     → { shieldduration: '4' }
 *   |description3 = ...{{tip|stun|stunning}} them for {{fd|1.5}} seconds...
 *     → { stunduration: '1.5' }
 */
function parseDescriptionDurations(wikitext: string): Record<string, string> {
  const result: Record<string, string> = {};

  const descRe = /\|\s*description\d*\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\}|$)/gi;
  let dm: RegExpExecArray | null;

  while ((dm = descRe.exec(wikitext)) !== null) {
    const desc = dm[1].toLowerCase();

    // "for X seconds" or "for {{fd|X}} seconds"
    const durRe = /for\s+(?:\{\{fd\|(\d+(?:\.\d+)?)\}\}|(\d+(?:\.\d+)?))\s+seconds?/gi;
    let dur: RegExpExecArray | null;
    while ((dur = durRe.exec(desc)) !== null) {
      const val = (dur[1] ?? dur[2]).trim();
      if (/shield/.test(desc)) result['shieldduration'] = val;
      if (/stun/.test(desc))   result['stunduration']   = val;
      if (/slow/.test(desc))   result['slowduration']   = val;
      if (/root/.test(desc))   result['rootduration']   = val;
      if (/fear|flee/.test(desc)) result['fearduration'] = val;
    }
  }

  return result;
}

function parseConstants(wikitext: string): Record<string, string> {
  // |key = numeric_value 形式の行を解析
  const result: Record<string, string> = {};
  const re = /^\|\s*([a-zA-Z][a-zA-Z0-9 _-]*?)\s*=\s*(\d+(?:\.\d+)?)\s*(?:[^|\n]*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext)) !== null) {
    const afterVal = m[0].slice(m[0].indexOf(m[2]) + m[2].length).trim();
    if (/^[|{}]/.test(afterVal)) continue;
    const key = m[1].trim().toLowerCase().replace(/[\s_-]+/g, '');
    result[key] = m[2].trim();
  }

  // description テキストから "for X seconds" パターンも補完
  Object.assign(result, parseDescriptionDurations(wikitext));

  return result;
}

// ── localStorage キャッシュ ──────────────────────────

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* QuotaExceededError は無視 */ }
}

// ── MediaWiki API 取得 ────────────────────────────────

/**
 * Wiki の MediaWiki API から wikitext を取得する。
 * `&redirects=1` によりスペルキー → スペル名へのリダイレクトを自動追跡する。
 *
 * @param title  ページタイトル（例: "Template:Data_Ashe/W"）
 * @returns wikitext 文字列、ページが存在しない場合は null
 */
async function fetchWikitext(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action:    'query',
    format:    'json',
    titles:    title,
    prop:      'revisions',
    rvprop:    'content',
    redirects: '1',
    origin:    '*',
  });

  const res = await fetch(`${WIKI_API}?${params}`);
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const pages = data?.query?.pages ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page  = Object.values(pages)[0] as any;

  if (!page || 'missing' in page) return null;

  // MediaWiki の revisions は `*` フィールドにコンテンツを返す
  return (
    page?.revisions?.[0]?.['*'] ??
    page?.revisions?.[0]?.slots?.main?.['*'] ??
    null
  );
}

// ── メイン取得関数 ────────────────────────────────────

/**
 * チャンピオンの Q/W/E/R スキルの leveling データを Wiki から取得する。
 *
 * @param championId  DDragon の champion ID（例: "Ashe"）
 * @param spells      スペル情報配列（key='Q'|'W'|'E'|'R', name=英語スペル名, maxrank=最大ランク数）
 * @returns           スペルキー → WikiSpellData のマップ
 */
export async function fetchWikiChampionSpells(
  championId: string,
  spells: Array<{ key: string; name: string; maxrank: number }>,
): Promise<WikiChampionSpells | null> {
  const cacheKey = `${CACHE_PREFIX}${championId}`;
  const cached   = readCache<WikiChampionSpells>(cacheKey);
  // 空のキャッシュ（以前の取得が失敗した場合）は無視して再取得する
  if (cached && Object.keys(cached).length > 0) return cached;

  const wikiName = toWikiName(championId);
  const result: WikiChampionSpells = {};

  await Promise.all(
    spells.map(async ({ key, name, maxrank }) => {
      // スペルキー（例: "W"）でまずアクセス → リダイレクト経由でスペル名に到達
      const titleByKey  = `Template:Data_${wikiName}/${key}`;
      let wikitext = await fetchWikitext(titleByKey).catch(() => null);

      // キーで見つからない場合はスペル名で直接アクセス
      if (!wikitext) {
        const titleByName = `Template:Data_${wikiName}/${name}`;
        wikitext = await fetchWikitext(titleByName).catch(() => null);
      }

      if (!wikitext) return;

      // ── DEBUG: wikitextのパラメータ行を確認 ──────────────────
      if (key === 'E') {
        const paramLines = wikitext.split('\n')
          .filter(l => /^\s*\|/.test(l) && !/leveling|description|notes|plaintext/i.test(l))
          .join('\n');
        console.group(`[WIKI-DBG] ${key}: ${name}`);
        console.log('param lines:\n', paramLines);
        console.log('full wikitext:\n', wikitext);
        console.groupEnd();
      }
      // ──────────────────────────────────────────────────────────

      const leveling  = parseLeveling(wikitext, maxrank);
      const constants = parseConstants(wikitext);
      if (leveling.length > 0 || Object.keys(constants).length > 0) {
        result[key] = {
          leveling,
          ...(Object.keys(constants).length > 0 ? { constants } : {}),
        };
      }
    }),
  );

  // 結果が空の場合はキャッシュしない（次回ロード時に再取得できるように）
  if (Object.keys(result).length > 0) {
    writeCache(cacheKey, result);
  }
  return result;
}
