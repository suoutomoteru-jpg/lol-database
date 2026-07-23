import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { ITEM_TYPE_LABELS_JA } from '../utils/roleAssets';
import { prefetchItem } from '../utils/prefetch';
import type { Item, ItemType } from '../types/app';

/**
 * アイテム詳細のクイック切替パネル
 *
 * 右下に9マス（3×3）のミニアイコン吹き出しを常設し、タップすると
 * 右から3列グリッドのパネルが出る。アイコンをタップで即その詳細へ。
 * ページ遷移してもパネルは開いたまま＝連続比較のための装置なので、
 * 開閉状態とタブはモジュールスコープでルーティングをまたいで保持する。
 */

const TYPE_ORDER: ItemType[] = ['Fighter', 'Marksman', 'Assassin', 'Magic', 'Defense', 'Support'];

let persistedOpen = false;
let persistedTab: ItemType | null = null;

interface QuickSwitchPanelProps {
  items: Item[];
  currentId: string;
}

export function QuickSwitchPanel({ items, currentId }: QuickSwitchPanelProps) {
  const currentType = items.find(i => i.id === currentId)?.type ?? null;
  const [open, setOpen] = useState(persistedOpen);
  const [tab, setTab] = useState<ItemType>(persistedTab ?? currentType ?? 'Fighter');

  const setOpenPersist = (v: boolean) => { persistedOpen = v; setOpen(v); };
  const setTabPersist = (t: ItemType) => { persistedTab = t; setTab(t); };

  // 閉じている間は、いま見ているアイテムのカテゴリにタブを追従させる
  useEffect(() => {
    if (!open && currentType) { persistedTab = currentType; setTab(currentType); }
  }, [currentType, open]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPersist(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 吹き出しの9マス: 同カテゴリ内で現在アイテムの周辺を切り出す
  const bubbleItems = useMemo(() => {
    const sameType = items.filter(i => i.type === (currentType ?? tab));
    const idx = sameType.findIndex(i => i.id === currentId);
    const start = Math.max(0, Math.min(idx < 0 ? 0 : idx - 4, sameType.length - 9));
    return sameType.slice(start, start + 9);
  }, [items, currentId, currentType, tab]);

  const gridItems = useMemo(() => items.filter(i => i.type === tab), [items, tab]);

  if (items.length === 0) return null;

  return (
    <>
      {/* 吹き出しボタン（パネル展開中は非表示） */}
      {!open && bubbleItems.length > 0 && (
        <button
          onClick={() => setOpenPersist(true)}
          aria-label="他のアイテムをえらぶ"
          title="他のアイテムをえらぶ"
          className="fixed right-2 bottom-28 z-30 grid grid-cols-3 gap-[3px] w-[52px] h-[52px] p-[7px]
            rounded-[14px] bg-card border border-border shadow-[0_4px_16px_rgba(0,0,0,.45)]
            ring-1 ring-primary/40 ring-offset-4 ring-offset-transparent
            transition-transform hover:scale-105 active:scale-95"
        >
          {bubbleItems.map(i => (
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
            aria-label="アイテムをえらぶ"
            className="fixed inset-y-0 right-0 z-50 w-[232px] bg-card border-l border-border flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2.5 border-b border-border">
              <span className="text-sm font-bold text-foreground">アイテムをえらぶ</span>
              <button
                onClick={() => setOpenPersist(false)}
                aria-label="閉じる"
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded-sm"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5 pb-1">
              {TYPE_ORDER.map(t => {
                const active = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTabPersist(t)}
                    aria-pressed={active}
                    className={`text-[10px] border rounded-full px-2.5 pt-px pb-[3px] transition-colors ${
                      active
                        ? 'border-primary/60 text-primary bg-primary/10'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {ITEM_TYPE_LABELS_JA[t]}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {gridItems.map(i => {
                  const isCurrent = i.id === currentId;
                  return (
                    <Link
                      key={i.id}
                      to={`/item/${i.id}`}
                      title={i.name}
                      aria-current={isCurrent ? 'page' : undefined}
                      onPointerEnter={prefetchItem}
                      onTouchStart={prefetchItem}
                      className={`block aspect-square rounded-lg overflow-hidden border transition-colors ${
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
