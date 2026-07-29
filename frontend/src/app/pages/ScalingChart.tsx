import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Table as TableIcon } from 'lucide-react';
import { useChampions } from '../hooks/useChampions';
import { useScalingData } from '../hooks/useScalingData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { roleIconUrl, ROLE_LABELS_JA } from '../utils/roleAssets';
import { prefetchChampion } from '../utils/prefetch';
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
  // 表ビュー: ツールチップは値を「補助」するもので、唯一の読み取り手段には
  // しない（キーボード・スクリーンリーダー・印刷でも全数値に到達できる）
  const [showTable, setShowTable] = useState(false);

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

  const chartWidth = Math.max(entries.length * COL_WIDTH, 300);
  const activeEntry = active !== null ? entries[active] ?? null : null;
  const phaseLabel = PHASES.find(p => p.key === phase)!.label;

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

              {/* チャンピオンアイコン。重なるマークはカード色の2pxリングで分離する
                  （マークを囲む枠線ではなく、下地の色で隙間を作るのが原則） */}
              {entries.map((e, i) => {
                const stat = e[phase];
                const isActive = active === i;
                return (
                  <Link
                    key={e.alias}
                    to={`/champion/${e.alias}`}
                    onPointerEnter={() => { prefetchChampion(e.alias); setActive(i); }}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onTouchStart={() => prefetchChampion(e.alias)}
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
                  </Link>
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

        {entries.length > 0 && (
          <>
            <button
              onClick={() => setShowTable(v => !v)}
              aria-expanded={showTable}
              className="mt-3 inline-flex items-center gap-1.5 px-3 pt-[3px] pb-[5px] text-xs font-medium
                border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors duration-100"
            >
              <TableIcon size={13} aria-hidden />
              {showTable ? '表を閉じる' : '表で見る'}
            </button>

            {showTable && (
              <div className="mt-3 overflow-x-auto border border-border rounded-md">
                <table className="w-full text-xs">
                  <caption className="sr-only">
                    {ROLE_LABELS_JA[role]}の試合時間帯別勝率（各時間帯の勝率と試合数）
                  </caption>
                  <thead>
                    <tr className="bg-secondary/40 text-muted-foreground">
                      <th scope="col" className="text-left font-medium px-3 py-2">チャンピオン</th>
                      {PHASES.map(p => (
                        <th key={p.key} scope="col" className="text-right font-medium px-3 py-2 whitespace-nowrap">
                          {p.label}
                          <span className="ml-1 font-normal opacity-70">{p.sub}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.alias} className="border-t border-border">
                        <th scope="row" className="text-left font-medium px-3 py-1.5 whitespace-nowrap">
                          <Link to={`/champion/${e.alias}`} className="hover:text-primary transition-colors">
                            {e.name}
                          </Link>
                        </th>
                        {PHASES.map(p => (
                          <td key={p.key} className="text-right px-3 py-1.5 tabular-nums whitespace-nowrap">
                            {e[p.key].games > 0 ? `${e[p.key].winrate.toFixed(1)}%` : '—'}
                            <span className="ml-1.5 text-muted-foreground">{e[p.key].games}試合</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
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
