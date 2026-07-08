import { Squiggle } from './doodles';
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
              <Squiggle className="absolute -bottom-[3px] left-3 right-3 h-[7px] w-auto text-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
