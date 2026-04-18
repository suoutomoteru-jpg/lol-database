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
    return `${Math.round(value * 100)}%`;
  }
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function processItemDescription(raw: string): string {
  let s = raw;
  s = s.replace(/<mainText>/gi, '').replace(/<\/mainText>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<stats>/gi, '').replace(/<\/stats>/gi, '<br>');
  s = s.replace(/<attention>/gi, '<strong style="color:#C89B3C">').replace(/<\/attention>/gi, '</strong>');
  s = s.replace(/<passive>/gi, '<strong>').replace(/<\/passive>/gi, '</strong>');
  s = s.replace(/<active>/gi, '<strong>').replace(/<\/active>/gi, '</strong>');
  s = s.replace(/<ornnBonus>/gi, '<em>').replace(/<\/ornnBonus>/gi, '</em>');
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
      t.startsWith('<strong ')
    ) return match;
    return '';
  });
  s = s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return s.replace(/^(<br>\s*)+/, '').trim();
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { item, loading, error } = useItem(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Loading from Data Dragon...</p>
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
        <div className="container mx-auto px-4 py-4 max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            <span>戻る</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-start gap-6">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-20 h-20 rounded-2xl border border-border shadow-lg flex-shrink-0"
          />
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{item.name}</h1>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-muted-foreground">
                合計: <strong className="text-foreground">{item.gold.total}G</strong>
              </span>
              <span className="text-muted-foreground">
                レシピ: <strong className="text-foreground">{item.gold.base}G</strong>
              </span>
              <span className="text-muted-foreground">
                売値: <strong className="text-foreground">{item.gold.sell}G</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 説明 */}
        {description && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div
              className="text-foreground leading-relaxed text-sm"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>
        )}

        {/* ステータス */}
        {stats.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">ステータス</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{STAT_LABELS[key] ?? key}</span>
                  <span className="text-foreground font-medium">{formatStatValue(key, value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 材料（コンポーネント） */}
        {item.from.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">材料</p>
            <div className="flex flex-wrap gap-4">
              {item.from.map(comp => (
                <Link
                  key={comp.id}
                  to={`/item/${comp.id}`}
                  className="flex flex-col items-center gap-2 group"
                >
                  <img
                    src={comp.imageUrl}
                    alt={comp.name}
                    className="w-12 h-12 rounded-lg border border-border group-hover:border-primary/40 transition-colors"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center w-16 leading-tight">
                    {comp.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* アップグレード先 */}
        {item.into.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">アップグレード先</p>
            <div className="flex flex-wrap gap-4">
              {item.into.map(up => (
                <Link
                  key={up.id}
                  to={`/item/${up.id}`}
                  className="flex flex-col items-center gap-2 group"
                >
                  <img
                    src={up.imageUrl}
                    alt={up.name}
                    className="w-12 h-12 rounded-lg border border-border group-hover:border-primary/40 transition-colors"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center w-16 leading-tight">
                    {up.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
