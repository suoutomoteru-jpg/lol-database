import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SearchBar } from '../components/SearchBar';
import { TabsFilter } from '../components/TabsFilter';
import { FilterBar } from '../components/FilterBar';
import { ResultsSection } from '../components/ResultsSection';
import { useChampions } from '../hooks/useChampions';
import { useItems } from '../hooks/useItems';
import { usePatchChanges } from '../hooks/usePatchChanges';
import { displayPatch } from '../utils/patch';
import { prefetchItem } from '../utils/prefetch';
import type { TabType, Role, ItemType, Item } from '../types/app';
import type { ItemChange } from '../api/patchDiff';

// ── 今パッチの変更アイテム（新規性シグナル: 再訪問時の発見をつくる）──

function PatchChangesStrip({ items, changes }: {
  items: Item[];
  changes: Record<string, ItemChange>;
}) {
  const changed = useMemo(
    () => items.filter(i => changes[i.id]),
    [items, changes],
  );
  if (changed.length === 0) return null;

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-sm font-semibold text-foreground mb-1.5">
        今パッチの変更
        <span className="ml-2 text-xs font-normal text-muted-foreground">数値やレシピが変わったアイテム</span>
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-1 px-1">
        {changed.map(i => (
          <Link
            key={i.id}
            to={`/item/${i.id}`}
            onPointerEnter={prefetchItem}
            onTouchStart={prefetchItem}
            className="flex-shrink-0 flex items-center gap-2 bg-card border border-border rounded-md pl-1.5 pr-2.5 py-1.5
              hover:border-hextech/50 transition-colors"
          >
            <img src={i.icon} alt="" className="w-8 h-8 rounded-sm border border-border" loading="lazy" />
            <span className="text-xs font-medium whitespace-nowrap">{i.name}</span>
            <span className="text-[10px] font-bold text-hextech border border-hextech/40 rounded-sm px-1 leading-4">
              {changes[i.id] === 'new' ? 'NEW' : '変更'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── ロード中のスケルトン（カードと同じ形状・レイアウトシフトなし）──

function ResultsSkeleton() {
  return (
    <div className="w-full max-w-4xl" aria-hidden>
      <div className="h-4 w-24 bg-card rounded-sm mb-2 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card animate-pulse">
            <div className="w-10 h-10 flex-shrink-0 rounded-sm bg-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 bg-secondary rounded-sm" />
              <div className="h-2 w-1/3 bg-secondary/60 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Home() {
  const { champions, version, loading: champLoading } = useChampions();
  const { items, loading: itemLoading } = useItems();
  const patchDiff = usePatchChanges();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab        = (searchParams.get('tab') as TabType) ?? 'items';
  const searchQuery      = searchParams.get('q')                ?? '';
  const selectedRole     = (searchParams.get('role') as Role | 'all') ?? 'all';
  const selectedItemType = (searchParams.get('itype') as ItemType | 'all') ?? 'all';

  function set(key: string, value: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  function handleTabChange(tab: TabType) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      next.delete('role');
      next.delete('itype');
      return next;
    }, { replace: true });
  }

  const q = searchQuery.toLowerCase();

  const filteredChampions = useMemo(() => {
    if (activeTab === 'items') return [];
    return champions.filter(c => {
      if (!c.name.toLowerCase().includes(q)) return false;
      return selectedRole === 'all' || c.role === selectedRole;
    });
  }, [champions, q, activeTab, selectedRole]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'champions') return [];
    return items.filter(item => {
      if (!item.name.toLowerCase().includes(q)) return false;
      return selectedItemType === 'all' || item.type === selectedItemType;
    });
  }, [items, q, activeTab, selectedItemType]);

  const loading = champLoading || itemLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* 上部バー: ロゴ + 現行パッチ */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 max-w-6xl h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="font-display font-black text-xl text-primary tracking-wide whitespace-nowrap">
              nunune<span className="text-hextech">.gg</span>
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground truncate">はやくて見やすい、LoLのデータベース。</p>
          </div>
          {version && (
            <span className="flex-shrink-0 px-2.5 pt-[3px] pb-[5px] text-xs text-muted-foreground tabular-nums rounded-sm border border-border bg-card">
              パッチ {displayPatch(version)}
            </span>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 pb-6 max-w-6xl">
        <div className="flex flex-col items-center gap-5">
          {/* タグライン */}
          <h2 className="text-center text-xl sm:text-2xl font-bold text-foreground leading-snug text-balance">
            はやくて見やすい、<span className="font-display font-black text-primary tracking-wide [text-shadow:0_0_18px_rgba(255,143,198,.55)]">LoL</span>のデータベース。
          </h2>

          <SearchBar value={searchQuery} onChange={v => set('q', v)} />

          {/* 今パッチの変更 = 再訪時の発見をファーストビューに */}
          {!loading && !q && patchDiff && (
            <PatchChangesStrip items={items} changes={patchDiff.changes} />
          )}

          <TabsFilter activeTab={activeTab} onTabChange={handleTabChange} />
          <FilterBar
            activeTab={activeTab}
            selectedRole={selectedRole}
            selectedItemType={selectedItemType}
            onRoleChange={r => set('role', r)}
            onItemTypeChange={t => set('itype', t)}
          />

          {loading ? (
            <ResultsSkeleton />
          ) : (
            <ResultsSection
              champions={filteredChampions}
              items={filteredItems}
              activeTab={activeTab}
              itemChanges={patchDiff?.changes}
            />
          )}
        </div>
      </div>
    </div>
  );
}
