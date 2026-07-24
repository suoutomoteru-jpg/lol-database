import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { useChampions } from '../hooks/useChampions';
import { useItems } from '../hooks/useItems';
import { prefetchChampion, prefetchItem } from '../utils/prefetch';

/**
 * チャンピオン詳細・アイテム詳細のヘッダーに置く控えめな検索ボックス。
 *
 * ホームの検索と違いオートフォーカスしない（詳細ページに来た直後の
 * フォーカスを奪わないため）。入力すると即その場でドロップダウンに
 * チャンピオン/アイテムの候補が出て、クリックでそのまま遷移する
 * （QuickSwitchPanelが「アイテム内」の切替なのに対し、こちらは
 * チャンピオン⇔アイテムを横断できるのが役割）。
 */

const MAX_RESULTS = 7;

export function HeaderSearch() {
  const { champions } = useChampions();
  const { items } = useItems();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const champHits = champions
      .filter(c => c.name.toLowerCase().includes(q))
      .map(c => ({ kind: 'champion' as const, id: c.id, name: c.name, icon: c.icon }));
    const itemHits = items
      .filter(i => i.name.toLowerCase().includes(q))
      .map(i => ({ kind: 'item' as const, id: i.id, name: i.name, icon: i.icon }));
    // 前方一致を優先
    const rank = (name: string) => (name.toLowerCase().startsWith(q) ? 0 : 1);
    return [...champHits, ...itemHits]
      .sort((a, b) => rank(a.name) - rank(b.name))
      .slice(0, MAX_RESULTS);
  }, [query, champions, items]);

  // 外側クリック・Escapeで閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); } };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function go(kind: 'champion' | 'item', id: string) {
    setQuery('');
    setOpen(false);
    navigate(kind === 'champion' ? `/champion/${id}` : `/item/${id}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results.length > 0) {
      go(results[0].kind, results[0].id);
    } else if (query.trim()) {
      navigate(`/?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-32 sm:w-56">
      <form onSubmit={onSubmit}>
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="検索"
          aria-label="チャンピオン・アイテムを検索"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-background/60 border border-border/70 rounded-full py-1.5 pl-8 pr-3 text-xs text-foreground
            placeholder:text-muted-foreground/60
            focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
            transition-colors duration-150"
        />
      </form>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 max-w-[80vw] bg-card border border-border rounded-md
            shadow-[0_8px_24px_rgba(0,0,0,.45)] overflow-hidden"
        >
          {results.map(r => (
            <li key={`${r.kind}:${r.id}`}>
              <button
                type="button"
                onPointerEnter={() => (r.kind === 'champion' ? prefetchChampion(r.id) : prefetchItem())}
                onClick={() => go(r.kind, r.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors"
              >
                <img src={r.icon} alt="" className="w-7 h-7 rounded-sm border border-border flex-shrink-0 object-cover" loading="lazy" />
                <span className="min-w-0 flex-1 text-sm text-foreground truncate">{r.name}</span>
                <span className="flex-shrink-0 text-[10px] text-muted-foreground/60">
                  {r.kind === 'champion' ? 'チャンピオン' : 'アイテム'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
