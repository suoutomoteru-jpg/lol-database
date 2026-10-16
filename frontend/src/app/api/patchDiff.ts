/**
 * パッチ間のアイテム差分検出
 *
 * 前パッチの item.json と現行を比較して 新規/変更 アイテムを検出する。
 * 「久しぶりに開いたら何か変わっている」という再訪問の動機（新規性シグナル）用。
 *
 * 前パッチの item.json（数MB）自体は localStorage に保存せず、
 * 計算結果の差分（小さい）だけを `lol-db:item-diff:{prev}->{curr}` にキャッシュする。
 */

import { fetchAllItemsRaw } from './dataDragon';
import type { DDragonItem } from '../types/ddragon';

const BASE_URL = 'https://ddragon.leagueoflegends.com';
const LOCALE = 'ja_JP';
const DIFF_KEY_PREFIX = 'lol-db:item-diff:';

export type ItemChange = 'new' | 'changed';

export interface ItemPatchDiff {
  patch: string;
  prevPatch: string;
  changes: Record<string, ItemChange>;
}

/** 差分判定に使う最小限のフィールド */
export interface DiffableItem {
  gold: { total: number };
  stats: Record<string, number>;
  description: string;
}

/** 純粋な差分計算（テスト対象） */
export function diffItems(
  curr: Record<string, DiffableItem>,
  prev: Record<string, DiffableItem>,
): Record<string, ItemChange> {
  const changes: Record<string, ItemChange> = {};
  for (const [id, item] of Object.entries(curr)) {
    const old = prev[id];
    if (!old) {
      changes[id] = 'new';
      continue;
    }
    if (
      old.gold.total !== item.gold.total ||
      old.description !== item.description ||
      JSON.stringify(old.stats) !== JSON.stringify(item.stats)
    ) {
      changes[id] = 'changed';
    }
  }
  return changes;
}

async function fetchVersionPair(): Promise<[string, string] | null> {
  const versions: string[] = await fetch(`${BASE_URL}/api/versions.json`).then(r => {
    if (!r.ok) throw new Error(`versions.json fetch failed: ${r.status}`);
    return r.json();
  });
  if (versions.length < 2) return null;
  return [versions[0], versions[1]];
}

function readDiffCache(key: string): ItemPatchDiff | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ItemPatchDiff) : null;
  } catch {
    return null;
  }
}

function writeDiffCache(key: string, diff: ItemPatchDiff): void {
  try {
    // 古いパッチペアの差分キャッシュは削除
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(DIFF_KEY_PREFIX) && k !== key) stale.push(k);
    }
    stale.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(key, JSON.stringify(diff));
  } catch { /* キャッシュ失敗時は毎回再計算 */ }
}

/** 現行パッチのアイテム差分を取得する（失敗時は null で静かに無効化） */
export async function fetchItemPatchDiff(): Promise<ItemPatchDiff | null> {
  try {
    const pair = await fetchVersionPair();
    if (!pair) return null;
    const [curr, prev] = pair;

    const cacheKey = `${DIFF_KEY_PREFIX}${prev}->${curr}`;
    const cached = readDiffCache(cacheKey);
    if (cached) return cached;

    const [currItems, prevItems] = await Promise.all([
      fetchAllItemsRaw(curr),
      fetch(`${BASE_URL}/cdn/${prev}/data/${LOCALE}/item.json`)
        .then(r => {
          if (!r.ok) throw new Error(`prev item.json fetch failed: ${r.status}`);
          return r.json() as Promise<{ data: Record<string, DDragonItem> }>;
        })
        .then(j => j.data),
    ]);

    const diff: ItemPatchDiff = {
      patch: curr,
      prevPatch: prev,
      changes: diffItems(currItems, prevItems),
    };
    writeDiffCache(cacheKey, diff);
    return diff;
  } catch {
    return null;
  }
}
