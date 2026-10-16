/**
 * Scaling Chart 用の生成済み勝率データクライアント
 *
 * scripts/fetch_scaling_data.py が Riot Match-V5 API から
 * ランクソロ/デュオ（全ティア横断サンプリング）の試合を収集し、
 * 「試合時間帯（序盤/中盤/終盤）ごとの勝率」をチャンピオン単位で
 * 集計した静的 JSON（/tooltips/scaling.json）を読み込む。
 *
 * 集計方法（Lolalytics等と同じ手法）:
 *   各チャンピオンについて、そのチャンピオンが使われた試合を
 *   「最終的な試合時間」でバケット分けし、バケットごとの勝率を出す。
 *   タイムライン上のスナップショットではなく、試合結果の相関に基づく指標。
 */

export type ScalingPhase = 'early' | 'mid' | 'late';

export interface ScalingBucketStat {
  games: number;
  wins: number;
  winrate: number;
}

export interface ScalingChampionEntry {
  alias: string;
  early: ScalingBucketStat;
  mid: ScalingBucketStat;
  late: ScalingBucketStat;
}

export interface ScalingData {
  generatedAt: string;
  patch: string;
  queue: string;
  sampledMatches: number;
  buckets: {
    early: { maxMinutes: number };
    mid: { minMinutes: number; maxMinutes: number };
    late: { minMinutes: number };
  };
  /** サンプルデータ等の注記（本番生成データには含まれない） */
  note?: string;
  champions: ScalingChampionEntry[];
}

export async function fetchScalingData(): Promise<ScalingData | null> {
  try {
    const res = await fetch('/tooltips/scaling.json');
    if (!res.ok) return null;
    return (await res.json()) as ScalingData;
  } catch {
    return null;
  }
}
