/**
 * アプリ共通の型定義
 * データはすべて Data Dragon API から取得します（api/dataDragon.ts）
 */

export type Role = 'Mage' | 'Tank' | 'Assassin' | 'Fighter' | 'Support' | 'Marksman';
export type ItemType = 'Fighter' | 'Marksman' | 'Assassin' | 'Magic' | 'Defense' | 'Support';
export type TabType = 'all' | 'champions' | 'items';

/** チャンピオン（カード表示用） */
export interface Champion {
  id: string;       // "Ahri"（ルーティングにも使用）
  name: string;     // "Ahri"
  role: Role;
  icon: string;     // Data Dragon CDN の画像URL
}

/** アイテム（カード表示用） */
export interface Item {
  id: string;       // Data Dragon のアイテムID（例: "3031"）
  name: string;     // "Infinity Edge"
  type: ItemType;
  icon: string;     // Data Dragon CDN の画像URL
}
