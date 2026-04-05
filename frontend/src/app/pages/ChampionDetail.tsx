import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, ChevronUp } from 'lucide-react';
import { useChampion } from '../hooks/useChampion';
import { championImageUrl } from '../api/dataDragon';
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
      {/* スキル名 */}
      <p className="text-2xl font-medium mb-4">
        <span className="text-primary font-bold">{skill.key}</span>
        {' — '}
        {skill.name}
      </p>
      <hr className="border-border mb-6" />

      {/* スキルアイコン + 説明 */}
      <div className="flex gap-5 mb-8">
        <img
          src={skill.imageUrl}
          alt={skill.name}
          className="w-16 h-16 rounded-xl border border-border flex-shrink-0"
          loading="lazy"
        />
        <p className="text-foreground leading-relaxed text-lg whitespace-pre-line">{skill.description}</p>
      </div>

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
    </div>
  );
}

// ── メインページ ──────────────────────────────────────

export function ChampionDetail() {
  const { id } = useParams<{ id: string }>();
  const { champion, loading, error } = useChampion(id);
  const [activeSkill, setActiveSkill] = useState<SkillKey>('P');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // スクロール検出
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      // スキルセクションのどれが画面内にあるか検出
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

  // ── ローディング ───────────────────────────────────
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

  // ── エラー ──────────────────────────────────────────
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
            <p className="text-muted-foreground text-lg mt-1">{champion.title}</p>
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
