import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, ChevronUp, ChevronLeft, ChevronRight, Clock, Droplet, Ruler } from 'lucide-react';
import { useChampion } from '../hooks/useChampion';
import { useChampions } from '../hooks/useChampions';
import { useItemsByStats } from '../hooks/useItemsByStats';
import { championSplashUrl } from '../api/dataDragon';
import { englishChampionName } from '../utils/championNames';
import { roleIconUrl, ROLE_LABELS_JA } from '../utils/roleAssets';
import { STAT_KEY_LABELS } from '../utils/stats';
import type { Role } from '../types/app';
import { BottomSheet } from '../components/BottomSheet';
import type { SkillData } from '../hooks/useChampion';

type SkillKey = 'P' | 'Q' | 'W' | 'E' | 'R';


// ── スキルナビゲーション（アイコン + キーバッジ）─────────

function SkillNav({
  skills,
  activeSkill,
  onSelect,
}: {
  skills: SkillData[];
  activeSkill: SkillKey;
  onSelect: (key: SkillKey) => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-y border-border py-3">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex justify-center gap-3">
          {skills.map(s => {
            const active = activeSkill === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onSelect(s.key)}
                aria-label={s.name}
                className={`relative w-12 h-12 rounded-md overflow-hidden border transition-all duration-100 ${
                  active
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border opacity-55 hover:opacity-100'
                }`}
              >
                <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 px-1 text-[10px] font-bold leading-4 rounded-tl-sm bg-background/85 text-foreground">
                  {s.key}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 1スキルブロック ───────────────────────────────────

function SkillBlock({
  skill,
  onStatClick,
}: {
  skill: SkillData;
  onStatClick: (key: string, label: string) => void;
}) {
  const hasMeta = skill.cooldownBurn || skill.costBurn || skill.rangeBurn;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const key = (e.target as HTMLElement).dataset.stat;
    if (key) onStatClick(key, STAT_KEY_LABELS[key] ?? (e.target as HTMLElement).textContent ?? '');
  };

  return (
    <div id={`skill-${skill.key}`} className="scroll-mt-32 bg-card border border-border rounded-md p-5">
      {/* アイコン（キーバッジ付き）+ スキル名 + CD/コスト/射程 */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <img
            src={skill.imageUrl}
            alt={skill.name}
            className="w-14 h-14 rounded-md border border-border"
            loading="lazy"
          />
          <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 flex items-center justify-center -rotate-6 rounded-sm bg-background border border-border text-[11px] font-bold text-primary">
            {skill.key}
          </span>
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-xl font-semibold text-foreground leading-tight">{skill.name}</h2>
          {hasMeta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {skill.cooldownBurn && (
                <span className="inline-flex items-center gap-1.5" title="クールダウン">
                  <Clock size={13} aria-hidden />
                  <span className="tabular-nums text-foreground/85">{skill.cooldownBurn}s</span>
                </span>
              )}
              {skill.costBurn && (
                <span className="inline-flex items-center gap-1.5" title={skill.costType ?? 'コスト'}>
                  <Droplet size={13} aria-hidden />
                  <span className="tabular-nums text-foreground/85">{skill.costBurn}</span>
                </span>
              )}
              {skill.rangeBurn && (
                <span className="inline-flex items-center gap-1.5" title="射程">
                  <Ruler size={13} aria-hidden />
                  <span className="tabular-nums text-foreground/85">{skill.rangeBurn}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 説明文 */}
      <div
        className="text-foreground leading-relaxed text-base skill-description"
        dangerouslySetInnerHTML={{ __html: skill.description }}
        onClick={handleClick}
      />
    </div>
  );
}

// ── ロア（背景ストーリー・折りたたみ）───────────────────

function LoreSection({ lore }: { lore: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = lore.length > 160;

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <h2 className="text-sm font-semibold text-foreground mb-2">ストーリー</h2>
      <p className={`text-sm text-foreground/80 leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
        {lore}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? '閉じる' : '続きを読む'}
        </button>
      )}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────

export function ChampionDetail() {
  const { id } = useParams<{ id: string }>();
  const { champion, loading, error } = useChampion(id);
  const { champions } = useChampions();
  const { statMap, mediumStatMap } = useItemsByStats();
  const [activeSkill, setActiveSkill] = useState<SkillKey>('P');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeStatKey, setActiveStatKey] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');

  const handleStatClick = useCallback((key: string, label: string) => {
    setActiveStatKey(key);
    setActiveLabel(label);
  }, []);

  // prev / next チャンピオン（名前順）
  const currentIdx = champions.findIndex(c => c.id === id);
  const prevChampion = currentIdx > 0 ? champions[currentIdx - 1] : null;
  const nextChampion = currentIdx >= 0 && currentIdx < champions.length - 1 ? champions[currentIdx + 1] : null;

  // スクロール検出
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      const keys: SkillKey[] = ['R', 'E', 'W', 'Q', 'P'];
      for (const key of keys) {
        const el = document.getElementById(`skill-${key}`);
        if (el && el.getBoundingClientRect().top <= 150) {
          setActiveSkill(key);
          break;
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToSkill(key: SkillKey) {
    setActiveSkill(key);
    const el = document.getElementById(`skill-${key}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">読み込み中…</p>
        </div>
      </div>
    );
  }

  if (error || !champion) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {error ? `エラー: ${error.message}` : 'チャンピオンが見つかりませんでした'}
        </p>
        <Link to="/" className="text-primary hover:underline">← ホームへ戻る</Link>
      </div>
    );
  }

  const { stats } = champion;

  const statTags = [
    { label: '体力',     value: stats.hp },
    { label: 'マナ',     value: champion.partype !== 'None' ? stats.mp : null },
    { label: '物理防御', value: stats.armor },
    { label: '魔法防御', value: stats.spellblock },
    { label: '移動速度', value: stats.movespeed },
    { label: '射程',     value: stats.attackrange },
  ].filter(s => s.value !== null);

  return (
    <div className="min-h-screen bg-background">
      {/* 前後チャンピオン矢印 */}
      {prevChampion && (
        <Link
          to={`/champion/${prevChampion.id}`}
          title={prevChampion.name}
          className="fixed left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {nextChampion && (
        <Link
          to={`/champion/${nextChampion.id}`}
          title={nextChampion.name}
          className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronRight size={16} />
        </Link>
      )}

      {/* ヒーロー（スプラッシュアート）*/}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={championSplashUrl(champion.id)}
            alt=""
            className="w-full h-full object-cover object-[center_20%]"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/25" />
        </div>

        {/* 戻るリンク（ヒーロー上にオーバーレイ） */}
        <div className="relative z-10">
          <div className="container mx-auto px-4 py-3 max-w-5xl">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/50 backdrop-blur-sm text-sm text-foreground/80 hover:text-foreground hover:bg-background/70 transition-colors"
            >
              <ArrowLeft size={15} />
              戻る
            </Link>
          </div>
        </div>

        <div className="relative container mx-auto px-4 max-w-5xl pt-24 sm:pt-36 pb-6">
          <p className="font-display text-sm text-primary/90 -rotate-2 inline-block">{englishChampionName(champion.id)}</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-0.5">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{champion.name}</h1>
            {champion.title && (
              <p className="text-base text-foreground/70">{champion.title}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {[champion.role, ...champion.tags.filter(t => t !== champion.role)].map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-sm bg-background/60 backdrop-blur-sm border border-border/60 text-foreground/80"
              >
                {ROLE_LABELS_JA[tag as Role] && (
                  <img
                    src={roleIconUrl(tag as Role)}
                    alt=""
                    className="w-3.5 h-3.5"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {ROLE_LABELS_JA[tag as Role] ?? tag}
              </span>
            ))}
            {champion.partype !== 'None' && (
              <span className="px-2.5 py-0.5 text-xs rounded-sm bg-background/60 backdrop-blur-sm border border-border/60 text-foreground/80">
                {champion.partype}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-7 gap-y-2 mt-6">
            {statTags.map(s => (
              <div key={s.label}>
                <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                <p className="text-base font-semibold text-foreground tabular-nums leading-tight mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* スキルナビゲーション（スティッキー） */}
      <SkillNav
        skills={champion.skills}
        activeSkill={activeSkill}
        onSelect={scrollToSkill}
      />

      {/* スキル詳細 */}
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {champion.skills.map(skill => (
          <SkillBlock key={skill.key} skill={skill} onStatClick={handleStatClick} />
        ))}
        {champion.lore && <LoreSection lore={champion.lore} />}
      </div>

      {/* トップへ戻るボタン */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="トップへ戻る"
          className="fixed bottom-8 right-8 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:bg-primary/90 transition-colors"
        >
          <ChevronUp size={24} />
        </button>
      )}

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
