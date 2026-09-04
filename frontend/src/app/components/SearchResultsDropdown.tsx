import { prefetchChampion, prefetchItem } from '../utils/prefetch';
import type { CrossSearchResult } from '../hooks/useCrossSearchResults';

interface SearchResultsDropdownProps {
  results: CrossSearchResult[];
  onSelect: (kind: 'champion' | 'item', id: string) => void;
  className?: string;
}

/** チャンピオン/アイテム横断の検索候補リスト（HeaderSearch・Home検索共通） */
export function SearchResultsDropdown({ results, onSelect, className = '' }: SearchResultsDropdownProps) {
  if (results.length === 0) return null;

  return (
    <ul
      role="listbox"
      className={`absolute z-30 bg-card border border-border rounded-md shadow-[0_8px_24px_rgba(0,0,0,.45)] overflow-hidden ${className}`}
    >
      {results.map(r => (
        <li key={`${r.kind}:${r.id}`}>
          <button
            type="button"
            onPointerEnter={() => (r.kind === 'champion' ? prefetchChampion(r.id) : prefetchItem())}
            onClick={() => onSelect(r.kind, r.id)}
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
  );
}
