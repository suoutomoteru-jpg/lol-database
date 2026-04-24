import { useNavigate } from 'react-router';
import type { Champion, Item } from '../data/mock-data';

interface DataCardProps {
  data: Champion | Item;
  type: 'champion' | 'item';
}

function isChampion(data: Champion | Item): data is Champion {
  return 'role' in data;
}

export function DataCard({ data, type }: DataCardProps) {
  const navigate = useNavigate();
  const subtitle = isChampion(data) ? data.role : data.type;

  return (
    <div
      onClick={() => navigate(type === 'champion' ? `/champion/${data.id}` : `/item/${data.id}`)}
      className="group relative flex items-center gap-3 px-3 py-2 bg-card border border-border cursor-pointer
        hover:bg-secondary hover:border-border transition-colors duration-100 overflow-hidden"
    >
      {/* Left gold accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary
        scale-y-0 group-hover:scale-y-100 transition-transform duration-150 origin-center" />

      {/* Icon */}
      <div className="w-10 h-10 flex-shrink-0 overflow-hidden rounded-sm bg-accent/30">
        <img
          src={data.icon}
          alt={data.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Name + subtitle / stat tags */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">{data.name}</p>
        <p className="text-xs text-muted-foreground/50 leading-tight mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
