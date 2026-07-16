import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import type { ItemSummary } from '../hooks/useItemsByStats';

/**
 * ボトムシート（依存ライブラリなし）
 *
 * 開閉は CSS transition（translateY / opacity）で行う。
 * isOpen=true でマウント → 次フレームで表示位置へ、
 * isOpen=false で退場位置へ → transition 終了後にアンマウント。
 */

interface BottomSheetProps {
  isOpen: boolean;
  label: string;
  statKey: string;
  items: ItemSummary[];
  mediumItems: ItemSummary[];
  onClose: () => void;
}

const EXIT_MS = 200;

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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showMedium, setShowMedium] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // 開閉のマウント制御 + トランジション発火
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // マウント直後の2フレーム目で表示位置へ（初期位置からの transition を確実に発火させる）
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Reset toggle when stat changes (no remount — just prop update)
  useEffect(() => { setShowMedium(false); }, [statKey]);

  const displayed = showMedium ? mediumItems : items;
  const hasMore = mediumItems.length > items.length;
  const sorted = useMemo(() => sortItems(displayed, label), [displayed, label]);

  // ── Swipe-to-close (header area only) ────────────────
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;

    const el = sheetRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
    if (delta > 90) onClose();
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-150 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-card rounded-t-2xl border-t border-border shadow-2xl
          transition-transform duration-200 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '87dvh' }}
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
              className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded-sm"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sorted.length === 0 ? (
            <p className="px-4 py-12 text-sm text-muted-foreground text-center">
              該当アイテムなし
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map(it => (
                <li key={it.id}>
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
                            className="flex items-baseline justify-end gap-2 whitespace-nowrap"
                          >
                            <span className="text-xs text-foreground/70">{s.label}</span>
                            <span className="text-base text-white font-bold tabular-nums">
                              {s.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
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
          <div className="h-6" />
        </div>
      </div>
    </>
  );
}
