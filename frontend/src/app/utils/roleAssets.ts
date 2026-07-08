/**
 * LoL 公式クライアントのクラス（ロール）アイコンと日本語ラベル
 *
 * アイコンは CommunityDragon がミラーする実クライアントアセット:
 *   plugins/rcp-fe-lol-champion-details/global/default/role-icon-{class}.png
 */
import type { Role, ItemType } from '../types/app';

const CDRAGON_CHAMP_DETAILS =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champion-details/global/default';

export function roleIconUrl(role: Role): string {
  return `${CDRAGON_CHAMP_DETAILS}/role-icon-${role.toLowerCase()}.png`;
}

/** アイテムカテゴリ → 最も近いクラスアイコン */
const CLASS_OF_ITEM_TYPE: Record<ItemType, string> = {
  Fighter:  'fighter',
  Marksman: 'marksman',
  Assassin: 'assassin',
  Magic:    'mage',
  Defense:  'tank',
  Support:  'support',
};

export function itemTypeIconUrl(type: ItemType): string {
  return `${CDRAGON_CHAMP_DETAILS}/role-icon-${CLASS_OF_ITEM_TYPE[type]}.png`;
}

export const ROLE_LABELS_JA: Record<Role, string> = {
  Mage:     'メイジ',
  Tank:     'タンク',
  Assassin: 'アサシン',
  Fighter:  'ファイター',
  Support:  'サポート',
  Marksman: 'マークスマン',
};

export const ITEM_TYPE_LABELS_JA: Record<ItemType, string> = {
  Fighter:  'ファイター',
  Marksman: 'マークスマン',
  Assassin: 'アサシン',
  Magic:    'メイジ',
  Defense:  '防御',
  Support:  'サポート',
};
