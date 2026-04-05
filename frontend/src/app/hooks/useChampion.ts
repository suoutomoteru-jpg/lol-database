import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';

export interface SkillData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;   // tooltip を解析した詳細説明
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

// ── テキスト処理 ──────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Data Dragon テンプレート変数を解決する
 *
 * tooltip に含まれる変数:
 *   {{ eN }}  → effectBurn[N]（"40/65/90/115/140" など）
 *   {{ aN }}  → vars[N-1] の比率（"33%" など）
 *   {{ fN }}  → effectBurn[N]（fは変形値、eと同じインデックスで代用）
 *   {{ abilityresourcename }} → partype（"Mana", "マナ" など）
 */
function resolveTooltip(tooltip: string, spell: DDragonSpell, partype: string): string {
  const burns = spell.effectBurn ?? [];
  const vars  = spell.vars      ?? [];

  let result = tooltip;

  // {{ eN }} → effectBurn[N]
  result = result.replace(/\{\{\s*e(\d+)\s*\}\}/g, (_, n) => {
    return burns[parseInt(n, 10)] ?? '';
  });

  // {{ aN }} → vars[N-1] をパーセント表記
  result = result.replace(/\{\{\s*a(\d+)\s*\}\}/g, (_, n) => {
    const v = vars[parseInt(n, 10) - 1];
    if (!v) return '';
    const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
    return `${Math.round(coeff * 100)}%`;
  });

  // {{ fN }} → effectBurn[N]（フォールバック）
  result = result.replace(/\{\{\s*f(\d+)\s*\}\}/g, (_, n) => {
    return burns[parseInt(n, 10)] ?? '';
  });

  // {{ abilityresourcename }} → partype（split/join で確実に置換）
  result = result.split('{{ abilityresourcename }}').join(partype);
  result = result.split('{{abilityresourcename}}').join(partype);

  // 残ったテンプレート変数を除去
  result = result.replace(/\{\{[^}]*\}\}/g, '');

  return stripHtml(result);
}

/** passive は tooltip を持たないため description を使用 */
function resolveDescription(desc: string, partype: string): string {
  let result = desc;
  result = result.split('{{ abilityresourcename }}').join(partype);
  result = result.split('{{abilityresourcename}}').join(partype);
  result = result.replace(/\{\{[^}]*\}\}/g, '');
  return stripHtml(result);
}

// ── スキルデータ構築 ──────────────────────────────────

function buildSkill(key: 'Q' | 'W' | 'E' | 'R', spell: DDragonSpell, version: string, partype: string): SkillData {
  const rangeNum = parseInt(spell.rangeBurn, 10);
  const hasRange = spell.rangeBurn !== 'self'
    && spell.rangeBurn !== '0'
    && !isNaN(rangeNum)
    && rangeNum <= 5000;

  return {
    key,
    name: spell.name,
    // tooltip を使用（{{ eN }}/{{ aN }} 解決済みの詳細説明）
    description: resolveTooltip(spell.tooltip, spell, partype),
    cooldownBurn: spell.cooldownBurn || undefined,
    costBurn:     spell.costBurn !== '0' ? spell.costBurn : undefined,
    costType:     spell.costType !== 'No Cost' ? spell.costType : undefined,
    rangeBurn:    hasRange ? spell.rangeBurn : undefined,
    imageUrl:     spellImageUrl(version, spell.image.full),
  };
}

// ── フック ────────────────────────────────────────────

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
        const v   = await getLatestVersion();
        const raw = await fetchChampionDetail(v, championId!);
        if (cancelled) return;

        const [Q, W, E, R] = raw.spells;
        const partype = raw.partype;

        const skills: SkillData[] = [
          {
            key:         'P',
            name:        raw.passive.name,
            description: resolveDescription(raw.passive.description, partype),
            imageUrl:    passiveImageUrl(v, raw.passive.image.full),
          },
          buildSkill('Q', Q, v, partype),
          buildSkill('W', W, v, partype),
          buildSkill('E', E, v, partype),
          buildSkill('R', R, v, partype),
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
