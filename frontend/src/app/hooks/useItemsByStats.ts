import { useState, useEffect } from 'react';
import { getLatestVersion, fetchItemList, itemImageUrl } from '../api/dataDragon';

export interface ItemStatLine {
  label: string;
  value: string;
}

export interface ItemSummary {
  id: string;
  name: string;
  imageUrl: string;
  stats: ItemStatLine[];
}

const STAT_LABELS: Record<string, string> = {
  FlatPhysicalDamageMod:      '攻撃力',
  FlatMagicDamageMod:         '魔力',
  FlatArmorMod:               'アーマー',
  FlatSpellBlockMod:          '魔法防御',
  FlatHPPoolMod:              '体力',
  FlatMPPoolMod:              'マナ',
  FlatMovementSpeedMod:       '移動速度',
  FlatCritChanceMod:          'クリティカル率',
  PercentAttackSpeedMod:      '攻撃速度',
  PercentLifeStealMod:        'ライフスティール',
  FlatHPRegenMod:             '体力回復',
  FlatMPRegenMod:             'マナ回復',
  PercentMovementSpeedMod:    '移動速度%',
  FlatGoldPer10Mod:           'ゴールド/10s',
  FlatArmorPenetrationMod:    'アーマー貫通',
  PercentArmorPenetrationMod: 'アーマー貫通%',
};

function formatStatValue(key: string, val: number): string {
  if (key.startsWith('Percent') || key === 'FlatCritChanceMod') {
    return `${Math.round(val * 100)}%`;
  }
  return String(Math.round(val));
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
          const statLines: ItemStatLine[] = Object.entries(item.stats)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => ({
              label: STAT_LABELS[k] ?? k,
              value: formatStatValue(k, v),
            }));

          const summary: ItemSummary = {
            id,
            name: item.name,
            imageUrl: itemImageUrl(v, item.image.full),
            stats: statLines,
          };

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
