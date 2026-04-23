import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChampion } from '../hooks/useChampion';
import { useChampions } from '../hooks/useChampions';
import { championImageUrl } from '../api/dataDragon';
import { toWikiName } from '../api/lolWiki';
import type { SkillData } from '../hooks/useChampion';

type SkillKey = 'P' | 'Q' | 'W' | 'E' | 'R';

// ── スキルナビゲーションボタン ──────────────────────────

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
                className={`w-14 h-14 rounded-xl font-bold text-lg transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:scale-105'
                }`}
              >
                {s.key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 1スキルブロック ───────────────────────────────────

function SkillBlock({ skill }: { skill: SkillData }) {
  const hasMeta = skill.cooldownBurn || skill.costBurn || skill.rangeBurn;

  return (
    <div id={`skill-${skill.key}`} className="scroll-mt-32 bg-card border border-border rounded-2xl p-8 shadow-sm">
      {/* アイコン + スキル名（同一行） */}
      <div className="flex items-center gap-3 mb-4">
        <img
          src={skill.imageUrl}
          alt={skill.name}
          className="w-12 h-12 rounded-xl border border-border flex-shrink-0"
          loading="lazy"
        />
        <p className="text-2xl font-medium">
          <span className="text-primary font-bold">{skill.key}</span>
          {' — '}
          {skill.name}
        </p>
      </div>
      <hr className="border-border mb-4" />

      {/* 説明文（インデントなし・全幅） */}
      <div
        className="text-foreground leading-relaxed text-base skill-description mb-8"
        dangerouslySetInnerHTML={{ __html: skill.description }}
      />

      {/* クールダウン・コスト・射程 */}
      {hasMeta && (
        <div className="bg-muted/30 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {skill.cooldownBurn && (
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-28 text-sm">クールダウン</span>
              <span className="text-foreground font-medium text-sm">{skill.cooldownBurn}s</span>
            </div>
          )}
          {skill.costBurn && skill.costType && (
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-28 text-sm">{skill.costType}</span>
              <span className="text-foreground font-medium text-sm">{skill.costBurn}</span>
            </div>
          )}
          {skill.rangeBurn && (
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-28 text-sm">射程</span>
              <span className="text-foreground font-medium text-sm">{skill.rangeBurn}</span>
            </div>
          )}
        </div>
      )}

      {/* Wiki 数値情報（ダメージ・スケーリング） */}
      {skill.leveling && skill.leveling.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">数値情報</p>
          <div className="overflow-x-auto">
            <div className="bg-muted/20 rounded-xl border border-border overflow-hidden min-w-[280px]">
              <table className="w-full text-sm">
                <tbody>
                  {skill.leveling.map((stat, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap">
                        {stat.label}
                      </td>
                      <td className="px-4 py-2.5 text-foreground font-mono whitespace-nowrap">
                        {stat.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────

export function ChampionDetail() {
  const { id } = useParams<{ id: string }>();
  const { champion, loading, error } = useChampion(id);
  const { champions } = useChampions();
  const [activeSkill, setActiveSkill] = useState<SkillKey>('P');
  const [showScrollTop, setShowScrollTop] = useState(false);

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
          <p className="text-sm">Loading from Data Dragon...</p>
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
    { label: 'Health', value: stats.hp },
    { label: 'Mana',   value: champion.partype !== 'None' ? stats.mp : null },
    { label: 'AR',     value: stats.armor },
    { label: 'MR',     value: stats.spellblock },
    { label: 'MS',     value: stats.movespeed },
    { label: 'Range',  value: stats.attackrange },
  ].filter(s => s.value !== null);

  return (
    <div className="min-h-screen bg-background">
      {/* 前後チャンピオン矢印 */}
      {prevChampion && (
        <Link
          to={`/champion/${prevChampion.id}`}
          title={prevChampion.name}
          className="fixed left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-xl bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {nextChampion && (
        <Link
          to={`/champion/${nextChampion.id}`}
          title={nextChampion.name}
          className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-28 rounded-xl bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-all backdrop-blur-sm opacity-50 hover:opacity-100"
        >
          <ChevronRight size={16} />
        </Link>
      )}

      {/* 戻るボタン */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-4 max-w-5xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            <span>戻る</span>
          </Link>
        </div>
      </div>

      {/* ヘッダー */}
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/30 shadow-lg">
            <img
              src={championImageUrl(champion.version, champion.id)}
              alt={champion.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-4xl font-semibold text-foreground">{champion.name}</h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{toWikiName(champion.id)}</p>
            <p className="text-primary mt-1">{champion.role}</p>
          </div>
        </div>
        <div className="border-t border-border" />
      </div>

      {/* ステータスタグ */}
      <div className="container mx-auto px-4 max-w-5xl mb-8">
        <p className="text-sm text-muted-foreground mb-3">ステータス</p>
        <div className="flex flex-wrap gap-2">
          {statTags.map(s => (
            <span
              key={s.label}
              className="px-4 py-2 bg-card border border-border rounded-lg text-sm hover:border-primary/40 hover:bg-primary/5 transition-all cursor-default"
            >
              {s.label}: {s.value}
            </span>
          ))}
        </div>
      </div>

      {/* 特徴タグ */}
      <div className="container mx-auto px-4 max-w-5xl mb-12">
        <p className="text-sm text-muted-foreground mb-3">特徴</p>
        <div className="flex flex-wrap gap-2">
          {champion.tags.map(tag => (
            <span
              key={tag}
              className="px-4 py-2 bg-accent/30 border border-accent rounded-lg text-sm hover:bg-accent/50 transition-all cursor-default"
            >
              {tag}
            </span>
          ))}
          <span className="px-4 py-2 bg-accent/30 border border-accent rounded-lg text-sm hover:bg-accent/50 transition-all cursor-default">
            {champion.partype}
          </span>
        </div>
      </div>

      {/* スキルナビゲーション（スティッキー） */}
      <SkillNav
        skills={champion.skills}
        activeSkill={activeSkill}
        onSelect={scrollToSkill}
      />

      {/* スキル詳細 */}
      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-12">
        {champion.skills.map(skill => (
          <SkillBlock key={skill.key} skill={skill} />
        ))}
      </div>

      {/* トップへ戻るボタン */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="トップへ戻る"
          className="fixed bottom-8 right-8 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:scale-110 transition-transform"
        >
          <ChevronUp size={24} />
        </button>
      )}
    </div>
  );
}
