import type { TabType, Role, ItemType } from '../data/mock-data';

interface FilterBarProps {
  activeTab: TabType;
  selectedRole: Role | 'all';
  selectedItemType: ItemType | 'all';
  onRoleChange: (role: Role | 'all') => void;
  onItemTypeChange: (type: ItemType | 'all') => void;
}

const ROLES: (Role | 'all')[] = ['all', 'Mage', 'Tank', 'Assassin', 'Fighter', 'Support', 'Marksman'];
const ITEM_TYPES: (ItemType | 'all')[] = ['all', 'Fighter', 'Marksman', 'Assassin', 'Magic', 'Defense', 'Support'];

function roleLabel(r: Role | 'all') { return r === 'all' ? 'すべて' : r; }
function typeLabel(t: ItemType | 'all') { return t === 'all' ? 'すべて' : t; }

export function FilterBar({
  activeTab, selectedRole, selectedItemType, onRoleChange, onItemTypeChange,
}: FilterBarProps) {
  const items = activeTab === 'champions' ? ROLES : ITEM_TYPES;
  const selected = activeTab === 'champions' ? selectedRole : selectedItemType;
  const onChange = activeTab === 'champions'
    ? (v: string) => onRoleChange(v as Role | 'all')
    : (v: string) => onItemTypeChange(v as ItemType | 'all');
  const label = activeTab === 'champions' ? roleLabel : typeLabel;

  return (
    <div className="flex flex-wrap gap-1.5 w-full max-w-2xl">
      {items.map(v => {
        const isActive = selected === v;
        const colorClass = isActive
          ? 'border-primary/60 text-primary bg-primary/10'
          : 'border-border text-muted-foreground hover:border-border hover:text-foreground';
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-3 py-1 text-xs font-medium border rounded-sm transition-colors duration-100 ${colorClass}`}
          >
            {label(v as Role & ItemType & 'all')}
          </button>
        );
      })}
    </div>
  );
}
