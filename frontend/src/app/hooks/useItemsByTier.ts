import { useState, useEffect } from 'react';
import {
  getLatestVersion, fetchItemListTier1, fetchItemListTier2, fetchItemEnNames, itemImageUrl,
} from '../api/dataDragon';
import { mapItemType } from '../utils/itemType';
import { toPlainText } from '../utils/richText';
import type { Item } from '../types/app';
import type { DDragonItem } from '../types/ddragon';

interface UseItemsByTierResult {
  tier1: Item[];
  tier2: Item[];
  loading: boolean;
  error: Error | null;
}

/** 基本コンポーネント(Tier1)・中間コンポーネント(Tier2)。既定は非表示（展開で表示）。 */
export function useItemsByTier(): UseItemsByTierResult {
  const [tier1, setTier1] = useState<Item[]>([]);
  const [tier2, setTier2] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const v = await getLatestVersion();
        const [raw1, raw2, enNames] = await Promise.all([
          fetchItemListTier1(v), fetchItemListTier2(v), fetchItemEnNames(v),
        ]);

        if (cancelled) return;

        const makeItem = (id: string, item: DDragonItem): Item => ({
          id,
          name: item.name,
          enName: enNames[id],
          type: mapItemType(item.tags, toPlainText(item.description), enNames[id]),
          icon: itemImageUrl(v, item.image.full),
          statTags: [],
        });

        const sortByName = (list: [string, DDragonItem][]) =>
          list.map(([id, item]) => makeItem(id, item)).sort((a, b) => a.name.localeCompare(b.name));

        setTier1(sortByName(raw1));
        setTier2(sortByName(raw2));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { tier1, tier2, loading, error };
}
