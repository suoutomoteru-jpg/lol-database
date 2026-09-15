import { Link } from 'react-router';
import { roleIconUrl, itemTypeIconUrl, ROLE_LABELS_JA, ITEM_TYPE_LABELS_JA } from '../utils/roleAssets';
import { prefetchChampion, prefetchItem } from '../utils/prefetch';
import type { Champion, Item } from '../types/app';
import type { ItemChange } from '../api/patchDiff';

interface DataCardProps {
  data: Champion | Item;
  type: 'champion' | 'item';
  /** 今パッチで 新規/変更 されたアイテムに付けるバッジ */
  patchChange?: ItemChange;
}

function isChampion(data: Champion | Item): data is Champion {
  return 'role' in data;
}

export function DataCard({ data, type, patchChange }: DataCardProps) {
  const subtitle = isChampion(data) ? ROLE_LABELS_JA[data.role] : ITEM_TYPE_LABELS_JA[data.type];
  const subtitleIcon = isChampion(data) ? roleIconUrl(data.role) : itemTypeIconUrl(data.type);
  const prefetch = () => (isChampion(data) ? prefetchChampion(data.id) : prefetchItem());

  return (
    <Link
      to={type === 'champion' ? `/champion/${data.id}` : `/item/${data.id}`}
      onPointerEnter={prefetch}
      onTouchStart={prefetch}
      onFocus={prefetch}
      className="group relative flex items-center gap-3 px-3 py-2 bg-card border border-border
        hover:bg-secondary transition-colors duration-100 overflow-hidden
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:z-10
        [content-visibility:auto] [contain-intrinsic-size:auto_58px]"
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
        <div className="flex items-baseline gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{data.name}</p>
          {!isChampion(data) && data.mapMode === 'aram' && (
            <span className="flex-shrink-0 -rotate-3 text-[10px] font-bold px-1 py-0 rounded-sm
              bg-blue-500/20 text-blue-400 border border-blue-500/40 leading-4">
              ARAM
            </span>
          )}
          {patchChange && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1 py-0 rounded-sm
              text-hextech border border-hextech/40 leading-4">
              {patchChange === 'new' ? 'NEW' : '変更'}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground/60 leading-tight mt-0.5">
          {/* CSSマスクでアイコンを文字色と同色にする */}
          <span
            aria-hidden
            className="w-3 h-3 inline-block bg-current"
            style={{
              WebkitMaskImage: `url(${subtitleIcon})`,
              maskImage: `url(${subtitleIcon})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
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
