import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useItem } from '../hooks/useItem';

const STAT_LABELS: Record<string, string> = {
  FlatPhysicalDamageMod:      'Attack Damage',
  FlatMagicDamageMod:         'Ability Power',
  FlatArmorMod:               'Armor',
  FlatSpellBlockMod:          'Magic Resistance',
  FlatHPPoolMod:              'Health',
  FlatMPPoolMod:              'Mana',
  FlatMovementSpeedMod:       'Movement Speed',
  FlatCritChanceMod:          'Critical Strike Chance',
  PercentAttackSpeedMod:      'Attack Speed',
  PercentLifeStealMod:        'Life Steal',
  FlatHPRegenMod:             'HP Regen',
  FlatMPRegenMod:             'Mana Regen',
  PercentMovementSpeedMod:    '% Movement Speed',
  FlatGoldPer10Mod:           'Gold Per 10s',
  FlatArmorPenetrationMod:    'Armor Penetration',
  PercentArmorPenetrationMod: '% Armor Penetration',
};

function formatStatValue(key: string, value: number): string {
  if (key.startsWith('Percent') || key.includes('CritChance') || key.includes('LifeSteal')) {
    return `+${Math.round(value * 100)}%`;
  }
  const v = value % 1 === 0 ? String(value) : value.toFixed(1);
  return `+${v}`;
}

function processItemDescription(raw: string): string {
  let s = raw;
  s = s.replace(/<mainText>/gi, '').replace(/<\/mainText>/gi, '');
  // <stats> ブロックをシンプルなdivに変換
  s = s.replace(/<stats>/gi, '<div class="item-stats">').replace(/<\/stats>/gi, '</div>');
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<attention>/gi, '<strong style="color:#C89B3C">').replace(/<\/attention>/gi, '</strong>');
  s = s.replace(/<passive>/gi, '<strong class="text-muted-foreground">').replace(/<\/passive>/gi, '</strong>');
  s = s.replace(/<active>/gi, '<strong class="text-muted-foreground">').replace(/<\/active>/gi, '</strong>');
  s = s.replace(/<ornnBonus>/gi, '<span class="text-primary/70">').replace(/<\/ornnBonus>/gi, '</span>');
  s = s.replace(/<gold>/gi, '<span style="color:#C89B3C">').replace(/<\/gold>/gi, '</span>');
  s = s.replace(/<keyword>/gi, '<strong>').replace(/<\/keyword>/gi, '</strong>');
  s = s.replace(/<keywordMajor>/gi, '<strong>').replace(/<\/keywordMajor>/gi, '</strong>');
  s = s.replace(/<li>/gi, '<br>• ').replace(/<\/li>/gi, '');
  s = s.replace(/<[^>]+>/g, (match) => {
    const t = match.toLowerCase().trim();
    if (
      t === '<br>' ||
      t === '<strong>' || t === '</strong>' ||
      t === '<em>' || t === '</em>' ||
      t === '</span>' || t.startsWith('<span ') ||
      t.startsWith('<strong ') ||
      t === '</div>' || t === '<div class="item-stats">'
    ) return match;
    return '';
  });
  s = s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // 先頭の連続した <br> を除去
  s = s.replace(/^(<br>\s*)+/, '').trim();
  // 3連続以上の <br> を 2つに圧縮
  s = s.replace(/(<br>\s*){3,}/g, '<br><br>');
  return s;
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { item, loading, error } = useItem(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {error ? `エラー: ${error.message}` : 'アイテムが見つかりませんでした'}
        </p>
        <Link to="/" className="text-primary hover:underline">← ホームへ戻る</Link>
      </div>
    );
  }

  const stats = Object.entries(item.stats).filter(([, v]) => v !== 0);
  const description = processItemDescription(item.description);

  return (
    <div className="min-h-screen bg-background">
      {/* 戻るボタン */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-3 max-w-5xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            戻る
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">

        {/* ── ヘッダー ── */}
        <div className="flex items-center gap-4">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-16 h-16 rounded-xl border border-border shadow flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground leading-tight">{item.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span><span style={{color:'#C89B3C'}} className="font-semibold">{item.gold.total}G</span> 合計</span>
              <span className="text-border">·</span>
              <span>{item.gold.base}G レシピ</span>
              <span className="text-border">·</span>
              <span>{item.gold.sell}G 売値</span>
            </div>
          </div>
        </div>

        {/* ── ステータス + 説明 ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Stats strip */}
          {stats.length > 0 && (
            <div className="px-4 py-3 border-b border-border grid grid-cols-2 gap-x-8 gap-y-1">
              {stats.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground text-xs">{STAT_LABELS[key] ?? key}</span>
                  <span className="text-foreground font-semibold font-mono text-xs" style={{color:'#C89B3C'}}>
                    {formatStatValue(key, value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {description && (
            <div
              className="px-4 py-3 text-sm text-foreground leading-snug item-description"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>

        {/* ── 材料・アップグレード ── */}
        {(item.from.length > 0 || item.into.length > 0) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {item.from.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">材料</p>
                <div className="flex flex-wrap gap-3">
                  {item.from.map(comp => (
                    <Link
                      key={comp.id}
                      to={`/item/${comp.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <img
                        src={comp.imageUrl}
                        alt={comp.name}
                        className="w-9 h-9 rounded-lg border border-border group-hover:border-primary/50 transition-colors flex-shrink-0"
                      />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                        {comp.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {item.into.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">アップグレード先</p>
                <div className="flex flex-wrap gap-3">
                  {item.into.map(up => (
                    <Link
                      key={up.id}
                      to={`/item/${up.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <img
                        src={up.imageUrl}
                        alt={up.name}
                        className="w-9 h-9 rounded-lg border border-border group-hover:border-primary/50 transition-colors flex-shrink-0"
                      />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                        {up.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
