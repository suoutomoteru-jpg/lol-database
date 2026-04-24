import { useState, useEffect } from 'react';
import { getLatestVersion, fetchItemList, itemImageUrl } from '../api/dataDragon';
import { mapItemType } from '../utils/itemType';
import type { Item } from '../data/mock-data';

// Priority-ordered stat tag definitions (user-specified order)
const STAT_TAG_MAP: Array<{ key: string; abbr: string; isTag?: boolean }> = [
  { key: 'FlatPhysicalDamageMod',      abbr: 'AD' },
  { key: 'FlatMagicDamageMod',         abbr: 'AP' },
  { key: 'AbilityHaste',               abbr: 'SH',      isTag: true },
  { key: 'FlatArmorMod',               abbr: 'AR' },
  { key: 'FlatSpellBlockMod',          abbr: 'MR' },
  { key: 'FlatMPRegenMod',             abbr: 'MReg' },
  { key: 'FlatHPRegenMod',             abbr: 'HReg' },
  { key: 'FlatHPPoolMod',              abbr: 'HP' },
  { key: 'Tenacity',                   abbr: 'Tenacity', isTag: true },
  { key: 'FlatMPPoolMod',              abbr: 'Mana' },
  { key: 'FlatMovementSpeedMod',       abbr: 'MS' },
  { key: 'PercentMovementSpeedMod',    abbr: 'MS' },
  { key: 'PercentArmorPenetrationMod', abbr: 'APen' },
  { key: 'FlatMagicPenetrationMod',    abbr: 'MPen' },
  { key: 'PercentMagicPenetrationMod', abbr: 'MPen' },
  { key: 'FlatArmorPenetrationMod',    abbr: 'Lethal' },
];

function computeStatTags(stats: Record<string, number>, tags: string[]): string[] {
  const tagSet = new Set(tags);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { key, abbr, isTag } of STAT_TAG_MAP) {
    if (seen.has(abbr)) continue;
    const has = isTag ? tagSet.has(key) : (!!stats[key] && stats[key] !== 0);
    if (has) { result.push(abbr); seen.add(abbr); }
  }
  return result;
}

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
            statTags: computeStatTags(item.stats, item.tags),
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
