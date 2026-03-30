import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';

/** ChampionDetail ページで使うスキルデータ */
export interface SkillData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;  // HTML除去済み
  cooldownBurn?: string;
  costBurn?: string;
  costType?: string;
  rangeBurn?: string;
  imageUrl: string;
}

/** ChampionDetail ページ用の加工済みデータ */
export interface ChampionDetailData {
  id: string;
  name: string;
  title: string;
  role: string;
  lore: string;
  partype: string;       // リソースタイプ (Mana / Energy / None…)
  tags: string[];        // ["Mage", "Assassin"]
  stats: DDragonChampionDetail['stats'];
  skills: SkillData[];
  version: string;
}

interface UseChampionResult {
  champion: ChampionDetailData | null;
  loading: boolean;
  error: Error | null;
}

/** Data Dragon の説明文に含まれる HTML タグを除去する */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function buildSkill(
  key: 'Q' | 'W' | 'E' | 'R',
  spell: DDragonSpell,
  version: string,
): SkillData {
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
