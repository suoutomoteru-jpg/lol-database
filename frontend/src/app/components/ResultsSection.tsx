import { DataCard } from './DataCard';
import { type LucideIcon } from 'lucide-react';
import { roleIcons, itemTypeIcons } from '../utils/role-icons';
import type { Champion, Item, TabType, Role, ItemType } from '../data/mock-data';

interface ResultsSectionProps {
  champions: Champion[];
  items: Item[];
  activeTab: TabType;
  allTabRoleFilter: Role | 'all';
  allTabItemTypeFilter: ItemType | 'all';
  onAllTabRoleChange: (role: Role | 'all') => void;
  onAllTabItemTypeChange: (type: ItemType | 'all') => void;
}

interface IconFilterBarProps<T extends string> {
  options: T[];
  selected: T | 'all';
  icons: Record<T, LucideIcon>;
  onSelect: (v: T | 'all') => void;
}

function IconFilterBar<T extends string>({ options, selected, icons, onSelect }: IconFilterBarProps<T>) {
  return (
    <div className="flex gap-1">
      {options.map(opt => {
        const Icon = icons[opt] as LucideIcon;
        const active = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(active ? 'all' : opt)}
            aria-label={opt}
            aria-pressed={active}
            className={`w-7 h-7 flex items-center justify-center rounded-sm transition-colors duration-100 ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-accent/30 hover:text-foreground'
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, count, right }: { title: string; count?: number; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground/60">{count}</span>
        )}
      </div>
      {right}
    </div>
  );
}

export function ResultsSection({
  champions, items, activeTab,
  allTabRoleFilter, allTabItemTypeFilter,
  onAllTabRoleChange, onAllTabItemTypeChange,
}: ResultsSectionProps) {
  const noResults =
    (activeTab === 'all' && champions.length === 0 && items.length === 0) ||
    (activeTab === 'champions' && champions.length === 0) ||
    (activeTab === 'items' && items.length === 0);

  if (noResults) {
    return <p className="text-center py-12 text-sm text-muted-foreground">結果が見つかりませんでした</p>;
  }

  if (activeTab === 'all') {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader
            title="Champions"
            count={champions.length}
            right={
              <IconFilterBar
                options={['Fighter','Mage','Assassin','Marksman','Support'] as Role[]}
                selected={allTabRoleFilter}
                icons={roleIcons}
                onSelect={onAllTabRoleChange}
              />
            }
          />
          <div className="grid grid-cols-2 gap-px bg-border">
            {champions.map(c => <DataCard key={c.id} data={c} type="champion" />)}
          </div>
        </div>
        <div>
          <SectionHeader
            title="Items"
            count={items.length}
            right={
              <IconFilterBar
                options={['Fighter','Marksman','Assassin','Magic','Defense','Support'] as ItemType[]}
                selected={allTabItemTypeFilter}
                icons={itemTypeIcons}
                onSelect={onAllTabItemTypeChange}
              />
            }
          />
          <div className="grid grid-cols-2 gap-px bg-border">
            {items.map(i => <DataCard key={i.id} data={i} type="item" />)}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'champions') {
    return (
      <div className="w-full max-w-4xl">
        <SectionHeader title="Champions" count={champions.length} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
          {champions.map(c => <DataCard key={c.id} data={c} type="champion" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <SectionHeader title="Items" count={items.length} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
        {items.map(i => <DataCard key={i.id} data={i} type="item" />)}
      </div>
    </div>
  );
}
