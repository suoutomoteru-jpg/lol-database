import { useState, useEffect } from 'react';
import { getLatestVersion, fetchItemList, itemImageUrl } from '../api/dataDragon';
import { mapItemType } from '../utils/itemType';
import type { Item } from '../data/mock-data';

interface UseItemsResult {
  items: Item[];
  loading: boolean;
  error: Error | null;
}

export function useItems(): UseItemsResult {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const v = await getLatestVersion();
        const raw = await fetchItemList(v);

        if (cancelled) return;

        const list: Item[] = raw
          .map(([id, item]) => ({
            id,
            name: item.name,
            type: mapItemType(item.tags),
            icon: itemImageUrl(v, item.image.full),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setItems(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { items, loading, error };
}
