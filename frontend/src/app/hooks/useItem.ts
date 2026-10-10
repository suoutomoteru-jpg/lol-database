import { useState, useEffect } from 'react';
import { getLatestVersion, fetchAllItemsRaw, fetchItemEnNames, itemImageUrl } from '../api/dataDragon';
import { fetchItemDescFixes } from '../api/itemFixes';

export interface ItemDetailData {
  id: string;
  name: string;
  englishName: string;
  description: string;
  gold: { base: number; total: number; sell: number };
  stats: Record<string, number>;
  tags: string[];
  imageUrl: string;
  from: Array<{ id: string; name: string; imageUrl: string; gold: number }>;
  into: Array<{ id: string; name: string; imageUrl: string; gold: number }>;
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
        const [allItems, enNames, descFixes] = await Promise.all([
          fetchAllItemsRaw(v),
          fetchItemEnNames(v),
          fetchItemDescFixes(),
        ]);
        if (cancelled) return;

        const raw = allItems[itemId!];
        if (!raw) throw new Error(`Item not found: ${itemId}`);

        const resolve = (id: string) => {
          const it = allItems[id];
          if (!it) return null;
          return { id, name: it.name, imageUrl: itemImageUrl(v, it.image.full), gold: it.gold.total };
        };

        setItem({
          id: itemId!,
          name: raw.name,
          englishName: enNames[itemId!] ?? '',
          // Riot配信データの動的数値欠落（0/空欄）はCI生成の修正版で差し替える
          description: descFixes[itemId!] ?? raw.description,
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
