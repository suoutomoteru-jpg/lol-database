import { useState, useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, X } from 'lucide-react';
import { useItem } from '../hooks/useItem';
import { useItemsByStats, type ItemSummary } from '../hooks/useItemsByStats';

// ── 日本語キーワード → stat/tag キー対応表 ─────────────
// 長いものを先に並べる（部分マッチ防止）

const KEYWORD_DEFS: Array<{ text: string; key: string }> = [
  { text: 'ライフスティール', key: 'stat:PercentLifeStealMod' },
  { text: 'スキルヘイスト',  key: 'tag:AbilityHaste' },
  { text: 'クリティカル率',  key: 'stat:FlatCritChanceMod' },
  { text: '体力回復',        key: 'stat:FlatHPRegenMod' },
  { text: 'マナ回復',        key: 'stat:FlatMPRegenMod' },
  { text: '魔法防御',        key: 'stat:FlatSpellBlockMod' },
  { text: '移動速度',        key: 'stat:FlatMovementSpeedMod' },
  { text: '攻撃速度',        key: 'stat:PercentAttackSpeedMod' },
  { text: '攻撃力',          key: 'stat:FlatPhysicalDamageMod' },
  { text: '魔力',            key: 'stat:FlatMagicDamageMod' },
  { text: 'アーマー',        key: 'stat:FlatArmorMod' },
  { text: '体力',            key: 'stat:FlatHPPoolMod' },
  { text: 'マナ',            key: 'stat:FlatMPPoolMod' },
];

const KW_PATTERN = new RegExp(
  KEYWORD_DEFS.map(d => d.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);
const KW_MAP = new Map(KEYWORD_DEFS.map(d => [d.text, d.key]));

// ── HTML テキストノードにクリッカブルスパンを注入 ────────

function injectStatLinks(html: string): string {
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) return part;
    return part.replace(KW_PATTERN, kw => {
      const key = KW_MAP.get(kw);
      return key ? `<span data-stat="${key}" class="stat-keyword">${kw}</span>` : kw;
    });
  }).join('');
}

// ── ステータスポップアップ ─────────────────────────────

function StatPopup({
  label,
  items,
  onClose,
}: {
  label: string;
  items: ItemSummary[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl w-full max-w-xs shadow-2xl flex flex-col"
        style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          >
            <X size={15} />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">該当アイテムなし</p>
        ) : (
          <div className="overflow-y-auto divide-y divide-border">
            {items.map(it => (
              <Link
                key={it.id}
                to={`/item/${it.id}`}
                onClick={onClose}
                className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/30 transition-colors"
              >
                <img
                  src={it.imageUrl}
                  alt={it.name}
                  className="w-8 h-8 rounded-lg border border-border flex-shrink-0"
                  loading="lazy"
                />
                <span className="text-sm text-foreground leading-tight">{it.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 説明文の前処理 ─────────────────────────────────────

function processItemDescription(raw: string): string {
  let s = raw;
  s = s.replace(/<mainText>/gi, '').replace(/<\/mainText>/gi, '');
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
  s = s.replace(/^(<br>\s*)+/, '').trim();
  s = s.replace(/(<br>\s*){3,}/g, '<br><br>');
  return s;
}

// ── メインページ ───────────────────────────────────────

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { item, loading, error } = useItem(id);
  const statMap = useItemsByStats();
  const [activeStatKey, setActiveStatKey] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');

  const handleDescClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.stat;
    if (key) {
      setActiveStatKey(key);
      setActiveLabel(target.textContent ?? '');
    }
  }, []);

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

  const description = injectStatLinks(processItemDescription(item.description));

  return (
    <div className="min-h-screen bg-background">
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

        {/* ヘッダー */}
        <div className="flex items-center gap-4">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-16 h-16 rounded-xl border border-border shadow flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground leading-tight">{item.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>
                <span style={{ color: '#C89B3C' }} className="font-semibold">{item.gold.total}G</span>
                {' '}合計
              </span>
              <span className="text-border">·</span>
              <span>{item.gold.base}G レシピ</span>
              <span className="text-border">·</span>
              <span>{item.gold.sell}G 売値</span>
            </div>
          </div>
        </div>

        {/* 説明 — キーワードをクリックするとポップアップ表示 */}
        {description && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div
              className="px-4 py-3 text-sm text-foreground leading-snug item-description"
              dangerouslySetInnerHTML={{ __html: description }}
              onClick={handleDescClick}
            />
          </div>
        )}

        {/* 材料・アップグレード */}
        {(item.from.length > 0 || item.into.length > 0) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {item.from.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">材料</p>
                <div className="flex flex-wrap gap-3">
                  {item.from.map(comp => (
                    <Link key={comp.id} to={`/item/${comp.id}`} className="flex items-center gap-2 group">
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
                    <Link key={up.id} to={`/item/${up.id}`} className="flex items-center gap-2 group">
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

      {activeStatKey && (
        <StatPopup
          label={activeLabel}
          items={statMap.get(activeStatKey) ?? []}
          onClose={() => { setActiveStatKey(null); setActiveLabel(''); }}
        />
      )}
    </div>
  );
}
