import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { X, Home } from 'lucide-react';

/**
 * チャンピオン/アイテム詳細共通のクイック切替パネル
 *
 * 右下に9マス（3×3）のミニアイコン吹き出しを常設し、タップすると
 * 右からグリッドのパネルが出る。アイコンをタップで即その詳細へ。
 * ページ遷移してもパネルは開いたまま＝連続比較のための装置なので、
 * 開閉状態とタブは instanceKey（'item' | 'champion'）単位で
 * モジュールスコープに保持し、ルーティングをまたいでも消えない。
 */

export interface QuickSwitchEntry {
  id: string;
  name: string;
  icon: string;
  /** カテゴリキー（アイテムはItemType、チャンピオンはRole） */
  category: string;
}

// instanceKey（'item' | 'champion'）ごとに開閉状態・タブを独立して保持する
const persisted = new Map<string, { open: boolean; tab: string | null }>();
function getPersisted(key: string) {
  if (!persisted.has(key)) persisted.set(key, { open: false, tab: null });
  return persisted.get(key)!;
}

interface QuickSwitchPanelProps {
  instanceKey: 'item' | 'champion';
  entries: QuickSwitchEntry[];
  currentId: string;
  categoryOrder: string[];
  categoryLabels: Record<string, string>;
  basePath: string; // '/item' | '/champion'
  title: string;    // "アイテムをえらぶ" | "チャンピオンをえらぶ"
  onHover?: (id: string) => void;
}

export function QuickSwitchPanel({
  instanceKey, entries, currentId, categoryOrder, categoryLabels, basePath, title, onHover,
}: QuickSwitchPanelProps) {
  const state = getPersisted(instanceKey);
  const currentCategory = entries.find(i => i.id === currentId)?.category ?? null;
  const [open, setOpen] = useState(state.open);
  const [tab, setTab] = useState<string>(state.tab ?? currentCategory ?? categoryOrder[0]);

  const setOpenPersist = (v: boolean) => { state.open = v; setOpen(v); };
  const setTabPersist = (t: string) => { state.tab = t; setTab(t); };

  // 閉じている間は、いま見ているアイテム/チャンピオンのカテゴリにタブを追従させる
  useEffect(() => {
    if (!open && currentCategory) { state.tab = currentCategory; setTab(currentCategory); }
  }, [currentCategory, open, state]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPersist(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 吹き出しの9マス: 同カテゴリ内で現在アイテムの周辺を切り出す
  const bubbleEntries = useMemo(() => {
    const sameCategory = entries.filter(i => i.category === (currentCategory ?? tab));
    const idx = sameCategory.findIndex(i => i.id === currentId);
    const start = Math.max(0, Math.min(idx < 0 ? 0 : idx - 4, sameCategory.length - 9));
    return sameCategory.slice(start, start + 9);
  }, [entries, currentId, currentCategory, tab]);

  const gridEntries = useMemo(() => entries.filter(i => i.category === tab), [entries, tab]);

  if (entries.length === 0) return null;

  return (
    <>
      {/* 吹き出しボタン（パネル展開中は非表示） */}
      {!open && bubbleEntries.length > 0 && (
        <button
          onClick={() => setOpenPersist(true)}
          aria-label={title}
          title={title}
          className="fixed right-2 bottom-28 z-30 grid grid-cols-3 gap-[3px] w-[48px] h-[48px] p-[6px]
            rounded-[13px] bg-card border border-border shadow-[0_4px_16px_rgba(0,0,0,.45)]
            ring-1 ring-primary/40 ring-offset-4 ring-offset-transparent
            transition-transform hover:scale-105 active:scale-95"
        >
          {bubbleEntries.map(i => (
            <img key={i.id} src={i.icon} alt="" className="w-full h-full rounded-[3px] object-cover" loading="lazy" />
          ))}
        </button>
      )}

      {open && (
        <>
          {/* Backdrop */}
          <div
            aria-hidden
            className="fixed inset-0 bg-black/55 z-40"
            onClick={() => setOpenPersist(false)}
          />
          {/* Panel */}
          <aside
            role="dialog"
            aria-label={title}
            className="fixed inset-y-0 right-0 z-50 w-[196px] bg-card border-l border-border flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2.5 border-b border-border">
              <span className="text-xs font-bold text-foreground">{title}</span>
              <div className="flex items-center gap-0.5">
                <Link
                  to="/"
                  aria-label="ホームに戻る"
                  title="ホームに戻る"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm"
                >
                  <Home size={15} />
                </Link>
                <button
                  onClick={() => setOpenPersist(false)}
                  aria-label="閉じる"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded-sm"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 px-2 pt-2 pb-1">
              {categoryOrder.map(c => {
                const active = tab === c;
                return (
                  <button
                    key={c}
                    onClick={() => setTabPersist(c)}
                    aria-pressed={active}
                    className={`text-[9px] border rounded-full px-2 pt-px pb-[2px] transition-colors ${
                      active
                        ? 'border-primary/60 text-primary bg-primary/10'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {categoryLabels[c] ?? c}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-2">
              <div className="grid grid-cols-4 gap-1">
                {gridEntries.map(i => {
                  const isCurrent = i.id === currentId;
                  return (
                    <Link
                      key={i.id}
                      to={`${basePath}/${i.id}`}
                      title={i.name}
                      aria-current={isCurrent ? 'page' : undefined}
                      onPointerEnter={() => onHover?.(i.id)}
                      onTouchStart={() => onHover?.(i.id)}
                      className={`block aspect-square rounded-md overflow-hidden border transition-colors ${
                        isCurrent
                          ? 'border-primary border-2 shadow-[0_0_10px_rgba(255,143,198,.5)]'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <img src={i.icon} alt={i.name} className="w-full h-full object-cover" loading="lazy" />
                    </Link>
                  );
                })}
              </div>
              <div className="h-4" />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
