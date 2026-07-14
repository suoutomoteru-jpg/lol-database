import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { X, ChevronUp } from 'lucide-react';
import { useBuildTray, removeFromTray, clearTray, MAX_SLOTS } from '../hooks/useBuildTray';
import { useCountUp } from '../hooks/useCountUp';
import { getLatestVersion, fetchAllItemsRaw, itemImageUrl } from '../api/dataDragon';
import { calcGoldEfficiency, GOLD_PER_STAT } from '../utils/goldEfficiency';
import { calcBuildGrade, nextGradeGap } from '../utils/buildGrade';
import { STAT_LABELS, formatStatValue } from '../hooks/useItemsByStats';
import type { DDragonItem } from '../types/ddragon';

/**
 * ビルドトレイ（画面下部固定）
 *
 * 「積む」で追加したアイテムの合計ゴールド・合計ステータス・合計金銭効率を
 * ライブ集計する。効率はS/A/B/Cでグレード評価し、次のグレードまでの
 * 差分を見せて組み替え（最適化ループ）を誘発する。
 */

// ステータスキー → 数値の文字色（大まかな系統色のみ）
const STAT_VALUE_COLOR: Record<string, string> = {
  FlatPhysicalDamageMod: 'text-stat-ad',
  PercentAttackSpeedMod: 'text-stat-ad',
  FlatMagicDamageMod:    'text-stat-ap',
  FlatHPPoolMod:         'text-stat-hp',
  FlatHPRegenMod:        'text-stat-hp',
  FlatMPPoolMod:         'text-stat-mana',
  FlatMPRegenMod:        'text-stat-mana',
  FlatArmorMod:          'text-stat-armor',
  FlatSpellBlockMod:     'text-stat-mr',
  FlatMovementSpeedMod:  'text-stat-ms',
  PercentMovementSpeedMod: 'text-stat-ms',
};

interface StatTotal {
  key: string;
  label: string;
  value: number;
  /** 表示優先度（ゴールド換算価値） */
  weight: number;
}

function GradeChip({ grade }: { grade: 'S' | 'A' | 'B' | 'C' }) {
  const style =
    grade === 'S' ? 'border-primary text-primary shadow-[0_0_10px_rgba(200,155,60,.45)]'
    : grade === 'A' ? 'border-hextech/70 text-hextech'
    : 'border-border text-muted-foreground';
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-sm border font-display text-sm leading-none ${style}`}
      title={`ビルド効率グレード ${grade}`}
    >
      {grade}
    </span>
  );
}

export function BuildTray() {
  const ids = useBuildTray();
  const [allItems, setAllItems] = useState<Record<string, DDragonItem> | null>(null);
  const [version, setVersion] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLatestVersion()
      .then(v => fetchAllItemsRaw(v).then(data => {
        if (!cancelled) { setAllItems(data); setVersion(v); }
      }))
      .catch(() => { /* トレイなしで動作継続 */ });
    return () => { cancelled = true; };
  }, []);

  const entries = useMemo(
    () => ids
      .map(id => ({ id, item: allItems?.[id] }))
      .filter((e): e is { id: string; item: DDragonItem } => !!e.item),
    [ids, allItems],
  );

  const { totalGold, efficiency, statTotals } = useMemo(() => {
    let gold = 0;
    let value = 0;
    const totals = new Map<string, number>();

    for (const { item } of entries) {
      gold += item.gold.total;
      const eff = calcGoldEfficiency(item.stats, item.tags ?? [], item.description, item.gold.total);
      if (eff !== null) value += (eff / 100) * item.gold.total;
      for (const [k, v] of Object.entries(item.stats)) {
        if (v) totals.set(k, (totals.get(k) ?? 0) + v);
      }
    }

    const statTotals: StatTotal[] = [...totals.entries()]
      .map(([key, value]) => ({
        key,
        label: STAT_LABELS[key] ?? key,
        value,
        weight: Math.abs(value) * (GOLD_PER_STAT[key] ?? 0),
      }))
      .sort((a, b) => b.weight - a.weight);

    return {
      totalGold: gold,
      efficiency: gold > 0 && value > 0 ? (value / gold) * 100 : null,
      statTotals,
    };
  }, [entries]);

  const goldDisp = useCountUp(totalGold);
  const effDisp = useCountUp(efficiency ?? 0);

  if (ids.length === 0) return null;

  const grade = efficiency !== null ? calcBuildGrade(efficiency) : null;
  const nextGap = efficiency !== null ? nextGradeGap(efficiency) : null;
  const emptyCount = MAX_SLOTS - ids.length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      {/* 展開パネル: 合計ステータスの全リスト */}
      {expanded && (
        <div className="border-t border-primary/30 bg-card/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-3 max-w-4xl">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">合計ステータス</p>
              {nextGap && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  グレード{nextGap.grade}まで あと{nextGap.gap.toFixed(1)}%
                </p>
              )}
            </div>
            {statTotals.length === 0 ? (
              <p className="text-xs text-muted-foreground">ステータスなし</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
                {statTotals.map(s => (
                  <div key={s.key} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-muted-foreground truncate">{s.label}</span>
                    <span className={`font-semibold tabular-nums ${STAT_VALUE_COLOR[s.key] ?? 'text-foreground'}`}>
                      +{formatStatValue(s.key, s.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2.5 flex justify-end">
              <button
                onClick={clearTray}
                className="text-[11px] text-muted-foreground hover:text-destructive border border-border rounded-sm px-2.5 py-1 transition-colors"
              >
                トレイをクリア
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 本体バー */}
      <div className="border-t border-primary/40 bg-[#0D141F]/97 backdrop-blur-sm">
        <div className="container mx-auto px-3 sm:px-4 max-w-4xl flex items-center gap-2.5 sm:gap-4 h-16">
          <button
            onClick={() => setExpanded(v => !v)}
            className="hidden sm:block flex-shrink-0 text-[10px] leading-snug tracking-[.18em] text-primary/90 hover:text-primary text-left"
            title="合計ステータスを表示"
          >
            ビルド<br />トレイ
          </button>

          {/* スロット */}
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0" data-tray-slots>
            {entries.map(({ id, item }) => (
              <div key={id} className="relative group" data-tray-item={id}>
                <Link to={`/item/${id}`} title={item.name}>
                  <img
                    src={itemImageUrl(version, item.image.full)}
                    alt={item.name}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-sm border border-primary/50"
                  />
                </Link>
                <button
                  onClick={() => removeFromTray(id)}
                  title={`${item.name}を外す`}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-secondary border border-border
                    flex items-center justify-center text-muted-foreground
                    sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive hover:border-destructive/50 transition-all"
                >
                  <X size={9} strokeWidth={3} />
                </button>
              </div>
            ))}
            {Array.from({ length: emptyCount }).map((_, i) => (
              <div
                key={`empty-${i}`}
                data-tray-slot="empty"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-sm border border-dashed border-muted-foreground/30
                  flex items-center justify-center text-muted-foreground/40 text-sm"
              >
                ＋
              </div>
            ))}
          </div>

          {/* 集計 */}
          <div className="ml-auto flex items-center gap-3 sm:gap-5 min-w-0">
            <div className="hidden md:flex items-center gap-4">
              {statTotals.slice(0, 3).map(s => (
                <div key={s.key} className="text-right">
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                  <p className={`text-sm font-bold tabular-nums leading-tight ${STAT_VALUE_COLOR[s.key] ?? 'text-foreground'}`}>
                    +{formatStatValue(s.key, s.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-muted-foreground leading-tight">合計</p>
              <p className="text-sm sm:text-base font-bold text-primary tabular-nums leading-tight">
                {Math.round(goldDisp).toLocaleString()}G
              </p>
            </div>

            {efficiency !== null && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground leading-tight">効率</p>
                  <p className={`text-sm sm:text-base font-bold tabular-nums leading-tight ${efficiency >= 100 ? 'text-stat-hp' : 'text-foreground'}`}>
                    {effDisp.toFixed(1)}%
                  </p>
                </div>
                {grade && <GradeChip grade={grade} />}
              </div>
            )}

            <button
              onClick={() => setExpanded(v => !v)}
              title="合計ステータスを表示"
              className={`flex-shrink-0 p-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground transition-all ${expanded ? 'rotate-180' : ''}`}
            >
              <ChevronUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
