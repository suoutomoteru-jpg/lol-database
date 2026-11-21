import { FilterBar } from './FilterBar';
import type { ItemType } from '../types/app';

/**
 * アイテム用の詳細フィルターパネル。
 * カテゴリ1「ロール」= 従来のアイテム種別フィルター（FilterBar を再利用）
 * カテゴリ2「ステータス」= アイテムが持つステータスでの絞り込み（複数選択・AND条件）
 *
 * abbr は useItems.computeStatTags が生成する statTags の略称と一致させること。
 */
export const STAT_FILTERS: { abbr: string; label: string }[] = [
  { abbr: 'AD',       label: '攻撃力' },
  { abbr: 'AP',       label: '魔力' },
  { abbr: 'AS',       label: '攻撃速度' },
  { abbr: 'Crit',     label: 'クリティカル率' },
  { abbr: 'SH',       label: 'スキルヘイスト' },
  { abbr: 'Lethal',   label: '脅威' },
  { abbr: 'APen',     label: '物理防御貫通' },
  { abbr: 'MPen',     label: '魔法防御貫通' },
  { abbr: 'LS',       label: 'ライフスティール' },
  { abbr: 'HP',       label: '体力' },
  { abbr: 'AR',       label: '物理防御' },
  { abbr: 'MR',       label: '魔法防御' },
  { abbr: 'HReg',     label: '体力自動回復' },
  { abbr: 'Mana',     label: 'マナ' },
  { abbr: 'MReg',     label: 'マナ自動回復' },
  { abbr: 'MS',       label: '移動速度' },
  { abbr: 'Tenacity', label: '行動妨害耐性' },
  { abbr: 'HSP',      label: '回復・シールドパワー' },
];

interface AdvancedFilterProps {
  selectedItemType: ItemType | 'all';
  onItemTypeChange: (type: ItemType | 'all') => void;
  selectedStats: string[];
  onStatsChange: (stats: string[]) => void;
}

export function AdvancedFilter({
  selectedItemType, onItemTypeChange, selectedStats, onStatsChange,
}: AdvancedFilterProps) {
  const toggleStat = (abbr: string) => {
    onStatsChange(
      selectedStats.includes(abbr)
        ? selectedStats.filter(s => s !== abbr)
        : [...selectedStats, abbr],
    );
  };

  const hasActive = selectedItemType !== 'all' || selectedStats.length > 0;

  return (
    <div className="w-full max-w-2xl bg-card border border-border rounded-md p-4 space-y-4">
      <section>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">ロール</h3>
        <FilterBar
          activeTab="items"
          selectedRole="all"
          selectedItemType={selectedItemType}
          onRoleChange={() => {}}
          onItemTypeChange={onItemTypeChange}
        />
      </section>

      <section>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          ステータス
          <span className="ml-2 text-[9px] normal-case tracking-normal font-normal text-muted-foreground/60">
            複数選択ですべてを満たすアイテムに絞り込み
          </span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {STAT_FILTERS.map(({ abbr, label }) => {
            const isActive = selectedStats.includes(abbr);
            return (
              <button
                key={abbr}
                onClick={() => toggleStat(abbr)}
                aria-pressed={isActive}
                className={`inline-flex items-center px-3 pt-[3px] pb-[5px] text-xs font-medium border rounded-full transition-colors duration-100 ${
                  isActive
                    ? 'border-primary/60 text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {hasActive && (
        <div className="text-right">
          <button
            onClick={() => { onItemTypeChange('all'); onStatsChange([]); }}
            className="text-xs text-muted-foreground hover:text-foreground underline decoration-border"
          >
            フィルターをリセット
          </button>
        </div>
      )}
    </div>
  );
}
