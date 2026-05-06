/**
 * Riot Data Dragon API クライアント
 *
 * キャッシュ戦略:
 *   - バージョン情報: 1時間ごとに再確認
 *   - チャンピオン/アイテムデータ: バージョンが変わるまで永続キャッシュ
 *   - パッチが上がると古いキャッシュを自動削除して再取得
 */

import type {
  DDragonChampionListResponse,
  DDragonChampionDetailResponse,
  DDragonChampionSummary,
  DDragonChampionDetail,
  DDragonItem,
} from '../types/ddragon';

const BASE_URL = 'https://ddragon.leagueoflegends.com';
const LOCALE = 'ja_JP';
const VERSION_CACHE_KEY = 'lol-db:version';
const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // 1時間

// ── キャッシュ操作 ─────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota exceeded → 古いキャッシュをクリアして再試行
    purgeLolCache();
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // それでも失敗した場合はスキップ（キャッシュなしで動作継続）
    }
  }
}

function purgeLolCache(): void {
  const targets: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('lol-db:')) targets.push(k);
  }
  targets.forEach(k => localStorage.removeItem(k));
}

function purgeVersionedCache(version: string): void {
  // ロケール付きのキー・旧フォーマットのキー両方を削除
  const prefixes = [`lol-db:${LOCALE}:${version}:`, `lol-db:${version}:`];
  const targets: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && prefixes.some(p => k.startsWith(p))) targets.push(k);
  }
  targets.forEach(k => localStorage.removeItem(k));
}

// ロケールをキーに含める（ロケール変更時に別キャッシュを参照するため）
function dataKey(version: string, key: string): string {
  return `lol-db:${LOCALE}:${version}:${key}`;
}

// ── バージョン取得 ─────────────────────────────────────

interface VersionCache {
  version: string;
  checkedAt: number;
}

/**
 * 最新バージョンを取得（1時間ごとにAPIを確認）
 * パッチが変わった場合は古いキャッシュを自動削除
 */
export async function getLatestVersion(): Promise<string> {
  const cached = readCache<VersionCache>(VERSION_CACHE_KEY);
  if (cached && Date.now() - cached.checkedAt < VERSION_CHECK_INTERVAL) {
    return cached.version;
  }

  const versions: string[] = await fetch(`${BASE_URL}/api/versions.json`).then(r => {
    if (!r.ok) throw new Error(`versions.json fetch failed: ${r.status}`);
    return r.json();
  });

  const latest = versions[0];

  // バージョンが変わっていたら古いデータキャッシュを削除
  if (cached && cached.version !== latest) {
    purgeVersionedCache(cached.version);
  }

  writeCache<VersionCache>(VERSION_CACHE_KEY, { version: latest, checkedAt: Date.now() });
  return latest;
}

// ── 画像URL生成（Data Dragon CDN）─────────────────────

export function championImageUrl(version: string, championId: string): string {
  return `${BASE_URL}/cdn/${version}/img/champion/${championId}.png`;
}

// fileName は item.image.full の値（例: "3031.png"）
export function itemImageUrl(version: string, fileName: string): string {
  return `${BASE_URL}/cdn/${version}/img/item/${fileName}`;
}

// fileName は spell.image.full の値（例: "AhriOrbofDeception.png"）
// .png はすでに含まれているので追加しない
export function spellImageUrl(version: string, fileName: string): string {
  return `${BASE_URL}/cdn/${version}/img/spell/${fileName}`;
}

export function passiveImageUrl(version: string, fileName: string): string {
  return `${BASE_URL}/cdn/${version}/img/passive/${fileName}`;
}

// ── チャンピオン一覧 ────────────────────────────────────

export async function fetchChampionList(version: string): Promise<Record<string, DDragonChampionSummary>> {
  const key = dataKey(version, 'champions');
  const cached = readCache<Record<string, DDragonChampionSummary>>(key);
  if (cached) return cached;

  const url = `${BASE_URL}/cdn/${version}/data/${LOCALE}/champion.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`champion.json fetch failed: ${res.status}`);

  const json: DDragonChampionListResponse = await res.json();
  writeCache(key, json.data);
  return json.data;
}

// ── チャンピオン詳細 ────────────────────────────────────

export async function fetchChampionDetail(version: string, championId: string): Promise<DDragonChampionDetail> {
  const key = dataKey(version, `champion:${championId}`);
  const cached = readCache<DDragonChampionDetail>(key);
  if (cached) return cached;

  const url = `${BASE_URL}/cdn/${version}/data/${LOCALE}/champion/${championId}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`champion/${championId}.json fetch failed: ${res.status}`);

  const json: DDragonChampionDetailResponse = await res.json();
  const data = json.data[championId];
  if (!data) throw new Error(`Champion not found: ${championId}`);

  writeCache(key, data);
  return data;
}

// ── アイテム全件（生データ）────────────────────────────

/**
 * item.json の全アイテムをフィルタなしで返す（ビルドパス参照用）
 */
export async function fetchAllItemsRaw(version: string): Promise<Record<string, DDragonItem>> {
  const key = dataKey(version, 'items-all');
  const cached = readCache<Record<string, DDragonItem>>(key);
  if (cached) return cached;

  const url = `${BASE_URL}/cdn/${version}/data/${LOCALE}/item.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`item.json fetch failed: ${res.status}`);

  const json = await res.json() as { data: Record<string, DDragonItem> };
  writeCache(key, json.data);
  return json.data;
}

// ── アイテム一覧 ────────────────────────────────────────

function deduplicateByName(entries: [string, DDragonItem][]): [string, DDragonItem][] {
  const nameMap = new Map<string, [string, DDragonItem]>();
  for (const entry of entries) {
    const [id, item] = entry;
    const existing = nameMap.get(item.name);
    if (!existing || parseInt(id) < parseInt(existing[0])) {
      nameMap.set(item.name, entry);
    }
  }
  return Array.from(nameMap.values());
}

/**
 * 完成アイテムのみ返す（コンポーネント・特殊アイテム除外）
 * 条件: 購入可能 & SR対応 & 合計コスト2000G以上 & チャンピオン専用でない
 */
export async function fetchItemList(version: string): Promise<[string, DDragonItem][]> {
  const key = dataKey(version, 'items');
  const cached = readCache<[string, DDragonItem][]>(key);
  if (cached) return cached;

  const allItems = await fetchAllItemsRaw(version);
  const filtered = Object.entries(allItems).filter(([, item]) =>
    item.gold.purchasable &&
    item.gold.total >= 2000 &&
    item.maps?.['11'] === true &&
    !item.requiredChampion &&
    item.inStore !== false,
  );
  const result = deduplicateByName(filtered);
  writeCache(key, result);
  return result;
}

// ── ARAM専用アイテム一覧 ─────────────────────────────────

/**
 * ランダムMID（ARAM）専用アイテムを返す。
 * 条件: 購入可能 & ハウリングアビス対応(map12) & SRには非対応(map11≠true) & 合計コスト2000G以上
 */
export async function fetchItemListAram(version: string): Promise<[string, DDragonItem][]> {
  const key = dataKey(version, 'items-aram');
  const cached = readCache<[string, DDragonItem][]>(key);
  if (cached) return cached;

  const allItems = await fetchAllItemsRaw(version);
  const filtered = Object.entries(allItems).filter(([, item]) =>
    item.gold.purchasable &&
    item.gold.total >= 2000 &&
    item.maps?.['12'] === true &&
    item.maps?.['11'] !== true &&
    !item.requiredChampion &&
    item.inStore !== false,
  );
  const result = deduplicateByName(filtered);
  writeCache(key, result);
  return result;
}

// ── アイテム英語名マップ ────────────────────────────────

export async function fetchItemEnNames(version: string): Promise<Record<string, string>> {
  const key = `lol-db:en_US:${version}:item-names`;
  const cached = readCache<Record<string, string>>(key);
  if (cached) return cached;

  const url = `${BASE_URL}/cdn/${version}/data/en_US/item.json`;
  const res = await fetch(url);
  if (!res.ok) return {};

  const json = await res.json() as { data: Record<string, { name: string }> };
  const names: Record<string, string> = {};
  for (const [id, item] of Object.entries(json.data)) {
    names[id] = item.name;
  }
  writeCache(key, names);
  return names;
}

// ── アイテム一覧（700G以上）──────────────────────────────

export async function fetchItemListMedium(version: string): Promise<[string, DDragonItem][]> {
  const key = dataKey(version, 'items-medium');
  const cached = readCache<[string, DDragonItem][]>(key);
  if (cached) return cached;

  const allItems = await fetchAllItemsRaw(version);
  const filtered = Object.entries(allItems).filter(([, item]) =>
    item.gold.purchasable &&
    item.gold.total >= 700 &&
    item.maps?.['11'] === true &&
    !item.requiredChampion &&
    item.inStore !== false,
  );
  const result = deduplicateByName(filtered);
  writeCache(key, result);
  return result;
}
