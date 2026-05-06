import { useState, useEffect } from 'react';
import { getLatestVersion, fetchItemList, fetchItemListAram, itemImageUrl } from '../api/dataDragon';
import { mapItemType } from '../utils/itemType';
import type { Item } from '../data/mock-data';

// Priority-ordered (user-specified order + Crit/AS added)
type TagEntry =
  | { key: string; abbr: string }
  | { key: string; abbr: string; isTag: true }
  | { key: string; abbr: string; isDesc: true };

const STAT_TAG_MAP: TagEntry[] = [
  { key: 'FlatPhysicalDamageMod',      abbr: 'AD' },
  { key: 'FlatMagicDamageMod',         abbr: 'AP' },
  { key: 'AbilityHaste',               abbr: 'SH',  isTag: true },
  { key: 'FlatCritChanceMod',          abbr: 'Crit' },
  { key: 'PercentAttackSpeedMod',      abbr: 'AS' },
  { key: 'FlatArmorMod',               abbr: 'AR' },
  { key: 'FlatSpellBlockMod',          abbr: 'MR' },
  { key: 'FlatMPRegenMod',             abbr: 'MReg' },
  { key: 'FlatHPRegenMod',             abbr: 'HReg' },
  { key: 'FlatHPPoolMod',              abbr: 'HP' },
  { key: 'Tenacity',                   abbr: 'Tenacity', isTag: true },
  { key: 'FlatMPPoolMod',              abbr: 'Mana' },
  { key: 'FlatMovementSpeedMod',       abbr: 'MS' },
  { key: 'PercentMovementSpeedMod',    abbr: 'MS' },
  // % armor pen — stat-based first, then description fallback
  { key: 'PercentArmorPenetrationMod', abbr: 'APen' },
  { key: '物理防御貫通',               abbr: 'APen', isDesc: true },
  // magic pen — stat-based first, then description fallback
  { key: 'FlatMagicPenetrationMod',    abbr: 'MPen' },
  { key: 'PercentMagicPenetrationMod', abbr: 'MPen' },
  { key: '魔法防御貫通',               abbr: 'MPen', isDesc: true },
  // lethality (flat armor pen)
  { key: 'FlatArmorPenetrationMod',    abbr: 'Lethal' },
  { key: '脅威',                       abbr: 'Lethal', isDesc: true },
];

function computeStatTags(
  stats: Record<string, number>,
  tags: string[],
  description: string,
): string[] {
  const tagSet = new Set(tags);
  const plainDesc = description.replace(/<[^>]+>/g, '');
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of STAT_TAG_MAP) {
    if (seen.has(entry.abbr)) continue;
    let has = false;
    if ('isTag' in entry)  has = tagSet.has(entry.key);
    else if ('isDesc' in entry) has = new RegExp(entry.key).test(plainDesc);
    else has = !!stats[entry.key] && stats[entry.key] !== 0;

    if (has) { result.push(entry.abbr); seen.add(entry.abbr); }
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
        const [raw, rawAram] = await Promise.all([fetchItemList(v), fetchItemListAram(v)]);

        if (cancelled) return;

        const toItem = (mapMode?: 'aram') => ([id, item]: [string, import('../types/ddragon').DDragonItem]): Item => ({
          id,
          name: item.name,
          type: mapItemType(item.tags),
          icon: itemImageUrl(v, item.image.full),
          statTags: computeStatTags(item.stats, item.tags, item.description),
          ...(mapMode ? { mapMode } : {}),
        });

        const list: Item[] = [
          ...raw.map(toItem()),
          ...rawAram.map(toItem('aram')),
        ].sort((a, b) => a.name.localeCompare(b.name));

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
