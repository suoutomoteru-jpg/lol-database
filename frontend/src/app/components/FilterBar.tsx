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

const ROLE_ACTIVE: Record<string, string> = {
  Mage:      'border-sky-500/60 text-sky-400 bg-sky-500/10',
  Tank:      'border-slate-400/60 text-slate-300 bg-slate-500/10',
  Assassin:  'border-purple-500/60 text-purple-400 bg-purple-500/10',
  Fighter:   'border-orange-500/60 text-orange-400 bg-orange-500/10',
  Support:   'border-emerald-500/60 text-emerald-400 bg-emerald-500/10',
  Marksman:  'border-yellow-500/60 text-yellow-400 bg-yellow-500/10',
  Magic:     'border-sky-500/60 text-sky-400 bg-sky-500/10',
  Defense:   'border-slate-400/60 text-slate-300 bg-slate-500/10',
};

export function FilterBar({
  activeTab, selectedRole, selectedItemType, onRoleChange, onItemTypeChange,
}: FilterBarProps) {
  if (activeTab === 'all') return null;

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
          ? (v === 'all' ? 'border-primary/60 text-primary bg-primary/10' : (ROLE_ACTIVE[v] ?? 'border-primary/60 text-primary bg-primary/10'))
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
