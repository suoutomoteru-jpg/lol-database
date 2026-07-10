import { useState, useCallback, Fragment } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useItem } from '../hooks/useItem';
import { useItems } from '../hooks/useItems';
import { useItemsByStats } from '../hooks/useItemsByStats';
import { BottomSheet } from '../components/BottomSheet';
import { processItemDescription, injectStatLinks } from '../utils/richText';
import { calcGoldEfficiency } from '../utils/goldEfficiency';
import { STAT_KEY_LABELS } from '../utils/stats';

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

// ── ビルドパスツリー ───────────────────────────────────

interface PathItem { id: string; name: string; imageUrl: string }

function PathNode({ item }: { item: PathItem }) {
  return (
    <Link
      to={`/item/${item.id}`}
      className="group flex flex-col items-center w-20"
      title={item.name}
    >
      <img
        src={item.imageUrl}
        alt=""
        className="w-11 h-11 rounded-md border border-border group-hover:border-primary/50 transition-colors"
        loading="lazy"
      />
      <span className="mt-1.5 text-[11px] leading-tight text-center line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
        {item.name}
      </span>
    </Link>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1 text-border" aria-hidden>
      <div className="h-3.5 w-px bg-border" />
      <ChevronDown size={12} className="-mt-1" />
    </div>
  );
}

/**
 * 素材 → このアイテム → アップグレード先 の3段ツリー
 */
function BuildPath({ item }: {
  item: { name: string; imageUrl: string; from: PathItem[]; into: PathItem[] };
}) {
  if (item.from.length === 0 && item.into.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="text-sm font-semibold text-foreground mb-4">ビルドパス</p>
      <div className="flex flex-col items-center">
        {item.from.length > 0 && (
          <>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-3">
              {item.from.map(comp => <PathNode key={comp.id} item={comp} />)}
            </div>
            <Connector />
          </>
        )}

        {/* 中央: このアイテム */}
        <div className="flex flex-col items-center w-24">
          <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-md border-2 border-primary/70" />
          <span className="mt-1.5 text-[11px] leading-tight text-center text-foreground font-medium line-clamp-2">
            {item.name}
          </span>
        </div>

        {item.into.length > 0 && (
          <>
            <Connector />
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-3">
              {item.into.map(up => <PathNode key={up.id} item={up} />)}
            </div>
          </>
        )}
      </div>
    </div>
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

// ── メインページ ───────────────────────────────────────

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { item, loading, error } = useItem(id);
  const { items } = useItems();
  const { statMap, mediumStatMap } = useItemsByStats();
  const [activeStatKey, setActiveStatKey] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');

  const currentIdx = items.findIndex(it => it.id === id);
  const prevItem = currentIdx > 0 ? items[currentIdx - 1] : null;
  const nextItem = currentIdx >= 0 && currentIdx < items.length - 1 ? items[currentIdx + 1] : null;

  const handleDescClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.stat;
    if (key) {
      setActiveStatKey(key);
      setActiveLabel(STAT_KEY_LABELS[key] ?? target.textContent ?? '');
    }
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      {prevItem && (
        <Link
          to={`/item/${prevItem.id}`}
          title={prevItem.name}
          className="fixed left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {nextItem && (
        <Link
          to={`/item/${nextItem.id}`}
          title={nextItem.name}
          className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronRight size={16} />
        </Link>
      )}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-2.5 max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            戻る
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 max-w-4xl space-y-3">

        {/* ヘッダー: アイコン + 名前 + 価格/金銭効率メーター */}
        <div className="bg-card border border-border rounded-md p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-20 h-20 rounded-md border-2 border-primary/40 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h1
                className="text-2xl font-bold text-foreground leading-tight"
                style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
              >
                <WbrName text={item.name} />
              </h1>
              {item.englishName && item.englishName !== item.name && (
                <p className="font-display text-sm text-muted-foreground/70 mt-0.5 leading-tight">{item.englishName}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              <p className="text-right text-xl font-bold text-primary tabular-nums leading-tight">
                {item.gold.total}<span className="text-sm font-semibold ml-0.5">G</span>
              </p>
              {goldEfficiency !== null && (
                <div className="mt-2 w-40">
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
            </div>
          </div>
        </div>

        {/* md以上: 左=ステータス+ビルドパス / 右=効果 */}
        <div className="grid md:grid-cols-[260px_1fr] gap-3 items-start">
          {statLines.length > 0 && (
            <div className="bg-card border border-border rounded-md md:col-start-1" onClick={handleDescClick}>
              <p className="px-4 pt-3 pb-1.5 text-sm font-semibold text-foreground">ステータス</p>
              <div className="px-4 pb-2">
                {statLines.map((line, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm border-t border-border/50 first:border-t-0"
                  >
                    <span
                      className="text-muted-foreground min-w-0"
                      dangerouslySetInnerHTML={{ __html: line.label }}
                    />
                    <span className="flex-shrink-0 font-semibold text-foreground tabular-nums">{line.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bodyHtml && (
            <div className="bg-card border border-border rounded-md p-4 md:col-start-2 md:row-start-1 md:row-span-2">
              <p className="text-sm font-semibold text-foreground mb-2">効果</p>
              <div
                className="text-sm text-foreground leading-relaxed item-description"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
                onClick={handleDescClick}
              />
            </div>
          )}

          <div className="md:col-start-1">
            <BuildPath item={item} />
          </div>
        </div>
      </div>

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
