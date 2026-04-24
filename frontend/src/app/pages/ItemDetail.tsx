import { useState, useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useItem } from '../hooks/useItem';
import { useItems } from '../hooks/useItems';
import { useItemsByStats } from '../hooks/useItemsByStats';
import { BottomSheet } from '../components/BottomSheet';

// ── 金銭効率計算 ───────────────────────────────────────

const GOLD_PER_STAT: Record<string, number> = {
  FlatPhysicalDamageMod:      35,      // Long Sword: 350g / 10 AD
  FlatMagicDamageMod:         20,      // Amplifying Tome: 400g / 20 AP
  FlatArmorMod:               20,      // Cloth Armor: 300g / 15 Armor
  FlatSpellBlockMod:          20,      // Null-Magic Mantle: 400g / 25 MR
  FlatHPPoolMod:              2.67,    // Ruby Crystal: 400g / 150 HP
  FlatMPPoolMod:              1,       // Sapphire Crystal baseline: 1g/mana
  FlatMovementSpeedMod:       12,      // 12g per 1 flat MS
  FlatCritChanceMod:          4000,    // 40g per 1% → ×100 for fraction (0-1)
  PercentAttackSpeedMod:      2500,    // 25g per 1% → ×100 for fraction
  PercentLifeStealMod:        5355,    // Vampiric Scepter: 53.55g per 1% → ×100
  PercentMovementSpeedMod:    6510.5,  // 65.105g per 1% (epic item avg) → ×100
  FlatArmorPenetrationMod:    30,      // Lethality: 30g per 1
  PercentArmorPenetrationMod: 4167,    // 41.67g per 1% → ×100
  FlatHPRegenMod:             3,       // Rejuvenation Bead baseline: 3g/unit
  FlatMPRegenMod:             4,       // Faerie Charm baseline: 4g/unit
};

function calcGoldEfficiency(stats: Record<string, number>, totalCost: number): number | null {
  if (totalCost <= 0) return null;
  let totalValue = 0;
  for (const [key, val] of Object.entries(stats)) {
    const rate = GOLD_PER_STAT[key];
    if (rate && val) totalValue += val * rate;
  }
  return totalValue > 0 ? (totalValue / totalCost) * 100 : null;
}

// ── 日本語キーワード → stat/tag キー対応表 ─────────────
// 長いものを先に並べる（部分マッチ防止）

const KEYWORD_DEFS: Array<{ text: string; key: string }> = [
  { text: 'ライフスティール',   key: 'stat:PercentLifeStealMod' },
  { text: '通常攻撃時効果',     key: 'tag:OnHit' },
  { text: '行動妨害耐性',       key: 'tag:Tenacity' },
  { text: 'スキルヘイスト',     key: 'tag:AbilityHaste' },
  { text: '魔法防御貫通',       key: 'custom:MagicPen' },
  { text: '物理防御貫通',       key: 'custom:ArmorPen' },
  { text: 'クリティカル率',     key: 'stat:FlatCritChanceMod' },
  { text: 'シールド量',         key: 'custom:Shield' },
  { text: '体力回復速度',       key: 'stat:FlatHPRegenMod' },
  { text: '体力回復',           key: 'stat:FlatHPRegenMod' },
  { text: 'マナ回復速度',       key: 'stat:FlatMPRegenMod' },
  { text: 'マナ回復',           key: 'stat:FlatMPRegenMod' },
  { text: '魔法防御',           key: 'stat:FlatSpellBlockMod' },
  { text: '物理防御',           key: 'stat:FlatArmorMod' },
  { text: '移動速度',           key: 'stat:FlatMovementSpeedMod' },
  { text: '攻撃速度',           key: 'stat:PercentAttackSpeedMod' },
  { text: '攻撃力',             key: 'stat:FlatPhysicalDamageMod' },
  { text: '魔力',               key: 'stat:FlatMagicDamageMod' },
  { text: 'アーマー',           key: 'stat:FlatArmorMod' },
  { text: '体力',               key: 'stat:FlatHPPoolMod' },
  { text: 'マナ',               key: 'stat:FlatMPPoolMod' },
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
  const { items } = useItems();
  const { statMap, mediumStatMap } = useItemsByStats();
  const [activeStatKey, setActiveStatKey] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');

  const currentIdx = items.findIndex(it => it.id === id);
  const prevItem = currentIdx > 0 ? items[currentIdx - 1] : null;
  const nextItem = currentIdx >= 0 && currentIdx < items.length - 1 ? items[currentIdx + 1] : null;

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
  const goldEfficiency = calcGoldEfficiency(item.stats, item.gold.total);

  return (
    <div className="min-h-screen bg-background">
      {prevItem && (
        <Link
          to={`/item/${prevItem.id}`}
          title={prevItem.name}
          className="fixed left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-sm bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {nextItem && (
        <Link
          to={`/item/${nextItem.id}`}
          title={nextItem.name}
          className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-sm bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronRight size={16} />
        </Link>
      )}
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
            className="w-16 h-16 rounded-sm border border-border shadow flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">{item.name}</h1>
            {item.englishName && item.englishName !== item.name && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">{item.englishName}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span className="text-primary font-semibold">{item.gold.total}G</span>
              {goldEfficiency !== null && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    金銭効率{' '}
                    <span className="text-primary font-semibold">{goldEfficiency.toFixed(1)}%</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 説明 — キーワードをクリックするとポップアップ表示 */}
        {description && (
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div
              className="px-4 py-3 text-sm text-foreground leading-snug item-description"
              dangerouslySetInnerHTML={{ __html: description }}
              onClick={handleDescClick}
            />
          </div>
        )}

        {/* 材料・アップグレード */}
        {(item.from.length > 0 || item.into.length > 0) && (
          <div className="bg-card border border-border rounded-sm overflow-hidden divide-y divide-border">
            {item.from.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">材料</p>
                <div className="flex flex-wrap gap-3">
                  {item.from.map(comp => (
                    <Link key={comp.id} to={`/item/${comp.id}`} className="flex items-center gap-2 group">
                      <img
                        src={comp.imageUrl}
                        alt={comp.name}
                        className="w-9 h-9 rounded-sm border border-border group-hover:border-primary/50 transition-colors flex-shrink-0"
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
                        className="w-9 h-9 rounded-sm border border-border group-hover:border-primary/50 transition-colors flex-shrink-0"
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

      <BottomSheet
        isOpen={activeStatKey !== null}
        label={activeLabel}
        statKey={activeStatKey ?? ''}
        items={statMap.get(activeStatKey ?? '') ?? []}
        mediumItems={mediumStatMap.get(activeStatKey ?? '') ?? []}
        onClose={() => { setActiveStatKey(null); setActiveLabel(''); }}
      />
    </div>
  );
}
