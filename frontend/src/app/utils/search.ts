/**
 * チャンピオン/アイテム検索の一致判定。
 *
 * 日本語名の完全一致に加え、英語名（DDragon alias）と、
 * 日本語名をローマ字化したものにも一致させる。
 * 例: 「G」で Gangplank・Gnar がヒットし、「n」でGnarの日本語名
 * 「ナー」(→naa) もヒットする。
 *
 * ローマ字化はカタカナ/ひらがなのみ対応。漢字はローマ字化できない
 * （読みの情報がDDragonに無い）ため素通しする＝漢字を含む名前は
 * その漢字部分だけローマ字検索にヒットしない。日本語名・英語名での
 * 検索は引き続き効くので実用上は問題にならない。
 */

// 拗音（きゃ等）は2文字キーを長い順に先にマッチさせるため、
// テーブルは「2文字の組み合わせ」→「1文字」の順に定義する。
const KANA_ROMAJI: Record<string, string> = {
  // ヴ + 小母音（外来語のV音）
  'ヴァ': 'va', 'ヴィ': 'vi', 'ヴ': 'vu', 'ヴェ': 've', 'ヴォ': 'vo',
  // 外来語で使う小母音の組み合わせ
  'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo',
  'ティ': 'ti', 'ディ': 'di', 'トゥ': 'tu', 'ドゥ': 'du',
  'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
  'チェ': 'che', 'ジェ': 'je', 'シェ': 'she',
  'ツァ': 'tsa', 'ツェ': 'tse', 'ツォ': 'tso',

  // 拗音（清音）
  'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
  'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
  'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
  'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
  'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
  'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
  'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
  // 拗音（濁音）
  'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
  'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
  'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
  'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',

  // 清音
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
  // 濁音・半濁音
  'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
  'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
  'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
  'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
  'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  // 小文字（単独で現れた場合はそのまま母音扱い）
  'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o',
  'ッ': '', // 促音は単体では消音（直後の子音を重ねる処理は変換ループ側で行う）
  'ー': '', // 長音は直前の母音を繰り返す（変換ループ側で処理）
};

// ひらがな→カタカナ変換（Unicode上はひらがなの方がカタカナよりコードポイントが
// 0x60小さい。この範囲の文字だけシフトし、それ以外（漢字等）はそのまま通す）
function hiraganaToKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);
const KANA_KEYS = Object.keys(KANA_ROMAJI).sort((a, b) => b.length - a.length);

/** カタカナ/ひらがなをローマ字（ヘボン式簡易版）に変換する。漢字等は素通し */
export function toRomaji(input: string): string {
  const s = hiraganaToKatakana(input);
  let out = '';
  let i = 0;
  while (i < s.length) {
    // 促音「ッ」: 次にマッチする仮名の子音を重ねる
    if (s[i] === 'ッ') {
      const rest = s.slice(i + 1);
      const nextKey = KANA_KEYS.find(k => rest.startsWith(k));
      const nextRomaji = nextKey ? KANA_ROMAJI[nextKey] : '';
      out += nextRomaji ? nextRomaji[0] : '';
      i += 1;
      continue;
    }
    // 長音「ー」: 直前の母音を繰り返す
    if (s[i] === 'ー') {
      const lastVowel = [...out].reverse().find(c => VOWELS.has(c));
      out += lastVowel ?? '';
      i += 1;
      continue;
    }
    const rest = s.slice(i);
    const key = KANA_KEYS.find(k => rest.startsWith(k));
    if (key) {
      out += KANA_ROMAJI[key];
      i += key.length;
    } else {
      out += s[i]; // 漢字・記号・既に英数字のものはそのまま
      i += 1;
    }
  }
  return out;
}

/** 検索クエリが名前（日本語名・任意で英語名）に一致するか判定する */
export function matchesQuery(query: string, jaName: string, enName?: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (jaName.toLowerCase().includes(q)) return true;
  if (enName && enName.toLowerCase().includes(q)) return true;
  return toRomaji(jaName).toLowerCase().includes(q);
}
