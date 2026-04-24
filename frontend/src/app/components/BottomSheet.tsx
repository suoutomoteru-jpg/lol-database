import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import type { ItemSummary } from '../hooks/useItemsByStats';

interface BottomSheetProps {
  isOpen: boolean;
  label: string;
  statKey: string;
  items: ItemSummary[];
  mediumItems: ItemSummary[];
  onClose: () => void;
}

const ENTER_EASE = [0.32, 0.72, 0, 1] as const;

function parseNum(v: string) {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
}

function sortItems(items: ItemSummary[], primaryLabel: string): ItemSummary[] {
  return [...items].sort((a, b) => {
    const get = (item: ItemSummary) => {
      const match = item.stats.find(s => s.label === primaryLabel);
      if (match) return parseNum(match.value);
      return Math.max(0, ...item.stats.map(s => parseNum(s.value)));
    };
    return get(b) - get(a);
  });
}

export function BottomSheet({
  isOpen, label, statKey, items, mediumItems, onClose,
}: BottomSheetProps) {
  const [showMedium, setShowMedium] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef(0);

  // Reset toggle when stat changes (no remount — just prop update)
  useEffect(() => { setShowMedium(false); }, [statKey]);

  const displayed = showMedium ? mediumItems : items;
  const hasMore = mediumItems.length > items.length;
  const sorted = sortItems(displayed, label);

  // ── Swipe-to-close (header area only) ────────────────
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    dragCurrentY.current = 0;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    dragCurrentY.current = delta;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;

    if (delta > 90) {
      onClose();
    } else {
      // Snap back with spring
      if (sheetRef.current) {
        const el = sheetRef.current;
        animate(dragCurrentY.current, 0, {
          type: 'spring',
          stiffness: 500,
          damping: 40,
          onUpdate: v => { el.style.transform = `translateY(${v}px)`; },
          onComplete: () => { el.style.transform = ''; },
        });
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-card rounded-t-2xl border-t border-border shadow-2xl"
            style={{ height: '87dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
            transition={{ type: 'tween', duration: 0.22, ease: ENTER_EASE }}
          >
            {/* Drag handle + header (swipe area) */}
            <div
              className="flex-shrink-0 select-none touch-none cursor-grab active:cursor-grabbing pt-3"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
            >
              <div className="w-10 h-1 bg-border/70 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={statKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  {sorted.length === 0 ? (
                    <p className="px-4 py-12 text-sm text-muted-foreground text-center">
                      該当アイテムなし
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {sorted.map(it => (
                        <li key={it.id}>
                          <motion.div whileTap={{ scale: 0.985 }} transition={{ duration: 0.08 }}>
                            <Link
                              to={`/item/${it.id}`}
                              onClick={onClose}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                            >
                              <img
                                src={it.imageUrl}
                                alt={it.name}
                                className="w-10 h-10 rounded-sm border border-border flex-shrink-0"
                                loading="lazy"
                              />
                              <span className="flex-1 min-w-0 text-sm text-foreground font-medium leading-tight truncate">
                                {it.name}
                              </span>
                              {it.stats.length > 0 && (
                                <div className="flex-shrink-0 space-y-0.5">
                                  {it.stats.slice(0, 2).map(s => (
                                    <div
                                      key={s.label}
                                      className="flex items-center justify-end gap-2 text-xs whitespace-nowrap"
                                    >
                                      <span className="text-muted-foreground">{s.label}</span>
                                      <span className="text-primary font-semibold tabular-nums">
                                        {s.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </Link>
                          </motion.div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {hasMore && (
                    <div className="border-t border-border">
                      <button
                        onClick={() => setShowMedium(v => !v)}
                        className="w-full px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                      >
                        {showMedium ? '完成アイテムのみ表示' : 'コンポーネントも表示'}
                      </button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="h-6" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
