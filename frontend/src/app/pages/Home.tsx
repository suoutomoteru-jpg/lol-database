import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SearchBar } from '../components/SearchBar';
import { TabsFilter } from '../components/TabsFilter';
import { FilterBar } from '../components/FilterBar';
import { ResultsSection } from '../components/ResultsSection';
import { useChampions } from '../hooks/useChampions';
import { useItems } from '../hooks/useItems';
import { displayPatch } from '../utils/patch';
import type { TabType, Role, ItemType } from '../types/app';

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
            <h1 className="font-display font-normal text-xl text-primary tracking-wide whitespace-nowrap">nunune.gg</h1>
            <p className="hidden sm:block text-xs text-muted-foreground truncate">League of Legends データベース</p>
          </div>
          {version && (
            <span className="flex-shrink-0 px-2.5 py-1 text-xs text-muted-foreground tabular-nums rounded-sm border border-border bg-card">
              パッチ {displayPatch(version)}
            </span>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 pb-6 max-w-6xl">
        <div className="flex flex-col items-center gap-5">
          <SearchBar value={searchQuery} onChange={v => set('q', v)} />
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
