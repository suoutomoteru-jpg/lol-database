import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { useChampions } from '../hooks/useChampions';
import { useItems } from '../hooks/useItems';
import { useCrossSearchResults } from '../hooks/useCrossSearchResults';
import { useOutsideClose } from '../hooks/useOutsideClose';
import { SearchResultsDropdown } from './SearchResultsDropdown';

/**
 * チャンピオン詳細・アイテム詳細のヘッダーに置く控えめな検索ボックス。
 *
 * ホームの検索と違いオートフォーカスしない（詳細ページに来た直後の
 * フォーカスを奪わないため）。入力すると即その場でドロップダウンに
 * チャンピオン/アイテムの候補が出て、クリックでそのまま遷移する
 * （QuickSwitchPanelが「アイテム内」の切替なのに対し、こちらは
 * チャンピオン⇔アイテムを横断できるのが役割）。
 */

export function HeaderSearch() {
  const { champions } = useChampions();
  const { items } = useItems();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useCrossSearchResults(query, champions, items);

  const closeAndBlur = useCallback(() => { setOpen(false); inputRef.current?.blur(); }, []);
  useOutsideClose(wrapRef, open, closeAndBlur);

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

      {open && (
        <SearchResultsDropdown
          results={results}
          onSelect={go}
          className="right-0 top-[calc(100%+6px)] w-64 max-w-[80vw]"
        />
      )}
    </div>
  );
}
