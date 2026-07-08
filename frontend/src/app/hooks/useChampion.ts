import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import { fetchGeneratedTooltips } from '../api/generatedTooltips';
import type { GeneratedSkill } from '../api/generatedTooltips';
import { resolveDDragonTemplates, resolveAtVarTemplates } from '../utils/ddragonTemplates';
import { processTooltipHtml } from '../utils/richText';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';

export interface SkillData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  /** HTML string。dangerouslySetInnerHTML で描画すること */
  description: string;
  cooldownBurn?: string;
  costBurn?: string;
  costType?: string;
  rangeBurn?: string;
  imageUrl: string;
}

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

function resolvePassiveDescription(desc: string, partype: string): string {
  let s = desc;
  s = s.split('{{ abilityresourcename }}').join(partype);
  s = s.split('{{abilityresourcename}}').join(partype);
  s = s.replace(/\{\{[^}]*\}\}/g, '');
  s = s.replace(/@\w+(?:\*\d+(?:\.\d+)?)?@/g, '');
  return processTooltipHtml(s);
}

function buildSkill(
  key: 'Q' | 'W' | 'E' | 'R',
  spell: DDragonSpell,
  version: string,
  partype: string,
  generated?: GeneratedSkill,
): SkillData {
  const rangeNum = parseInt(spell.rangeBurn, 10);
  const hasRange = spell.rangeBurn !== 'self'
    && spell.rangeBurn !== '0'
    && !isNaN(rangeNum)
    && rangeNum <= 5000;

  let description: string;
  if (generated?.description?.trim()) {
    // 生成済みツールチップ（CommunityDragon 由来・数値解決済み）を優先
    description = processTooltipHtml(generated.description);
  } else {
    // フォールバック: DDragon のプレースホルダーを解決できる範囲で解決
    let tooltip = resolveDDragonTemplates(spell.tooltip, spell, partype);
    tooltip = resolveAtVarTemplates(tooltip, spell);
    tooltip = tooltip.replace(/\{\{[^}]*\}\}/g, ''); // 未解決変数を除去
    description = processTooltipHtml(tooltip);
  }

  const rawCostType = spell.costType ?? '';
  const resolvedCostType = rawCostType
    .replace(/\{\{\s*abilityresourcename\s*\}\}/gi, partype)
    .replace(/@abilityresourcename@/gi, partype)
    .trim();

  const cooldownBurn = generated?.cooldown || spell.cooldownBurn || undefined;
  const costBurn = generated?.cost && generated.cost !== '0'
    ? generated.cost
    : (spell.costBurn !== '0' ? spell.costBurn : undefined);

  return {
    key,
    name:         spell.name,
    description,
    cooldownBurn,
    costBurn,
    costType:     resolvedCostType !== 'No Cost' && resolvedCostType !== '' ? resolvedCostType : undefined,
    rangeBurn:    hasRange ? spell.rangeBurn : undefined,
    imageUrl:     spellImageUrl(version, spell.image.full),
  };
}

export function useChampion(championId: string | undefined): UseChampionResult {
  const [champion, setChampion] = useState<ChampionDetailData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<Error | null>(null);

  useEffect(() => {
    if (!championId) return;
    let cancelled = false;

    setChampion(null);
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // 1. DDragon バージョン + チャンピオン詳細（メインソース）
        const v   = await getLatestVersion();
        const raw = await fetchChampionDetail(v, championId!);
        if (cancelled) return;

        const [Q, W, E, R] = raw.spells;
        const partype = raw.partype;

        // 2. 生成済みツールチップ（数値解決済みの静的 JSON）
        const generated = await fetchGeneratedTooltips(raw.id).catch(() => null);
        if (cancelled) return;

        const passiveDescription = generated?.skills.passive.description?.trim()
          ? processTooltipHtml(generated.skills.passive.description)
          : resolvePassiveDescription(raw.passive.description, partype);

        const skills: SkillData[] = [
          {
            key:         'P',
            name:        raw.passive.name,
            description: passiveDescription,
            imageUrl:    passiveImageUrl(v, raw.passive.image.full),
          },
          buildSkill('Q', Q, v, partype, generated?.skills.q),
          buildSkill('W', W, v, partype, generated?.skills.w),
          buildSkill('E', E, v, partype, generated?.skills.e),
          buildSkill('R', R, v, partype, generated?.skills.r),
        ];

        setChampion({
          id:      raw.id,
          name:    raw.name,
          title:   raw.title,
          role:    raw.tags[0] ?? 'Fighter',
          lore:    raw.lore,
          partype,
          tags:    raw.tags,
          stats:   raw.stats,
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
