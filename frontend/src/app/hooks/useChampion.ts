import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionDetail, spellImageUrl, passiveImageUrl } from '../api/dataDragon';
import type { DDragonChampionDetail, DDragonSpell } from '../types/ddragon';

export interface SkillData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;
  cooldownBurn?: string;
  costBurn?: string;
  costType?: string;
  rangeBurn?: string;
  imageUrl: string;
  effects: SkillEffect[];
  ratios: SkillRatio[];
}

/** effectBurn から抽出したスケール値（例: "40/65/90/115/140"） */
export interface SkillEffect {
  label: string;
  burn: string;
}

/** vars から抽出した比率（例: "+33% AP"） */
export interface SkillRatio {
  stat: string;
  pct: number;
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
    .trim();
}

/**
 * Data Dragon テンプレート変数を実際の値に置換する
 *   {{ abilityresourcename }} → Mana / Energy / など（partype）
 *   その他未解決の {{ ... }} は除去する
 */
function resolveTemplates(text: string, partype: string): string {
  return text
    .replace(/\{\{\s*abilityresourcename\s*\}\}/gi, partype)
    .replace(/\{\{\s*[^}]+\}\}/g, '');
}

function parseDescription(html: string, partype: string): string {
  return resolveTemplates(stripHtml(html), partype);
}

// ── スキルデータ抽出 ──────────────────────────────────

function statLabel(link: string): string {
  const map: Record<string, string> = {
    spelldamage:       'AP',
    bonusattackdamage: 'ボーナスAD',
    attackdamage:      'AD',
    hp:                'HP',
    bonushp:           'ボーナスHP',
    armor:             '鎧',
    spellblock:        'MR',
    attackspeed:       'AS',
  };
  return map[link] ?? link;
}

/**
 * leveltip.effect のテンプレート（"{{ e1 }}" 等）を解析して
 * effectBurn の対応する値を取得する
 *
 * Data Dragon の対応関係:
 *   leveltip.label[j]    → ラベル（"Damage", "クールダウン" 等）
 *   leveltip.effect[j]   → "{{ e1 }}" 等のテンプレート
 *   effectBurn[1]        → {{ e1 }} の値（"40/65/90/115/140"）
 */
function extractEffects(spell: DDragonSpell): SkillEffect[] {
  const labels   = spell.leveltip?.label  ?? [];
  const templates = spell.leveltip?.effect ?? [];
  const burns    = spell.effectBurn ?? [];

  const results: SkillEffect[] = [];

  for (let j = 0; j < labels.length; j++) {
    const template = templates[j] ?? '';

    // "{{ e1 }}" から数字部分を取得
    const match = template.match(/\{\{\s*e(\d+)\s*\}\}/);
    if (!match) continue;

    const idx  = parseInt(match[1], 10);
    const burn = burns[idx];
    if (!burn || burn === '0') continue;

    results.push({ label: labels[j], burn });
  }

  return results;
}

function extractRatios(spell: DDragonSpell): SkillRatio[] {
  return (spell.vars ?? []).map(v => {
    const coeff = Array.isArray(v.coeff) ? v.coeff[0] : v.coeff;
    return { stat: statLabel(v.link), pct: Math.round(coeff * 100) };
  });
}

function buildSkill(key: 'Q' | 'W' | 'E' | 'R', spell: DDragonSpell, version: string, partype: string): SkillData {
  const rangeNum = parseInt(spell.rangeBurn, 10);
  // 5000 超 or "self" は非現実的 or 自己対象なので表示しない
  const hasRange = spell.rangeBurn !== 'self'
    && spell.rangeBurn !== '0'
    && !isNaN(rangeNum)
    && rangeNum <= 5000;

  return {
    key,
    name: spell.name,
    description: parseDescription(spell.description, partype),
    cooldownBurn: spell.cooldownBurn || undefined,
    costBurn: spell.costBurn !== '0' ? spell.costBurn : undefined,
    costType: spell.costType !== 'No Cost' ? spell.costType : undefined,
    rangeBurn: hasRange ? spell.rangeBurn : undefined,
    imageUrl: spellImageUrl(version, spell.image.full),
    effects: extractEffects(spell),
    ratios:  extractRatios(spell),
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
            key: 'P',
            name: raw.passive.name,
            description: parseDescription(raw.passive.description, partype),
            imageUrl: passiveImageUrl(v, raw.passive.image.full),
            effects: [],
            ratios:  [],
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
