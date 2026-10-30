/**
 * DDragon の champion ID → 英語表示名の変換
 *
 * DDragon は ID にスペースや記号を含まない（例: "KogMaw", "DrMundo"）が、
 * 表示には本来の英語表記（例: "Kog'Maw", "Dr. Mundo"）を使いたい。
 */
export function englishChampionName(ddId: string): string {
  const SPECIAL: Record<string, string> = {
    // スペース区切り
    AurelionSol:  'Aurelion Sol',
    DrMundo:      'Dr. Mundo',
    JarvanIV:     'Jarvan IV',
    LeeSin:       'Lee Sin',
    MasterYi:     'Master Yi',
    MissFortune:  'Miss Fortune',
    RenataGlasc:  'Renata Glasc',
    Renata:       'Renata Glasc',
    TahmKench:    'Tahm Kench',
    TwistedFate:  'Twisted Fate',
    XinZhao:      'Xin Zhao',
    // アポストロフィ
    Belveth:      "Bel'Veth",
    BelVeth:      "Bel'Veth",
    Chogath:      "Cho'Gath",
    Kaisa:        "Kai'Sa",
    Khazix:       "Kha'Zix",
    KogMaw:       "Kog'Maw",
    Ksante:       "K'Sante",
    RekSai:       "Rek'Sai",
    Velkoz:       "Vel'Koz",
    // DDragon 独自 ID → 現在の名前
    MonkeyKing:   'Wukong',
    Nunu:         'Nunu & Willump',
    NunuWillump:  'Nunu & Willump',
    // フルネームが必要なチャンピオン
    Ambessa:      'Ambessa Medarda',
  };
  return SPECIAL[ddId] ?? ddId;
}
