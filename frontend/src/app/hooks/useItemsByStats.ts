import { useState, useEffect } from 'react';
import { getLatestVersion, fetchItemList, itemImageUrl } from '../api/dataDragon';

export interface ItemSummary {
  id: string;
  name: string;
  imageUrl: string;
}

/**
 * "stat:FlatMagicDamageMod" / "tag:AbilityHaste" → アイテム一覧（名前順）
 */
export function useItemsByStats(): Map<string, ItemSummary[]> {
  const [statMap, setStatMap] = useState<Map<string, ItemSummary[]>>(new Map());

  useEffect(() => {
    async function load() {
      try {
        const v = await getLatestVersion();
        const items = await fetchItemList(v);
        const result = new Map<string, ItemSummary[]>();

        const add = (key: string, summary: ItemSummary) => {
          if (!result.has(key)) result.set(key, []);
          result.get(key)!.push(summary);
        };

        for (const [id, item] of items) {
          const summary: ItemSummary = { id, name: item.name, imageUrl: itemImageUrl(v, item.image.full) };
          for (const [key, val] of Object.entries(item.stats)) {
            if (val) add(`stat:${key}`, summary);
          }
          for (const tag of item.tags ?? []) {
            add(`tag:${tag}`, summary);
          }
        }

        for (const list of result.values()) {
          list.sort((a, b) => a.name.localeCompare(b.name));
        }
        setStatMap(result);
      } catch { /* silent */ }
    }
    load();
  }, []);

  return statMap;
}
