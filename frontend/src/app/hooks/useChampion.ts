import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';

/** ChampionDetail ページで使うスキルデータ */
export interface SkillData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;
  cooldownBurn?: string;
  costBurn?: string;
  costType?: string;
  rangeBurn?: string;
  imageUrl: string;
  effects: SkillEffect[];   // ダメージ・回復量などレベルスケール値
  ratios: SkillRatio[];     // AP / AD 比率
}

/** effectBurn から抽出したスケール値（例: "40/65/90/115/140"） */
export interface SkillEffect {
  label: string;   // "Damage" など leveltip.label から
  burn: string;    // "40/65/90/115/140"
}

/** vars から抽出した比率（例: "+33% AP"） */
export interface SkillRatio {
  stat: string;    // "AP" | "AD" | "ボーナスAD" など
  pct: number;     // 33
}

/** ChampionDetail ページ用の加工済みデータ */
export interface ChampionDetailData {
  id: string;
  name: string;
  title: string;
  role: string;
  lore: string;
  partype: string;
  tags: string[];
  stats: DDragonChampionDetail['stats'];
  skills: SkillData[];
  version: string;
}

interface UseChampionResult {
  champion: ChampionDetailData | null;
  loading: boolean;
  error: Error | null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/** "spelldamage" などのリンクキーを表示用ラベルに変換 */
function statLabel(link: string): string {
  const map: Record<string, string> = {
    spelldamage:        'AP',
    bonusattackdamage:  'ボーナスAD',
    attackdamage:       'AD',
    hp:                 'HP',
    bonushp:            'ボーナスHP',
    armor:              '鎧',
    bonusarmor:         'ボーナス鎧',
    spellblock:         '魔法耐性',
    attackspeed:        'AS',
  };
  return map[link] ?? link;
}

/** effectBurn（レベルスケール値）を抽出 */
function extractEffects(spell: DDragonSpell): SkillEffect[] {
  const labels = spell.leveltip?.label ?? [];
  const burns = spell.effectBurn ?? [];

  const results: SkillEffect[] = [];
  // effectBurn[0] は常に空文字なので [1] から開始
  for (let i = 1; i < burns.length; i++) {
    const burn = burns[i];
    if (!burn || burn === '0') continue;
    results.push({
      label: labels[i - 1] ?? `Effect ${i}`,
      burn,
    });
  }
  return results;
}

/** vars（AP/AD比率）を抽出 */
function extractRatios(spell: DDragonSpell): SkillRatio[] {
  return (spell.vars ?? []).map(v => {
    const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
    return {
      stat: statLabel(v.link),
      pct: Math.round(coeff * 100),
    };
  });
}

function buildSkill(key: 'Q' | 'W' | 'E' | 'R', spell: DDragonSpell, version: string): SkillData {
  const hasRange = spell.rangeBurn !== 'self' && spell.rangeBurn !== '0';
  return {
    key,
    name: spell.name,
    description: stripHtml(spell.description),
    cooldownBurn: spell.cooldownBurn || undefined,
    costBurn: spell.costBurn !== '0' ? spell.costBurn : undefined,
    costType: spell.costType !== 'No Cost' ? spell.costType : undefined,
    rangeBurn: hasRange ? spell.rangeBurn : undefined,
    imageUrl: spellImageUrl(version, spell.image.full),
    effects: extractEffects(spell),
    ratios: extractRatios(spell),
  };
}

export function useChampion(championId: string | undefined): UseChampionResult {
  const [champion, setChampion] = useState<ChampionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!championId) return;
    let cancelled = false;

    setChampion(null);
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const v = await getLatestVersion();
        const raw = await fetchChampionDetail(v, championId!);

        if (cancelled) return;

        const [Q, W, E, R] = raw.spells;

        const skills: SkillData[] = [
          {
            key: 'P',
            name: raw.passive.name,
            description: stripHtml(raw.passive.description),
            imageUrl: passiveImageUrl(v, raw.passive.image.full),
            effects: [],
            ratios: [],
          },
          buildSkill('Q', Q, v),
          buildSkill('W', W, v),
          buildSkill('E', E, v),
          buildSkill('R', R, v),
        ];

        setChampion({
          id: raw.id,
          name: raw.name,
          title: raw.title,
          role: raw.tags[0] ?? 'Fighter',
          lore: raw.lore,
          partype: raw.partype,
          tags: raw.tags,
          stats: raw.stats,
          skills,
          version: v,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [championId]);

  return { champion, loading, error };
}
