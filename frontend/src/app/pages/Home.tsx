import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SearchBar } from '../components/SearchBar';
import { TabsFilter } from '../components/TabsFilter';
import { FilterBar } from '../components/FilterBar';
import { ResultsSection } from '../components/ResultsSection';
import { useChampions } from '../hooks/useChampions';
import { useItems } from '../hooks/useItems';
import type { TabType, Role, ItemType } from '../data/mock-data';

export function Home() {
  const { champions, loading: champLoading } = useChampions();
  const { items, loading: itemLoading } = useItems();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab        = (searchParams.get('tab') as TabType)       ?? 'all';
  const searchQuery      = searchParams.get('q')                       ?? '';
  const selectedRole     = (searchParams.get('role') as Role | 'all') ?? 'all';
  const selectedItemType = (searchParams.get('itype') as ItemType | 'all') ?? 'all';
  const allTabRoleFilter     = (searchParams.get('arole') as Role | 'all')     ?? 'all';
  const allTabItemTypeFilter = (searchParams.get('aitype') as ItemType | 'all') ?? 'all';

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
      if (tab !== 'all') next.set('tab', tab); else next.delete('tab');
      next.delete('role');
      next.delete('itype');
      return next;
    }, { replace: true });
  }

  const q = searchQuery.toLowerCase();

  const filteredChampions = useMemo(() => {
    return champions.filter(c => {
      if (!c.name.toLowerCase().includes(q)) return false;
      const filter = activeTab === 'all' ? allTabRoleFilter : selectedRole;
      return filter === 'all' || c.role === filter;
    });
  }, [champions, q, activeTab, allTabRoleFilter, selectedRole]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'champions') return [];
    return items.filter(item => {
      if (!item.name.toLowerCase().includes(q)) return false;
      const filter = activeTab === 'all' ? allTabItemTypeFilter : selectedItemType;
      return filter === 'all' || item.type === filter;
    });
  }, [items, q, activeTab, allTabItemTypeFilter, selectedItemType]);

  const loading = champLoading || itemLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-10 pb-6 max-w-6xl">
        <div className="flex flex-col items-center gap-5">
          {/* Site header */}
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold text-primary tracking-wide uppercase">LoL Database</h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">League of Legends Encyclopedia</p>
          </div>

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
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs tracking-widest uppercase">Loading...</p>
            </div>
          ) : (
            <ResultsSection
              champions={activeTab === 'items' ? [] : filteredChampions}
              items={activeTab === 'champions' ? [] : filteredItems}
              activeTab={activeTab}
              allTabRoleFilter={allTabRoleFilter}
              allTabItemTypeFilter={allTabItemTypeFilter}
              onAllTabRoleChange={r => set('arole', r)}
              onAllTabItemTypeChange={t => set('aitype', t)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
