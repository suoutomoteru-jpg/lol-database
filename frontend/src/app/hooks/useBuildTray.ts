/**
 * ビルドトレイのグローバルストア（localStorage永続・最大6枠）
 *
 * ページを跨いでも保持され、どのコンポーネントからも
 * useBuildTray() で同じ状態を購読できる。
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lol-db:build-tray';
export const MAX_SLOTS = 6;

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_SLOTS);
  } catch {
    return [];
  }
}

let ids: string[] = load();
const listeners = new Set<() => void>();

function commit(next: string[]) {
  ids = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* 保存失敗時もメモリ上では動作継続 */ }
  listeners.forEach(l => l());
}

export function addToTray(id: string): boolean {
  if (ids.length >= MAX_SLOTS || ids.includes(id)) return false;
  commit([...ids, id]);
  return true;
}

export function removeFromTray(id: string): void {
  if (!ids.includes(id)) return;
  commit(ids.filter(x => x !== id));
}

export function clearTray(): void {
  if (ids.length === 0) return;
  commit([]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBuildTray(): string[] {
  return useSyncExternalStore(subscribe, () => ids, () => ids);
}
