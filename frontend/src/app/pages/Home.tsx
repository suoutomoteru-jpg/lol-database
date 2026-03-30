import { useState, useMemo } from 'react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedRole, setSelectedRole] = useState<Role | 'all'>('all');
  const [selectedItemType, setSelectedItemType] = useState<ItemType | 'all'>('all');
  const [allTabRoleFilter, setAllTabRoleFilter] = useState<Role | 'all'>('all');
  const [allTabItemTypeFilter, setAllTabItemTypeFilter] = useState<ItemType | 'all'>('all');

  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
    setSelectedRole('all');
    setSelectedItemType('all');
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
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center gap-8">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <TabsFilter activeTab={activeTab} onTabChange={handleTabChange} />
          <FilterBar
            activeTab={activeTab}
            selectedRole={selectedRole}
            selectedItemType={selectedItemType}
            onRoleChange={setSelectedRole}
            onItemTypeChange={setSelectedItemType}
          />

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm">Loading from Data Dragon...</p>
            </div>
          ) : (
            <ResultsSection
              champions={activeTab === 'items' ? [] : filteredChampions}
              items={activeTab === 'champions' ? [] : filteredItems}
              activeTab={activeTab}
              allTabRoleFilter={allTabRoleFilter}
              allTabItemTypeFilter={allTabItemTypeFilter}
              onAllTabRoleChange={setAllTabRoleFilter}
              onAllTabItemTypeChange={setAllTabItemTypeFilter}
            />
          )}
        </div>
      </div>
    </div>
  );
}
