import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Heart } from 'lucide-react';
import type { Champion, Item } from '../data/mock-data';

interface DataCardProps {
  data: Champion | Item;
  type: 'champion' | 'item';
}

function isChampion(data: Champion | Item): data is Champion {
  return 'role' in data;
}

export function DataCard({ data, type }: DataCardProps) {
  const [favorited, setFavorited] = useState(false);
  const navigate = useNavigate();

  const subtitle = isChampion(data) ? data.role : data.type;
  const clickable = true;

  function handleClick() {
    if (type === 'champion') navigate(`/champion/${data.id}`);
    else navigate(`/item/${data.id}`);
  }

  function handleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    setFavorited(f => !f);
  }

  return (
    <div
      onClick={handleClick}
      className={`group flex items-center gap-4 p-4 bg-card border border-border rounded-lg transition-all ${
        clickable
          ? 'cursor-pointer hover:border-primary/40 hover:shadow-md'
          : ''
      }`}
    >
      {/* アイコン（Data Dragon 画像） */}
      <div className="w-12 h-12 flex-shrink-0 bg-secondary/50 rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src={data.icon}
          alt={data.name}
          className={`w-full h-full object-cover transition-transform ${clickable ? 'group-hover:scale-105' : ''}`}
          loading="lazy"
          onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* 名前・サブタイトル */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium truncate">{data.name}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* お気に入りボタン */}
      <button
        onClick={handleFavorite}
        aria-label={favorited ? 'お気に入り解除' : 'お気に入り追加'}
        className={`p-1 rounded transition-colors ${
          favorited
            ? 'text-destructive bg-destructive/10'
            : 'text-muted-foreground hover:text-destructive/60'
        }`}
      >
        <Heart size={20} fill={favorited ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
