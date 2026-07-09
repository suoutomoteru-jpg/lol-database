import { DataCard } from './DataCard';
import type { Champion, Item, TabType } from '../types/app';

interface ResultsSectionProps {
  champions: Champion[];
  items: Item[];
  activeTab: TabType;
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-foreground mb-2">{title}</h2>;
}

export function ResultsSection({ champions, items, activeTab }: ResultsSectionProps) {
  const noResults =
    (activeTab === 'champions' && champions.length === 0) ||
    (activeTab === 'items' && items.length === 0);

  if (noResults) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">結果が見つかりませんでした</p>
        <p className="mt-2 text-xs text-muted-foreground/70 -rotate-1 inline-block">
          …読み方を変えたり、フィルタを外すと出てくるかも？
        </p>
      </div>
    );
  }

  if (activeTab === 'champions') {
    return (
      <div className="w-full max-w-4xl">
        <SectionHeader title="チャンピオン" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
          {champions.map(c => <DataCard key={c.id} data={c} type="champion" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <SectionHeader title="アイテム" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
        {items.map(i => <DataCard key={i.id} data={i} type="item" />)}
      </div>
    </div>
  );
}
