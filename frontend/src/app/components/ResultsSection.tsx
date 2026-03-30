import { DataCard } from './DataCard';
import { type LucideIcon } from 'lucide-react';
import { roleIcons, itemTypeIcons } from '../utils/role-icons';
import type { Champion, Item, TabType, Role, ItemType } from '../data/mock-data';

// All タブのチャンピオン列に表示するロールフィルター
const ALL_TAB_ROLES: Role[] = ['Fighter', 'Mage', 'Assassin', 'Marksman', 'Support'];
// All タブのアイテム列に表示するタイプフィルター
const ALL_TAB_ITEM_TYPES: ItemType[] = ['Fighter', 'Marksman', 'Assassin', 'Magic', 'Defense', 'Support'];

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

function IconFilterBar<T extends string>({
  options, selected, icons, onSelect,
}: IconFilterBarProps<T>) {
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
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-foreground font-semibold">{title}</h2>
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
    return (
      <p className="text-center py-16 text-muted-foreground">No results found</p>
    );
  }

  // ── All タブ：左右2カラム ──────────────────────────────
  if (activeTab === 'all') {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Champions 列 */}
        <div>
          <SectionHeader
            title="Champions"
            right={
              <IconFilterBar
                options={ALL_TAB_ROLES}
                selected={allTabRoleFilter}
                icons={roleIcons}
                onSelect={onAllTabRoleChange}
              />
            }
          />
          <div className="grid gap-3">
            {champions.map(c => <DataCard key={c.id} data={c} type="champion" />)}
          </div>
        </div>

        {/* Items 列 */}
        <div>
          <SectionHeader
            title="Items"
            right={
              <IconFilterBar
                options={ALL_TAB_ITEM_TYPES}
                selected={allTabItemTypeFilter}
                icons={itemTypeIcons}
                onSelect={onAllTabItemTypeChange}
              />
            }
          />
          <div className="grid gap-3">
            {items.map(i => <DataCard key={i.id} data={i} type="item" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Champions タブ：1カラム ────────────────────────────
  if (activeTab === 'champions') {
    return (
      <div className="w-full max-w-4xl">
        <SectionHeader title="Champions" />
        <div className="grid gap-3">
          {champions.map(c => <DataCard key={c.id} data={c} type="champion" />)}
        </div>
      </div>
    );
  }

  // ── Items タブ：1カラム ───────────────────────────────
  return (
    <div className="w-full max-w-4xl">
      <SectionHeader title="Items" />
      <div className="grid gap-3">
        {items.map(i => <DataCard key={i.id} data={i} type="item" />)}
      </div>
    </div>
  );
}
