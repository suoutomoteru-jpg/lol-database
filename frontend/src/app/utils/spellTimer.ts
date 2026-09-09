// コズミックインサイト(ルーン)とイオニアブーツの召喚スキルCT短縮率。
// DDragonのルーン/アイテムAPIには短縮率が構造化データとして含まれておらず、
// 説明文からのテキスト抽出は表記ゆれに弱く壊れやすいため既知の値を定数で持つ。
// パッチで変わった場合はここを更新する(2026-09時点: それぞれ15%/10%、加算適用)。
export const COSMIC_INSIGHT_CDR = 0.15;
export const IONIAN_BOOTS_CDR = 0.10;

export function effectiveCooldownMs(baseSeconds: number, cosmicInsight: boolean, ionianBoots: boolean): number {
  const reduction = (cosmicInsight ? COSMIC_INSIGHT_CDR : 0) + (ionianBoots ? IONIAN_BOOTS_CDR : 0);
  return Math.round(baseSeconds * (1 - reduction) * 1000);
}

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
