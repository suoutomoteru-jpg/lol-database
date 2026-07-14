import { roleIconUrl, itemTypeIconUrl, ROLE_LABELS_JA, ITEM_TYPE_LABELS_JA } from '../utils/roleAssets';
import type { TabType, Role, ItemType } from '../types/app';

interface FilterBarProps {
  activeTab: TabType;
  selectedRole: Role | 'all';
  selectedItemType: ItemType | 'all';
  onRoleChange: (role: Role | 'all') => void;
  onItemTypeChange: (type: ItemType | 'all') => void;
}

const ROLES: (Role | 'all')[] = ['all', 'Mage', 'Tank', 'Assassin', 'Fighter', 'Support', 'Marksman'];
const ITEM_TYPES: (ItemType | 'all')[] = ['all', 'Fighter', 'Marksman', 'Assassin', 'Magic', 'Defense', 'Support'];

export function FilterBar({
  activeTab, selectedRole, selectedItemType, onRoleChange, onItemTypeChange,
}: FilterBarProps) {
  const isChampions = activeTab === 'champions';
  const values = isChampions ? ROLES : ITEM_TYPES;
  const selected = isChampions ? selectedRole : selectedItemType;
  const onChange = isChampions
    ? (v: string) => onRoleChange(v as Role | 'all')
    : (v: string) => onItemTypeChange(v as ItemType | 'all');

  const label = (v: string): string => {
    if (v === 'all') return 'すべて';
    return isChampions ? ROLE_LABELS_JA[v as Role] : ITEM_TYPE_LABELS_JA[v as ItemType];
  };
  const iconUrl = (v: string): string | null => {
    if (v === 'all') return null;
    return isChampions ? roleIconUrl(v as Role) : itemTypeIconUrl(v as ItemType);
  };

  return (
    <div className="flex flex-wrap justify-start gap-1.5 w-full max-w-2xl">
      {values.map(v => {
        const isActive = selected === v;
        const icon = iconUrl(v);
        const colorClass = isActive
          ? 'border-primary/60 text-primary bg-primary/10'
          : 'border-border text-muted-foreground hover:border-border hover:text-foreground';
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium border rounded-full transition-colors duration-100 ${colorClass}`}
          >
            {icon && (
              // CSSマスクでアイコンを文字色と同色の単色にする（元PNGの彩色を使わない）
              <span
                aria-hidden
                className="w-3.5 h-3.5 inline-block bg-current"
                style={{
                  WebkitMaskImage: `url(${icon})`,
                  maskImage: `url(${icon})`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
              />
            )}
            {label(v)}
          </button>
        );
      })}
    </div>
  );
}
