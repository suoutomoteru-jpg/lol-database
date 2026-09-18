import { useMemo } from 'react';
import { matchesQuery } from '../utils/search';
import type { Champion, Item } from '../types/app';

export interface CrossSearchResult {
  kind: 'champion' | 'item';
  id: string;
  name: string;
  icon: string;
}

const MAX_RESULTS = 7;

/** チャンピオン・アイテムを横断した検索候補（HeaderSearch・Home検索共通） */
export function useCrossSearchResults(
  query: string,
  champions: Champion[],
  items: Item[],
): CrossSearchResult[] {
  return useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const champHits: CrossSearchResult[] = champions
      .filter(c => matchesQuery(q, c.name, c.id))
      .map(c => ({ kind: 'champion', id: c.id, name: c.name, icon: c.icon }));
    const itemHits: CrossSearchResult[] = items
      .filter(i => matchesQuery(q, i.name, i.enName))
      .map(i => ({ kind: 'item', id: i.id, name: i.name, icon: i.icon }));
    // 前方一致を優先
    const ql = q.toLowerCase();
    const rank = (name: string) => (name.toLowerCase().startsWith(ql) ? 0 : 1);
    return [...champHits, ...itemHits]
      .sort((a, b) => rank(a.name) - rank(b.name))
      .slice(0, MAX_RESULTS);
  }, [query, champions, items]);
}
