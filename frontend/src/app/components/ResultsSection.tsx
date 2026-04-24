import { DataCard } from './DataCard';
import type { Champion, Item, TabType } from '../data/mock-data';

interface ResultsSectionProps {
  champions: Champion[];
  items: Item[];
  activeTab: TabType;
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground/60">{count}</span>
      )}
    </div>
  );
}

export function ResultsSection({ champions, items, activeTab }: ResultsSectionProps) {
  const noResults =
    (activeTab === 'champions' && champions.length === 0) ||
    (activeTab === 'items' && items.length === 0);

  if (noResults) {
    return <p className="text-center py-12 text-sm text-muted-foreground">結果が見つかりませんでした</p>;
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
