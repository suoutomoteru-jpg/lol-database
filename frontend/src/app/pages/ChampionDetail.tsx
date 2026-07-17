import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, ChevronUp, ChevronLeft, ChevronRight, Clock, Droplet, Ruler } from 'lucide-react';
import { useChampion } from '../hooks/useChampion';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useChampions } from '../hooks/useChampions';
import { useChampionStatEntries } from '../hooks/useChampionStatEntries';
import { useItemsByStats } from '../hooks/useItemsByStats';
import {
  GAUGE_STATS, applyStatOverrides, computeGauge, formatGaugeValue, growthLabel,
  type ChampStatEntry, type GaugeLevel, type GaugeScope, type GaugeStatKey,
} from '../utils/statGauges';
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
  // backdrop-blurはstickyでスクロール毎に再合成が走りモバイルで重いため不使用
  return (
    <div className="sticky top-0 z-10 bg-background border-y border-border py-3">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex justify-center gap-3">
          {skills.map(s => {
            const active = activeSkill === s.key;
            return (
              // スキル列はゲームと同じ「キーの並び」なので、キーキャップの文法で表す
              // （選択中＝押し込まれた状態。装飾ではなく実際の操作と同型の構造）
              <button
                key={s.key}
                onClick={() => onSelect(s.key)}
                aria-label={s.name}
                aria-pressed={active}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border transition-[transform,box-shadow,opacity,border-color] duration-100 ${
                  active
                    ? 'border-primary ring-1 ring-primary translate-y-[2px] shadow-[inset_0_2px_5px_rgba(0,0,0,.55)]'
                    : 'border-border shadow-[0_2.5px_0_rgba(0,0,0,.5)] opacity-60 hover:opacity-100 hover:-translate-y-px'
                }`}
              >
                <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                <span className={`absolute bottom-0 right-0 px-1 text-[10px] font-bold leading-4 rounded-tl-sm bg-background/85 ${active ? 'text-primary' : 'text-foreground'}`}>
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

  const activate = (target: HTMLElement) => {
    const key = target.dataset.stat;
    if (key) onStatClick(key, STAT_KEY_LABELS[key] ?? target.textContent ?? '');
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    activate(e.target as HTMLElement);
  };

  // 刻印（role="button" の span）を Enter/Space でも開けるようにする
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement;
    if (!target.dataset.stat) return;
    e.preventDefault();
    activate(target);
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
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2">
              {/* CDは最重要情報なのでボックス+太字白で強調する */}
              {skill.cooldownBurn && (
                <span
                  className="inline-flex items-baseline gap-1.5 bg-secondary/80 border border-border rounded-md px-2.5 py-1"
                  title="クールダウン"
                >
                  <Clock size={13} className="self-center text-foreground/60" aria-hidden />
                  <span className="text-[11px] text-foreground/70">CD</span>
                  <span className="num-data text-base leading-none">
                    {skill.cooldownBurn}
                  </span>
                  <span className="text-[11px] text-foreground/70">秒</span>
                </span>
              )}
              {skill.costBurn && (
                <span
                  className="inline-flex items-baseline gap-1.5 px-1.5 py-1"
                  title={skill.costType ?? 'コスト'}
                >
                  <Droplet size={13} className="self-center text-foreground/50" aria-hidden />
                  <span className="tabular-nums text-sm font-semibold text-foreground/90">{skill.costBurn}</span>
                </span>
              )}
              {skill.rangeBurn && (
                <span className="inline-flex items-baseline gap-1.5 px-1.5 py-1" title="射程">
                  <Ruler size={13} className="self-center text-foreground/50" aria-hidden />
                  <span className="tabular-nums text-sm font-semibold text-foreground/90">{skill.rangeBurn}</span>
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
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

// ── 基礎ステータスの相対評価ゲージ ─────────────────────
//
// 数値の下に母集団内パーセンタイルのバーと「◯◯内 上位◯%」を表示する。
// 母集団はステータスごとに最適なもの（クラス／メレー・レンジド／全体）。
// タップで母集団⇄全体を切替、Lv1⇄Lv18で成長込みの順位を再計算。

function StatGauges({ self, entries }: { self: ChampStatEntry; entries: ChampStatEntry[] }) {
  const [level, setLevel] = useState<GaugeLevel>(1);
  const [scopes, setScopes] = useState<Partial<Record<GaugeStatKey, GaugeScope>>>({});

  const toggleScope = (key: GaugeStatKey) =>
    setScopes(prev => ({ ...prev, [key]: prev[key] === 'all' ? 'peer' : 'all' }));

  return (
    <div className="mt-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
        <span className="text-[11px] text-foreground/60">基礎ステータス</span>
        {/* レベルスライダー: 1〜18の任意レベルで実値と順位を再計算 */}
        <label className="inline-flex items-center gap-2">
          <span className="num-data text-xs w-9">Lv{level}</span>
          <input
            type="range"
            min={1}
            max={18}
            step={1}
            value={level}
            onChange={e => setLevel(Number(e.target.value))}
            className="w-36 sm:w-44 h-1 accent-primary cursor-pointer"
            aria-label="レベル"
          />
        </label>
        <span className="text-[11px] text-foreground/60">バーは比較グループ内での位置（タップで全体比較）</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
        {GAUGE_STATS.map(def => {
          const scope = scopes[def.key] ?? 'peer';
          const hasData = entries.length > 1;
          const g = hasData ? computeGauge(entries, self, def.key, level, scope) : null;
          return (
            <button
              key={def.key}
              onClick={() => hasData && toggleScope(def.key)}
              className="text-left"
              title="タップで比較グループ⇄全体を切替"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-foreground/70 leading-tight">
                  {def.labelJa}
                  {/* 成長の有無を明示（+4/Lv・成長なし。移動速度等は概念自体なし） */}
                  {growthLabel(self.stats, def.key) && (
                    <span className="ml-1 text-[10px] text-foreground/60 tabular-nums">
                      {growthLabel(self.stats, def.key)}
                    </span>
                  )}
                </span>
                <span className="num-data text-base leading-tight">
                  {g ? formatGaugeValue(def.key, g.value) : formatGaugeValue(def.key, self.stats[def.key] ?? 0)}
                </span>
              </div>
              <div className="relative h-1 bg-secondary/80 rounded-full mt-1.5">
                <div
                  className="absolute inset-y-0 left-0 bg-primary/85 rounded-full transition-[width] duration-300"
                  style={{ width: `${g ? g.fillPct : 0}%` }}
                />
              </div>
              {g && (
                <p className="text-[11px] text-foreground/70 leading-tight mt-1 tabular-nums">
                  {g.groupLabel}{g.groupLabel === '全チャンピオン' ? '中' : '内'} {g.rankLabel}
                </p>
              )}
            </button>
          );
        })}
      </div>
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
  const { entries: statEntries, overrides: statOverrides } = useChampionStatEntries();
  const { statMap, mediumStatMap } = useItemsByStats();
  const [activeSkill, setActiveSkill] = useState<SkillKey>('P');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeStatKey, setActiveStatKey] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');

  useDocumentTitle(
    champion ? `${champion.name} スキル実数値・基礎ステータス | nunune.gg` : null,
  );

  const handleStatClick = useCallback((key: string, label: string) => {
    setActiveStatKey(key);
    setActiveLabel(label);
  }, []);

  // prev / next チャンピオン（名前順）
  const currentIdx = champions.findIndex(c => c.id === id);
  const prevChampion = currentIdx > 0 ? champions[currentIdx - 1] : null;
  const nextChampion = currentIdx >= 0 && currentIdx < champions.length - 1 ? champions[currentIdx + 1] : null;

  // トップへ戻るボタンの表示判定 + 最下部でのスクロールスパイ補正。
  // （getBoundingClientRect のような要素ごとのレイアウト読み取りはしない）
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);
      // 最下部: 最後のスキルは上端がナビ下端まで届かないことがあるため直接指定
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        setActiveSkill('R');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // スキルのスクロールスパイ: スクロール毎の getBoundingClientRect を避け
  // IntersectionObserver（ビューポート上部の判定帯）で現在地を追う
  useEffect(() => {
    if (!champion) return;
    const keys: SkillKey[] = ['P', 'Q', 'W', 'E', 'R'];
    const visible = new Set<SkillKey>();
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        const key = e.target.id.replace('skill-', '') as SkillKey;
        if (e.isIntersecting) visible.add(key);
        else visible.delete(key);
      }
      // ナビ下端より下に見えているうち最上位のスキル＝現在読んでいるスキル
      for (const key of keys) {
        if (visible.has(key)) { setActiveSkill(key); return; }
      }
    }, { rootMargin: '-96px 0px 0px 0px' });
    for (const key of keys) {
      const el = document.getElementById(`skill-${key}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [champion]);

  function scrollToSkill(key: SkillKey) {
    setActiveSkill(key);
    const el = document.getElementById(`skill-${key}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
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

  const selfEntry: ChampStatEntry = {
    id: champion.id,
    tags: champion.tags,
    // DDragonのAD成長値欠落をCI生成の補完データで埋める
    stats: applyStatOverrides(champion.id, champion.stats, statOverrides),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 前後チャンピオン矢印 */}
      {prevChampion && (
        <Link
          to={`/champion/${prevChampion.id}`}
          aria-label={`前のチャンピオン: ${prevChampion.name}`}
          title={prevChampion.name}
          className="fixed left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-[color,background-color,border-color,opacity] opacity-50 hover:opacity-100"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {nextChampion && (
        <Link
          to={`/champion/${nextChampion.id}`}
          aria-label={`次のチャンピオン: ${nextChampion.name}`}
          title={nextChampion.name}
          className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-md bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-[color,background-color,border-color,opacity] opacity-50 hover:opacity-100"
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
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        </div>

        {/* 戻るリンク（ヒーロー上にオーバーレイ） */}
        <div className="relative z-10">
          <div className="container mx-auto px-4 py-3 max-w-5xl">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/50 text-sm text-foreground/80 hover:text-foreground hover:bg-background/70 transition-colors"
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
                className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-sm bg-background/60 border border-border/60 text-foreground/80"
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
          </div>

          <StatGauges self={selfEntry} entries={statEntries} />
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
          onClick={() => window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          })}
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
