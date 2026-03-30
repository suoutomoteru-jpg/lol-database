import type { TabType } from '../data/mock-data';

interface TabsFilterProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: { key: TabType; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'champions', label: 'Champions' },
  { key: 'items',     label: 'Items' },
];

export function TabsFilter({ activeTab, onTabChange }: TabsFilterProps) {
  return (
    <div className="flex gap-2 bg-muted/30 rounded-lg p-1">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-6 py-2 rounded-md transition-all ${
            activeTab === tab.key
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={activeTab === tab.key}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
