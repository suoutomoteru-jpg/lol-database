import type { TabType } from '../types/app';

interface TabsFilterProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: { key: TabType; label: string }[] = [
  { key: 'items',     label: 'アイテム' },
  { key: 'champions', label: 'チャンピオン' },
];

export function TabsFilter({ activeTab, onTabChange }: TabsFilterProps) {
  return (
    <div className="flex gap-0 border-b border-border w-full max-w-2xl">
      {TABS.map(tab => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-pressed={active}
            className={`px-5 py-2.5 text-sm font-medium transition-colors duration-100 relative
              ${active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab.label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary shadow-[0_0_10px_rgba(255,143,198,.65)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
