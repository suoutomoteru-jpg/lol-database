import { useState, useEffect } from 'react';
import { getLatestVersion, fetchAllItemsRaw, itemImageUrl } from '../api/dataDragon';

export interface ItemDetailData {
  id: string;
  name: string;
  description: string;
  gold: { base: number; total: number; sell: number };
  stats: Record<string, number>;
  tags: string[];
  imageUrl: string;
  from: Array<{ id: string; name: string; imageUrl: string }>;
  into: Array<{ id: string; name: string; imageUrl: string }>;
  version: string;
}

interface UseItemResult {
  item: ItemDetailData | null;
  loading: boolean;
  error: Error | null;
}

export function useItem(itemId: string | undefined): UseItemResult {
  const [item, setItem] = useState<ItemDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;

    setItem(null);
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const v = await getLatestVersion();
        const allItems = await fetchAllItemsRaw(v);
        if (cancelled) return;

        const raw = allItems[itemId!];
        if (!raw) throw new Error(`Item not found: ${itemId}`);

        const resolve = (id: string) => {
          const it = allItems[id];
          if (!it) return null;
          return { id, name: it.name, imageUrl: itemImageUrl(v, it.image.full) };
        };

        setItem({
          id: itemId!,
          name: raw.name,
          description: raw.description,
          gold: raw.gold,
          stats: raw.stats,
          tags: raw.tags,
          imageUrl: itemImageUrl(v, raw.image.full),
          from: (raw.from ?? []).map(resolve).filter((x): x is NonNullable<typeof x> => x !== null),
          into: (raw.into ?? []).map(resolve).filter((x): x is NonNullable<typeof x> => x !== null),
          version: v,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [itemId]);

  return { item, loading, error };
}
