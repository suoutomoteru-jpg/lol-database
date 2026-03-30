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

function roleLabel(r: Role | 'all') { return r === 'all' ? 'All Roles' : r; }
function typeLabel(t: ItemType | 'all') { return t === 'all' ? 'All Types' : t; }

export function FilterBar({
  activeTab,
  selectedRole,
  selectedItemType,
  onRoleChange,
  onItemTypeChange,
}: FilterBarProps) {
  if (activeTab === 'all') return null;

  if (activeTab === 'champions') {
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {ROLES.map(r => (
          <button
            key={r}
            onClick={() => onRoleChange(r)}
            className={`px-4 py-2 rounded-lg border text-sm transition-all ${
              selectedRole === r
                ? 'bg-accent border-accent text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/20'
            }`}
          >
            {roleLabel(r)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {ITEM_TYPES.map(t => (
        <button
          key={t}
          onClick={() => onItemTypeChange(t)}
          className={`px-4 py-2 rounded-lg border text-sm transition-all ${
            selectedItemType === t
              ? 'bg-accent border-accent text-foreground'
              : 'border-border text-muted-foreground hover:border-foreground/20'
          }`}
        >
          {typeLabel(t)}
        </button>
      ))}
    </div>
  );
}
