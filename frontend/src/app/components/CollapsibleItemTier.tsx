import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DataCard } from './DataCard';
import type { Item } from '../types/app';

interface CollapsibleItemTierProps {
  title: string;
  items: Item[];
}

/** 基本/中間コンポーネントの一覧。既定で折りたたみ、押すと展開する */
export function CollapsibleItemTier({ title, items }: CollapsibleItemTierProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-4xl">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2 hover:text-primary transition-colors"
      >
        <ChevronDown size={15} className={`transition-transform duration-150 ${open ? '' : '-rotate-90'}`} aria-hidden />
        {title}
        <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
          {items.map(i => <DataCard key={i.id} data={i} type="item" />)}
        </div>
      )}
    </div>
  );
}
