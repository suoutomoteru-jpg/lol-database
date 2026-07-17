import { useState, useCallback, useRef, Fragment } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react';
import { useItem } from '../hooks/useItem';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useItems } from '../hooks/useItems';
import { useItemsByStats, type ItemSummary } from '../hooks/useItemsByStats';
import { useBuildTray, addToTray, MAX_SLOTS } from '../hooks/useBuildTray';
import { usePatchChanges } from '../hooks/usePatchChanges';
import { BottomSheet } from '../components/BottomSheet';
import { BuildTray } from '../components/BuildTray';
import { processItemDescription, injectStatLinks } from '../utils/richText';
import { calcGoldEfficiency } from '../utils/goldEfficiency';
import { STAT_KEY_LABELS, ITEM_KEYWORDS } from '../utils/stats';
import { flyToTray } from '../utils/flyToTray';

// ── 日本語単語境界でのアイテム名折り返し ────────────────
interface JaSegment { segment: string }
interface JaSegmenter { segment(t: string): Iterable<JaSegment> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _Seg = (Intl as any).Segmenter;
const jaSegmenter: JaSegmenter | null = _Seg
  ? (() => { try { return new _Seg('ja', { granularity: 'word' }) as JaSegmenter; } catch { return null; } })()
  : null;

function WbrName({ text }: { text: string }) {
  if (!jaSegmenter) return <>{text}</>;
  const parts = [...jaSegmenter.segment(text)];
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p.segment}{i < parts.length - 1 && <wbr />}</Fragment>
      ))}
    </>
  );
}

// ── <stats> ブロックの構造化 ────────────────────────────

/** "攻撃力 65" のような行を ラベルHTML / 値 に分割する */
function splitStatLines(statsHtml: string): Array<{ label: string; value: string }> {
  return statsHtml
    .split(/<br\s*\/?\s*>/i)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^([\s\S]*?)\s*([+-]?\d[\d.,]*\s*%?)\s*$/);
      return m ? { label: m[1], value: m[2] } : { label: line, value: '' };
    });
}

/** チップのラベル（平文）→ ステータス台帳キー。台帳は長い語優先ソート済み */
function statKeyForLabel(plain: string): string | null {
  for (const { text, key } of ITEM_KEYWORDS) {
    if (plain.includes(text)) return key;
  }
  return null;
}

// ── 共通パーツ ─────────────────────────────────────────

/** ゾーン見出し（設計図の工程ラベル） */
function ZoneLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] tracking-[.25em] text-muted-foreground/70 select-none ${className}`}>
      {children}
    </p>
  );
}

/** モバイル用の工程間ジョイント（素材 → 完成 → 進化 の流れ） */
function Joint() {
  return <div className="lg:hidden text-center text-primary/70 text-xs leading-none" aria-hidden>▼</div>;
}

interface PathItem { id: string; name: string; imageUrl: string; gold: number }

/** 素材ノード（左列）。工程はゾーンラベルとジョイントで示し、接続線は引かない */
function MaterialNode({ item }: { item: PathItem }) {
  return (
    <Link
      to={`/item/${item.id}`}
      className="relative flex items-center gap-2.5 bg-card/95 border border-border rounded-md p-2 pr-3
        hover:border-primary/40 transition-colors"
    >
      <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-sm border border-border flex-shrink-0" loading="lazy" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{item.name}</p>
        <p className="text-[11px] text-gold tabular-nums mt-0.5">{item.gold}G</p>
      </div>
    </Link>
  );
}

/** 進化先クラスタ（右列）: 高額上位2件は名前つき、残りは小アイコン密集 */
function EvolutionCluster({ into }: { into: PathItem[] }) {
  const sorted = [...into].sort((a, b) => b.gold - a.gold);
  const major = sorted.slice(0, 2);
  const minor = sorted.slice(2);

  return (
    <div className="relative bg-card/60 border border-border rounded-md p-3">
      <div className="flex items-baseline gap-2 mb-2.5">
        <p className="text-xs font-bold text-foreground">進化先</p>
        <span className="text-[10px] text-primary border border-primary/40 rounded-full px-2 py-px tabular-nums">
          {into.length}件
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {major.map(up => (
          <Link
            key={up.id}
            to={`/item/${up.id}`}
            className="flex items-center gap-2 bg-card border border-border rounded-md p-1.5 pr-2.5 hover:border-primary/40 transition-colors"
          >
            <img src={up.imageUrl} alt="" className="w-10 h-10 rounded-sm border border-primary/40 flex-shrink-0" loading="lazy" />
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold leading-tight line-clamp-2">{up.name}</p>
              <p className="text-[10px] text-gold tabular-nums">{up.gold}G</p>
            </div>
          </Link>
        ))}
      </div>
      {minor.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {minor.map(up => (
            <Link key={up.id} to={`/item/${up.id}`} title={up.name}>
              <img
                src={up.imageUrl}
                alt={up.name}
                className="w-[34px] h-[34px] rounded-sm border border-border hover:border-primary/50 transition-colors"
                loading="lazy"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** 進化先なし = 最終装備 */
function FinalForm() {
  return (
    <div className="border border-dashed border-muted-foreground/40 rounded-md px-3 py-4 text-center">
      <p className="text-[10px] tracking-[.18em] text-foreground/70 font-semibold mb-1">FINAL FORM</p>
      <p className="text-xs text-muted-foreground leading-relaxed">これ以上の進化先はない最終装備</p>
    </div>
  );
}

/** 素材なし = 基本アイテム */
function BasicItem() {
  return (
    <div className="relative border border-dashed border-muted-foreground/40 rounded-md px-3 py-4 text-center">
      <p className="text-[10px] tracking-[.18em] text-foreground/70 font-semibold mb-1">BASIC ITEM</p>
      <p className="text-xs text-muted-foreground leading-relaxed">素材なし・基本アイテム<br />ショップで直接購入</p>
    </div>
  );
}

// ── ウサギの穴: 同ステータスの上位アイテム ──────────────

function parseNum(v: string): number {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
}

function topByStat(list: ItemSummary[], label: string, excludeId: string, n = 3): ItemSummary[] {
  const value = (it: ItemSummary) => {
    const match = it.stats.find(s => s.label === label);
    if (match) return parseNum(match.value);
    return Math.max(0, ...it.stats.map(s => parseNum(s.value)));
  };
  return list
    .filter(it => it.id !== excludeId)
    .sort((a, b) => value(b) - value(a))
    .slice(0, n);
}

function RelatedByStat({ statKey, excludeId, items, onShowAll }: {
  statKey: string;
  excludeId: string;
  items: ItemSummary[];
  onShowAll: (key: string, label: string) => void;
}) {
  const label = STAT_KEY_LABELS[statKey] ?? '';
  const top = topByStat(items, label, excludeId);
  if (top.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-sm font-semibold text-foreground">
          <span className="text-primary">{label}</span>
          をさらに伸ばすなら
        </p>
        <button
          onClick={() => onShowAll(statKey, label)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          すべて見る →
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {top.map(it => {
          const line = it.stats.find(s => s.label === label) ?? it.stats[0];
          return (
            <Link
              key={it.id}
              to={`/item/${it.id}`}
              className="flex items-center gap-2.5 bg-card border border-border rounded-md p-2 pr-3 hover:border-primary/40 transition-colors"
            >
              <img src={it.imageUrl} alt="" className="w-10 h-10 rounded-sm border border-border flex-shrink-0" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight line-clamp-2">{it.name}</p>
              </div>
              {line && (
                <span className="flex-shrink-0 text-xs text-foreground/70">
                  {line.label} <b className="num-data text-base">{line.value}</b>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── メインページ ───────────────────────────────────────

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { item, loading, error } = useItem(id);
  const { items } = useItems();
  const { statMap, mediumStatMap } = useItemsByStats();
  const trayIds = useBuildTray();
  const patchDiff = usePatchChanges();
  const [activeStatKey, setActiveStatKey] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');
  const heroImgRef = useRef<HTMLImageElement>(null);

  useDocumentTitle(item ? `${item.name} 効果・金銭効率・ビルドパス | nunune.gg` : null);

  const currentIdx = items.findIndex(it => it.id === id);
  const prevItem = currentIdx > 0 ? items[currentIdx - 1] : null;
  const nextItem = currentIdx >= 0 && currentIdx < items.length - 1 ? items[currentIdx + 1] : null;

  const openSheet = useCallback((key: string, label: string) => {
    setActiveStatKey(key);
    setActiveLabel(label);
  }, []);

  const handleDescClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.stat;
    if (key) openSheet(key, STAT_KEY_LABELS[key] ?? target.textContent ?? '');
  }, [openSheet]);

  // 刻印（role="button" の span）を Enter/Space でも開けるようにする
  const handleDescKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement;
    const key = target.dataset.stat;
    if (!key) return;
    e.preventDefault();
    openSheet(key, STAT_KEY_LABELS[key] ?? target.textContent ?? '');
  }, [openSheet]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">読み込み中…</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {error ? `エラー: ${error.message}` : 'アイテムが見つかりませんでした'}
        </p>
        <Link to="/" className="text-primary hover:underline">← ホームへ戻る</Link>
      </div>
    );
  }

  const processed = injectStatLinks(processItemDescription(item.description));
  const statsMatch = processed.match(/<div class="item-stats">([\s\S]*?)<\/div>/i);
  const statLines = statsMatch ? splitStatLines(statsMatch[1]) : [];
  const bodyHtml = processed
    .replace(/<div class="item-stats">[\s\S]*?<\/div>/i, '')
    .replace(/^(\s*<br>)+/i, '')
    .trim();
  const goldEfficiency = calcGoldEfficiency(item.stats, item.tags, item.description, item.gold.total);
  // メーターは150%を上限、100%の位置に基準線
  const effBarWidth = goldEfficiency !== null ? `${Math.min(goldEfficiency, 150) / 1.5}%` : '0%';

  const chips = statLines.map(line => {
    const plain = line.label.replace(/<[^>]+>/g, '');
    return { plain, value: line.value, key: statKeyForLabel(plain) };
  });
  const primaryStatKey = chips.find(c => c.key)?.key ?? null;

  const inTray = trayIds.includes(item.id);
  const trayFull = trayIds.length >= MAX_SLOTS;
  const canStack = !inTray && !trayFull;
  const change = patchDiff?.changes[item.id];

  const handleStack = () => {
    if (!addToTray(item.id)) return;
    flyToTray(heroImgRef.current, item.imageUrl, item.id);
  };

  return (
    <div className="min-h-screen bg-background">
      {prevItem && (
        <Link
          to={`/item/${prevItem.id}`}
          aria-label={`前のアイテム: ${prevItem.name}`}
          title={prevItem.name}
          className="fixed left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-[color,background-color,border-color,opacity] opacity-50 hover:opacity-100"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {nextItem && (
        <Link
          to={`/item/${nextItem.id}`}
          aria-label={`次のアイテム: ${nextItem.name}`}
          title={nextItem.name}
          className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-[color,background-color,border-color,opacity] opacity-50 hover:opacity-100"
        >
          <ChevronRight size={16} />
        </Link>
      )}

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

      {/* アセンブリライン: 素材 → 完成品 → 進化先 */}
      <div className="assembly-stage pb-32">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:gap-8 items-start">

            {/* 素材（左列） */}
            <section className="lg:pt-10">
              <ZoneLabel className="mb-2.5">素材 MATERIALS</ZoneLabel>
              {item.from.length > 0 ? (
                <div className="flex flex-col gap-2 max-w-xs mx-auto lg:mx-0">
                  {item.from.map(comp => <MaterialNode key={comp.id} item={comp} />)}
                </div>
              ) : (
                <div className="max-w-xs mx-auto lg:mx-0"><BasicItem /></div>
              )}
              <div className="mt-3"><Joint /></div>
            </section>

            {/* 完成品（中央） */}
            <section className="text-center">
              <ZoneLabel className="mb-4 text-center">完成 ITEM</ZoneLabel>

              <img
                ref={heroImgRef}
                src={item.imageUrl}
                alt={item.name}
                className="w-24 h-24 mx-auto rounded-lg border-2 border-primary/70
                  shadow-[0_0_0_5px_rgba(255,143,198,.10),0_0_36px_rgba(255,143,198,.18)]"
              />

              <div className="mt-3 flex items-baseline justify-center gap-2 flex-wrap">
                <h1
                  className="text-2xl font-bold text-foreground leading-tight"
                  style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
                >
                  <WbrName text={item.name} />
                </h1>
                {change && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-hextech/50 text-hextech leading-none">
                    {change === 'new' ? 'NEW' : '今パッチで変更'}
                  </span>
                )}
              </div>
              {item.englishName && item.englishName !== item.name && (
                <p className="font-display font-bold text-sm text-primary/80 mt-0.5">{item.englishName}</p>
              )}

              <p className="mt-2 text-xl font-bold text-gold tabular-nums">
                {item.gold.total}<span className="text-xs font-semibold ml-0.5">G</span>
              </p>

              {goldEfficiency !== null && (
                <div className="mt-2 w-48 mx-auto">
                  <div className="flex items-baseline justify-between mb-1 text-[11px]">
                    <span className="text-muted-foreground">金銭効率</span>
                    <span className={`font-semibold tabular-nums ${goldEfficiency >= 100 ? 'text-stat-hp' : 'text-foreground'}`}>
                      {goldEfficiency.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-secondary rounded-full">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${goldEfficiency >= 100 ? 'bg-stat-hp/80' : 'bg-primary/80'}`}
                      style={{ width: effBarWidth }}
                    />
                    {/* 100% の基準線 */}
                    <div className="absolute -inset-y-0.5 w-px bg-foreground/50" style={{ left: `${100 / 1.5}%` }} />
                  </div>
                </div>
              )}

              {/* 積む: ビルドトレイへ追加 */}
              <button
                onClick={handleStack}
                disabled={!canStack}
                className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-6 pt-[7px] pb-[9px] text-sm font-black transition-transform
                  ${canStack
                    ? 'bg-primary text-primary-foreground -rotate-1 shadow-[0_0_18px_rgba(255,143,198,.45)] hover:-rotate-2 hover:scale-[1.03] active:scale-95'
                    : 'bg-secondary text-muted-foreground cursor-default'}`}
              >
                {inTray
                  ? <><Check size={15} strokeWidth={3} /> Finished</>
                  : trayFull
                    ? 'トレイが満杯'
                    : <><Plus size={15} strokeWidth={3} /> Build</>}
              </button>

              {/* ステータスチップ: タップで「このステータスが得られるアイテム」一覧
                  モバイルは行レイアウト（ラベル左・大きな数値右）、sm以上はピル */}
              {chips.length > 0 && (
                <div className="mt-4 flex flex-col items-stretch gap-2 max-w-xs mx-auto
                  sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
                  {chips.map((c, i) => {
                    // 上下パディングは非対称（インク沈み約2pxの光学補正）
                    const layout = `flex items-baseline justify-between gap-2 rounded-lg px-4 pt-[8px] pb-[12px]
                      sm:inline-flex sm:justify-start sm:rounded-full sm:pt-[6px] sm:pb-[10px]`;
                    // ラベルはmutedだとモバイルで読みにくいため明るめ、数値はData voice
                    const inner = (
                      <>
                        <span className="text-foreground/85 text-sm sm:text-xs">{c.plain}</span>
                        <span className="num-data text-2xl sm:text-lg leading-none">{c.value}</span>
                      </>
                    );
                    return c.key ? (
                      <button
                        key={i}
                        onClick={() => openSheet(c.key!, STAT_KEY_LABELS[c.key!] ?? c.plain)}
                        className={`${layout} bg-card/95 border border-primary/35 hover:border-primary/70 hover:bg-card transition-colors`}
                        title={`${STAT_KEY_LABELS[c.key] ?? c.plain}が得られるアイテムを見る`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <span key={i} className={`${layout} bg-card/70 border border-border`}>
                        {inner}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* 効果 */}
              {bodyHtml && (
                <div
                  className="mt-5 text-left bg-card/95 border border-border border-l-[3px] border-l-primary/60 rounded-md px-4 py-3"
                  onClick={handleDescClick}
                  onKeyDown={handleDescKeyDown}
                >
                  <ZoneLabel className="mb-1.5">効果 EFFECT</ZoneLabel>
                  <div
                    className="text-[13px] text-foreground leading-relaxed item-description"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                </div>
              )}

              <div className="mt-4"><Joint /></div>
            </section>

            {/* 進化先（右列） */}
            <section className="lg:pt-10">
              <ZoneLabel className="mb-2.5">進化 NEXT</ZoneLabel>
              {item.into.length > 0 ? (
                <div className="max-w-xs mx-auto lg:max-w-none">
                  <EvolutionCluster into={item.into} />
                </div>
              ) : (
                <div className="max-w-xs mx-auto lg:max-w-none"><FinalForm /></div>
              )}
            </section>
          </div>

          {/* ウサギの穴: 主要ステータスの上位アイテムへ */}
          {primaryStatKey && (
            <RelatedByStat
              statKey={primaryStatKey}
              excludeId={item.id}
              items={statMap.get(primaryStatKey) ?? []}
              onShowAll={openSheet}
            />
          )}
        </div>
      </div>

      <BuildTray />

      <BottomSheet
        isOpen={activeStatKey !== null}
        label={activeLabel}
        statKey={activeStatKey ?? ''}
        items={statMap.get(activeStatKey ?? '') ?? []}
        mediumItems={mediumStatMap.get(activeStatKey ?? '') ?? []}
        onClose={() => { setActiveStatKey(null); setActiveLabel(''); }}
      />
    </div>
  );
}
