import { useState, useEffect } from 'react';
import { getLatestVersion, fetchItemList, fetchItemListMedium, itemImageUrl } from '../api/dataDragon';
import { STAT_DEFS, itemHasStat } from '../utils/stats';
import type { DDragonItem } from '../types/ddragon';

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

export const STAT_LABELS: Record<string, string> = {
  FlatPhysicalDamageMod:         '攻撃力',
  FlatMagicDamageMod:            '魔力',
  FlatArmorMod:                  'AR',
  FlatSpellBlockMod:             '魔法防御',
  FlatHPPoolMod:                 '体力',
  FlatMPPoolMod:                 'マナ',
  FlatMovementSpeedMod:          '移動速度',
  FlatCritChanceMod:             'クリティカル率',
  PercentCritDamageMod:          'クリティカルダメージ',
  PercentAttackSpeedMod:         '攻撃速度',
  PercentLifeStealMod:           'ライフスティール',
  PercentHealAndShieldPower:     'H&Sパワー',
  FlatHPRegenMod:                '体力回復',
  FlatMPRegenMod:                'マナ回復',
  PercentMovementSpeedMod:       '移動速度%',
  FlatGoldPer10Mod:              'ゴールド/10s',
  FlatArmorPenetrationMod:       '脅威',
  PercentArmorPenetrationMod:    'APen',
  FlatMagicPenetrationMod:       'MPen',
  PercentMagicPenetrationMod:    'MPen%',
  AbilityHaste:                  'スキルヘイスト',
};

export function formatStatValue(key: string, val: number): string {
  if (key.startsWith('Percent') || key === 'FlatCritChanceMod') {
    return `${Math.round(val * 100)}%`;
  }
  return String(Math.round(val));
}

function buildMap(version: string, items: [string, DDragonItem, ...unknown[]][]): Map<string, ItemSummary[]> {
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
      imageUrl: itemImageUrl(version, item.image.full),
      stats: statLines,
    };

    // ステータス台帳（utils/stats.ts）に基づいて逆引きマップを構築する
    const tags = item.tags ?? [];
    const plainDesc = item.description.replace(/<[^>]+>/g, '');
    for (const def of STAT_DEFS) {
      if (itemHasStat(def, item.stats, tags, plainDesc)) add(def.key, summary);
    }
  }

  for (const list of result.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

export interface ItemStatMaps {
  statMap: Map<string, ItemSummary[]>;
  mediumStatMap: Map<string, ItemSummary[]>;
}

/**
 * statMap:       2000G以上の完成アイテム
 * mediumStatMap: 700G以上のアイテム（コンポーネント含む）
 */
export function useItemsByStats(): ItemStatMaps {
  const [maps, setMaps] = useState<ItemStatMaps>({
    statMap: new Map(),
    mediumStatMap: new Map(),
  });

  useEffect(() => {
    async function load() {
      try {
        const v = await getLatestVersion();
        const [items, mediumItems] = await Promise.all([
          fetchItemList(v),
          fetchItemListMedium(v),
        ]);
        setMaps({
          statMap: buildMap(v, items),
          mediumStatMap: buildMap(v, mediumItems),
        });
      } catch { /* silent */ }
    }
    load();
  }, []);

  return maps;
}
