// =====================================================
// Riot Data Dragon API 型定義
// =====================================================

export interface DDragonImage {
  full: string;    // "Ahri.png"
  sprite: string;  // "champion0.png"
  group: string;   // "champion" | "item" | "spell" | "passive"
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DDragonStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  movespeed: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackrange: number;
  hpregen: number;
  hpregenperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  crit: number;
  critperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeedperlevel: number;
  attackspeed: number;
}

// champion.json（一覧）の各チャンピオン
export interface DDragonChampionSummary {
  version: string;
  id: string;         // "Ahri"
  key: string;        // "103"
  name: string;       // "Ahri"
  title: string;      // "the Nine-Tailed Fox"
  blurb: string;
  info: {
    attack: number;
    defense: number;
    magic: number;
    difficulty: number;
  };
  image: DDragonImage;
  tags: string[];     // ["Mage", "Assassin"]
  partype: string;    // "Mana" | "Energy" | "None"
  stats: DDragonStats;
}

// spell（Q/W/E/R）
export interface DDragonSpell {
  id: string;             // "AhriOrbofDeception"
  name: string;
  description: string;    // HTML含む場合あり
  tooltip: string;
  leveltip: {
    label: string[];
    effect: string[];
  };
  maxrank: number;
  cooldown: number[];
  cooldownBurn: string;   // "6/5.5/5/4.5/4"
  cost: number[];
  costBurn: string;       // "70/75/80/85/90"
  costType: string;       // "Mana"
  maxammo: string;
  range: number[];
  rangeBurn: string;      // "880"
  image: DDragonImage;
  resource: string;
}

// passive（P）
export interface DDragonPassive {
  name: string;
  description: string;
  image: DDragonImage;
}

// champion/{id}.json（詳細）
export interface DDragonChampionDetail extends DDragonChampionSummary {
  lore: string;
  allytips: string[];
  enemytips: string[];
  passive: DDragonPassive;
  spells: DDragonSpell[];  // [Q, W, E, R] の4つ
  skins: Array<{ id: string; num: number; name: string; chromas: boolean }>;
}

// item.json の各アイテム
export interface DDragonItem {
  name: string;
  description: string;
  colloq: string;
  plaintext: string;
  into?: string[];
  from?: string[];
  image: DDragonImage;
  gold: {
    base: number;
    total: number;
    sell: number;
    purchasable: boolean;
  };
  tags: string[];
  maps: Record<string, boolean>;
  stats: Record<string, number>;
  depth?: number;
  requiredChampion?: string;
  inStore?: boolean;
}

// API レスポンスのラッパー
export interface DDragonChampionListResponse {
  type: string;
  format: string;
  version: string;
  data: Record<string, DDragonChampionSummary>;
}

export interface DDragonChampionDetailResponse {
  type: string;
  format: string;
  version: string;
  data: Record<string, DDragonChampionDetail>;
}

export interface DDragonItemListResponse {
  type: string;
  version: string;
  data: Record<string, DDragonItem>;
}
