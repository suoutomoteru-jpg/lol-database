import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useChampions } from '../hooks/useChampions';
import { useScalingData } from '../hooks/useScalingData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { roleIconUrl, ROLE_LABELS_JA } from '../utils/roleAssets';
import { prefetchChampion } from '../utils/prefetch';
import type { Role } from '../types/app';
import type { ScalingPhase } from '../api/scalingData';

const ROLES: (Role | 'all')[] = ['all', 'Mage', 'Tank', 'Assassin', 'Fighter', 'Support', 'Marksman'];

const PHASES: { key: ScalingPhase; label: string; sub: string }[] = [
  { key: 'early', label: '序盤', sub: '〜25分' },
  { key: 'mid',   label: '中盤', sub: '25〜32分' },
  { key: 'late',  label: '終盤', sub: '32分〜' },
];

const Y_MIN = 43;
const Y_MAX = 57;
const COL_WIDTH = 52; // px

function yPercent(winrate: number): number {
  const clamped = Math.min(Y_MAX, Math.max(Y_MIN, winrate));
  return 100 - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * 100;
}

export function ScalingChart() {
  useDocumentTitle('Scaling Chart — 試合時間帯別の勝率推移 | nunune');
  const { champions } = useChampions();
  const { data, loading } = useScalingData();
  const [role, setRole] = useState<Role | 'all'>('all');
  const [phase, setPhase] = useState<ScalingPhase>('early');

  // scaling.json の alias と Champion.id（DDragon alias）を突き合わせ、
  // 表示に必要な日本語名・アイコン・ロールを持つエントリを作る。
  // 横軸の並びは「序盤バケットの勝率が高い順」で固定し、タブ切替では動かさない
  // （アイコンが上下にだけ動く、という体験を保つため）。
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
      .filter(e => role === 'all' || e.role === role)
      .sort((a, b) => b.early.winrate - a.early.winrate);
  }, [data, champions, role]);

  const chartWidth = Math.max(entries.length * COL_WIDTH, 300);

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
            const active = role === r;
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-3 pt-[3px] pb-[5px] text-xs font-medium border rounded-full transition-colors duration-100 ${
                  active
                    ? 'border-primary/60 text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {r !== 'all' && (
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
                )}
                {r === 'all' ? 'すべて' : ROLE_LABELS_JA[r]}
              </button>
            );
          })}
        </div>

        {/* 序盤/中盤/終盤 切替 */}
        <div className="grid grid-cols-3 border border-border rounded-md overflow-hidden max-w-md mb-5">
          {PHASES.map(p => {
            const active = phase === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                aria-pressed={active}
                className={`py-2 text-sm font-semibold transition-colors border-r border-border last:border-r-0 ${
                  active ? 'bg-primary/15 text-primary' : 'bg-card text-muted-foreground hover:text-foreground'
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
          <div className="bg-card border border-border rounded-md p-3 overflow-x-auto">
            <div className="relative h-[300px] ml-9" style={{ width: chartWidth }}>
              {/* グリッド線（左に勝率目盛り） */}
              {Array.from({ length: 7 }, (_, i) => Y_MIN + i * 2).map(y => (
                <div
                  key={y}
                  className={`absolute left-0 right-0 border-t ${y === 50 ? 'border-foreground/40' : 'border-dashed border-border'}`}
                  style={{ top: `${yPercent(y)}%` }}
                >
                  <span className={`absolute -left-9 -top-[7px] text-[11px] tabular-nums ${y === 50 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    {y}%
                  </span>
                </div>
              ))}

              {/* チャンピオンアイコン */}
              {entries.map((e, i) => {
                const stat = e[phase];
                return (
                  <Link
                    key={e.alias}
                    to={`/champion/${e.alias}`}
                    onPointerEnter={() => prefetchChampion(e.alias)}
                    onTouchStart={() => prefetchChampion(e.alias)}
                    title={`${e.name}: ${stat.winrate.toFixed(1)}%（${stat.games}試合）`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full overflow-hidden
                      border-2 border-border hover:border-primary transition-[top,border-color] duration-500 ease-out
                      shadow-[0_2px_8px_rgba(0,0,0,.45)]"
                    style={{ left: i * COL_WIDTH + COL_WIDTH / 2, top: `${yPercent(stat.winrate)}%` }}
                  >
                    <img src={e.icon} alt={e.name} className="w-full h-full object-cover" loading="lazy" />
                  </Link>
                );
              })}
            </div>

            {/* X軸ラベル */}
            <div className="relative ml-9 mt-1.5" style={{ width: chartWidth, height: 14 }}>
              {entries.map((e, i) => (
                <span
                  key={e.alias}
                  className="absolute -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap"
                  style={{ left: i * COL_WIDTH + COL_WIDTH / 2 }}
                >
                  {e.name}
                </span>
              ))}
            </div>
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
