/**
 * アプリ共通の型定義
 * データはすべて Data Dragon API から取得します（api/dataDragon.ts）
 */

export type Role = 'Mage' | 'Tank' | 'Assassin' | 'Fighter' | 'Support' | 'Marksman';
export type ItemType = 'Fighter' | 'Marksman' | 'Assassin' | 'Magic' | 'Defense' | 'Support';
export type TabType = 'champions' | 'items';

/** チャンピオン（カード表示用） */
export interface Champion {
  id: string;
  name: string;
  role: Role;
  icon: string;
}

/** アイテム（カード表示用） */
export interface Item {
  id: string;
  name: string;
  type: ItemType;
  icon: string;
  statTags: string[];
  /** undefined = SR通常アイテム、'aram' = ランダムMID専用 */
  mapMode?: 'aram';
}
