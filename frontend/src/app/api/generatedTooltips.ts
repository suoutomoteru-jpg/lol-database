/**
 * 生成済みツールチップ JSON クライアント
 *
 * scripts/generate_tooltips.py が CommunityDragon の本番パッチデータから
 * 生成した静的 JSON（/tooltips/{championId}.json）を読み込む。
 * 数値・計算式はビルド時に解決済みなので、実行時の Wiki アクセスは不要。
 */

export interface GeneratedSkill {
  name: string;
  description: string;
  cooldown?: string;
  cost?: string;
  range?: string;
  maxRank?: number;
  unresolved?: string[];
}

export interface GeneratedChampionTooltips {
  alias: string;
  id: number;
  name: string;
  title: string;
  patch: string;
  skills: {
    passive: GeneratedSkill;
    q: GeneratedSkill;
    w: GeneratedSkill;
    e: GeneratedSkill;
    r: GeneratedSkill;
  };
  unresolvedCount: number;
}

/**
 * 生成済みツールチップを取得する。存在しない場合は null
 * （呼び出し側は従来の Wiki 補完パスにフォールバックする）。
 */
export async function fetchGeneratedTooltips(
  championId: string,
): Promise<GeneratedChampionTooltips | null> {
  try {
    const res = await fetch(`/tooltips/${championId}.json`);
    if (!res.ok) return null;
    return (await res.json()) as GeneratedChampionTooltips;
  } catch {
    return null;
  }
}
