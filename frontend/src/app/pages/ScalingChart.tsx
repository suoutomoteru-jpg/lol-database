import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useChampions } from '../hooks/useChampions';
import { useScalingData } from '../hooks/useScalingData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { roleIconUrl, ROLE_LABELS_JA } from '../utils/roleAssets';
import type { Role } from '../types/app';
import type { ScalingPhase } from '../api/scalingData';

const ROLES: Role[] = ['Mage', 'Tank', 'Assassin', 'Fighter', 'Support', 'Marksman'];

const PHASES: { key: ScalingPhase; label: string; sub: string }[] = [
  { key: 'early', label: '序盤', sub: '〜20分' },
  { key: 'mid',   label: '中盤', sub: '20〜35分' },
  { key: 'late',  label: '終盤', sub: '35分〜' },
];

// 縦軸のレンジ。序盤・終盤バケットは母数が少なく勝率が大きくばらつくため、
// 43〜57%では半数近くが上下端に張り付いてしまう。35〜65%で振り切りは
// 519件中28件まで減る（中盤はゼロ）。
const Y_MIN = 35;
const Y_MAX = 65;
const Y_STEP = 5;
const GRID_LINES = Array.from(
  { length: (Y_MAX - Y_MIN) / Y_STEP + 1 },
  (_, i) => Y_MIN + i * Y_STEP,
);
// 列ピッチをアイコン径より小さく取り、隣同士がわずかに重なる密度にする
const ICON_SIZE = 28; // px
const COL_WIDTH = 24; // px

// この試合数を下回るバケットは勝率を出さない。「20分未満で終わる試合」は
// 個々のチャンピオンの強さよりチーム全体の一方的な展開に引っ張られやすく、
// 数十試合程度では容易にノイズに埋もれるため（例: Kayle序盤 n=26で57.7%と
// いった実感と合わない値が出る）、積み上げ収集で母数が育つまでは
// 「わからない」を「わからない」として扱う
const MIN_GAMES = 100;

function yPercent(winrate: number): number {
  const clamped = Math.min(Y_MAX, Math.max(Y_MIN, winrate));
  return 100 - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * 100;
}

export function ScalingChart() {
  useDocumentTitle('Scaling Chart — 試合時間帯別の勝率推移 | nunune');
  const { champions } = useChampions();
  const { data, loading } = useScalingData();
  const [role, setRole] = useState<Role>('Mage');
  const [phase, setPhase] = useState<ScalingPhase>('early');
  // ホバー/フォーカス中のマーク（ツールチップ用）。indexは横位置の算出に使う
  const [active, setActive] = useState<number | null>(null);

  // scaling.json の alias と Champion.id（DDragon alias）を突き合わせ、
  // 表示に必要な日本語名・アイコン・ロールを持つエントリを作る。
  // 横軸の並びは名前（アイウエオ順）固定。タブ切替ではアイコンが
  // 上下にだけ動く、という体験を保つ。
  const entries = useMemo(() => {
    if (!data) return [];
    const champByAlias = new Map(champions.map(c => [c.id, c]));
    return data.champions
      .map(sc => {
        const champ = champByAlias.get(sc.alias);
        if (!champ) return null;
        return { ...sc, name: champ.name, icon: champ.icon, role: champ.role };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .filter(e => e.role === role)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [data, champions, role]);

  // 時間帯ごとの勝率ランキング。MIN_GAMES未満のチャンピオンは勝率を
  // 信頼できる数字として出せないため、順位づけの対象からは外して末尾にまわす
  const rankings = useMemo(
    () => PHASES.map(p => ({
      ...p,
      rows: [...entries].sort((a, b) => {
        const aOk = a[p.key].games >= MIN_GAMES;
        const bOk = b[p.key].games >= MIN_GAMES;
        if (!aOk || !bOk) {
          return aOk === bOk ? 0 : aOk ? -1 : 1;
        }
        return b[p.key].winrate - a[p.key].winrate;
      }),
    })),
    [entries],
  );

  const chartWidth = Math.max(entries.length * COL_WIDTH, 300);
  const activeEntry = active !== null ? entries[active] ?? null : null;
  const phaseLabel = PHASES.find(p => p.key === phase)!.label;
  const plottableCount = useMemo(
    () => entries.filter(e => e[phase].games >= MIN_GAMES).length,
    [entries, phase],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-2.5 max-w-6xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            戻る
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Scaling Chart</h1>
        <p className="text-xs text-muted-foreground mb-6">
          試合時間帯別のチャンピオン勝率推移。「試合がその時間帯まで続いた場合の勝率」を表す指標で、
          実際の強さの実測ではなく試合結果からの相関的な傾向です。
          {' '}各時間帯{MIN_GAMES}試合未満のデータはノイズが大きいため表示していません
          （グレー表示は収集中）。
        </p>

        {data?.note && (
          <p className="text-[11px] text-hextech border border-hextech/30 bg-hextech/5 rounded-md px-3 py-2 mb-5">
            {data.note}
          </p>
        )}

        {/* ロールフィルター */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ROLES.map(r => {
            const isActive = role === r;
            return (
              <button
                key={r}
                onClick={() => { setRole(r); setActive(null); }}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 px-3 pt-[3px] pb-[5px] text-xs font-medium border rounded-full transition-colors duration-100 ${
                  isActive
                    ? 'border-primary/60 text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  aria-hidden
                  className="w-3.5 h-3.5 inline-block bg-current"
                  style={{
                    WebkitMaskImage: `url(${roleIconUrl(r)})`,
                    maskImage: `url(${roleIconUrl(r)})`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                  }}
                />
                {ROLE_LABELS_JA[r]}
              </button>
            );
          })}
        </div>

        {/* 序盤/中盤/終盤 切替 */}
        <div className="grid grid-cols-3 border border-border rounded-md overflow-hidden max-w-md mb-5">
          {PHASES.map(p => {
            const isActive = phase === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                aria-pressed={isActive}
                className={`py-2 text-sm font-semibold transition-colors border-r border-border last:border-r-0 ${
                  isActive ? 'bg-primary/15 text-primary' : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
                <span className="block text-[10px] font-normal opacity-70">{p.sub}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs tracking-widest uppercase">Loading...</p>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">データがありません</p>
        ) : (
          <div className="bg-card border border-border rounded-md px-3 py-5 overflow-x-auto">
            {/* 縦paddingは上下端に貼り付いたアイコンが枠に接しない厚み。
                内側は目盛りの余白を含めて中央寄せ（ロールによって横幅が変わるため） */}
            <div className="w-fit mx-auto pl-9">
              <div className="relative h-[190px]" style={{ width: chartWidth }}>
              {/* グリッド線（左に勝率目盛り）。50%だけは基準線として一段濃く */}
              {GRID_LINES.map(y => (
                <div
                  key={y}
                  className={`absolute left-0 right-0 border-t ${y === 50 ? 'border-foreground/40' : 'border-border'}`}
                  style={{ top: `${yPercent(y)}%` }}
                >
                  <span className={`absolute -left-9 -top-[7px] text-[11px] tabular-nums ${y === 50 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    {y}%
                  </span>
                </div>
              ))}

              {plottableCount === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
                  このロール・時間帯は{MIN_GAMES}試合以上のチャンピオンがまだありません。
                  下の表には収集中のデータが出ています。
                </p>
              )}

              {/* チャンピオンアイコン。重なるマークはカード色の2pxリングで分離する
                  （マークを囲む枠線ではなく、下地の色で隙間を作るのが原則）。
                  MIN_GAMES未満は信頼できる勝率として出せないためプロットしない */}
              {entries.map((e, i) => {
                const stat = e[phase];
                if (stat.games < MIN_GAMES) return null;
                const isActive = active === i;
                return (
                  <button
                    key={e.alias}
                    type="button"
                    // チャンピオンページへは飛ばさず、値の表示だけを行う。
                    // マウスはホバーで追従するのでクリックは何もしない
                    // （タップで開閉するのはホバーを持たないタッチ/ペンのみ）
                    onClick={ev => {
                      const pt = (ev.nativeEvent as PointerEvent).pointerType;
                      if (pt === 'touch' || pt === 'pen') {
                        setActive(prev => (prev === i ? null : i));
                      }
                    }}
                    onPointerEnter={ev => { if (ev.pointerType === 'mouse') setActive(i); }}
                    onPointerLeave={ev => { if (ev.pointerType === 'mouse') setActive(null); }}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    aria-label={`${e.name} ${phaseLabel}の勝率 ${stat.winrate.toFixed(1)}パーセント、${stat.games}試合`}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden ring-2
                      transition-[top,box-shadow] duration-500 ease-out shadow-[0_1px_4px_rgba(0,0,0,.45)]
                      ${isActive ? 'ring-primary z-10' : 'ring-card'}`}
                    style={{
                      left: i * COL_WIDTH + COL_WIDTH / 2,
                      top: `${yPercent(stat.winrate)}%`,
                      width: ICON_SIZE,
                      height: ICON_SIZE,
                    }}
                  >
                    <img src={e.icon} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                );
              })}

              {/* ツールチップ: 値を主役に、名前は従。試合数も併記して
                  母数が少ないケースを読み手が割り引けるようにする */}
              {activeEntry && (
                <div
                  aria-hidden
                  className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full
                    rounded-md border border-border bg-background/95 px-2.5 py-1.5 shadow-lg whitespace-nowrap"
                  style={{
                    left: Math.min(Math.max(active! * COL_WIDTH + COL_WIDTH / 2, 56), chartWidth - 56),
                    top: `calc(${yPercent(activeEntry[phase].winrate)}% - ${ICON_SIZE / 2 + 6}px)`,
                  }}
                >
                  <div className="text-sm font-bold text-foreground tabular-nums leading-tight">
                    {activeEntry[phase].winrate.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {activeEntry.name}
                    <span className="ml-1.5 tabular-nums">{activeEntry[phase].games}試合</span>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* 時間帯ごとの勝率ランキング。チャートが「推移の形」を見せるのに対し、
            こちらは実数と順位を担当する（値がホバー頼みにならないようにする） */}
        {entries.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {rankings.map(({ key, label, sub, rows }) => (
              <div key={key} className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <caption className="bg-secondary/40 px-3 py-2 text-left">
                    <span className="font-semibold text-foreground">{label}</span>
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{sub}</span>
                  </caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">順位</th>
                      <th scope="col">チャンピオン</th>
                      <th scope="col">勝率</th>
                      <th scope="col">試合数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e, i) => {
                      const enough = e[key].games >= MIN_GAMES;
                      return (
                        <tr key={e.alias} className={`border-t border-border ${enough ? '' : 'opacity-40'}`}>
                          <td className="pl-2.5 pr-1 py-1 text-right tabular-nums text-muted-foreground w-6">
                            {enough ? i + 1 : '–'}
                          </td>
                          <th scope="row" className="py-1 font-normal text-left">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <img
                                src={e.icon}
                                alt=""
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                loading="lazy"
                              />
                              <span className="truncate">{e.name}</span>
                            </span>
                          </th>
                          <td className="px-1 py-1 text-right tabular-nums font-semibold text-foreground whitespace-nowrap">
                            {enough ? `${e[key].winrate.toFixed(1)}%` : '—'}
                          </td>
                          <td className="pr-2.5 pl-1 py-1 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            {e[key].games}
                            <span className="text-[10px]">試合</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {data && (
          <p className="text-[11px] text-muted-foreground/60 mt-3">
            集計対象: {data.queue === 'RANKED_SOLO_5x5' ? 'ランクソロ/デュオ（全ティア）' : data.queue}
            {' '}/ サンプル試合数: {data.sampledMatches.toLocaleString()}
            {' '}/ 集計日時: {new Date(data.generatedAt).toLocaleDateString('ja-JP')}
          </p>
        )}
      </div>
    </div>
  );
}
