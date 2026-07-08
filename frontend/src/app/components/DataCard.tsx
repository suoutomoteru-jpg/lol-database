import { Link } from 'react-router';
import { roleIcons, itemTypeIcons } from '../utils/role-icons';
import type { Champion, Item } from '../data/mock-data';

interface DataCardProps {
  data: Champion | Item;
  type: 'champion' | 'item';
}

function isChampion(data: Champion | Item): data is Champion {
  return 'role' in data;
}

export function DataCard({ data, type }: DataCardProps) {
  const subtitle = isChampion(data) ? data.role : data.type;
  const SubtitleIcon = isChampion(data) ? roleIcons[data.role] : itemTypeIcons[data.type];

  return (
    <Link
      to={type === 'champion' ? `/champion/${data.id}` : `/item/${data.id}`}
      className="group relative flex items-center gap-3 px-3 py-2 bg-card border border-border
        hover:bg-secondary transition-colors duration-100 overflow-hidden
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:z-10"
    >
      {/* Left gold accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary
        scale-y-0 group-hover:scale-y-100 transition-transform duration-150 origin-center" />

      {/* Icon */}
      <div className="w-10 h-10 flex-shrink-0 overflow-hidden rounded-sm bg-accent/30">
        <img
          src={data.icon}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{data.name}</p>
          {!isChampion(data) && data.mapMode === 'aram' && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1 py-0 rounded-sm
              bg-blue-500/20 text-blue-400 border border-blue-500/40 leading-4">
              ARAM
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground/60 leading-tight mt-0.5">
          <SubtitleIcon size={11} aria-hidden />
          {subtitle}
        </p>
      </div>

      {/* アイテムの主要ステータスタグ（AD / AP / HP …） */}
      {!isChampion(data) && data.statTags.length > 0 && (
        <div className="hidden sm:flex flex-shrink-0 gap-1">
          {data.statTags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] leading-none rounded-sm bg-secondary/80 text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
