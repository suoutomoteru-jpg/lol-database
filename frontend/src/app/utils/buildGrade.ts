/**
 * ビルド全体の金銭効率グレード
 *
 * トレイに積んだアイテム合計の金銭効率を S/A/B/C に段階評価する。
 * 「あと◯%でS」を見せて組み替え（最適化ループ）を誘発するのが目的。
 */

export type BuildGrade = 'S' | 'A' | 'B' | 'C';

const THRESHOLDS: Array<[BuildGrade, number]> = [
  ['S', 115],
  ['A', 105],
  ['B', 95],
];

export function calcBuildGrade(efficiency: number): BuildGrade {
  for (const [grade, min] of THRESHOLDS) {
    if (efficiency >= min) return grade;
  }
  return 'C';
}

/** 次のグレードと、そこまでに必要な効率差分。すでにSならnull */
export function nextGradeGap(efficiency: number): { grade: BuildGrade; gap: number } | null {
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    const [grade, min] = THRESHOLDS[i];
    if (efficiency < min) {
      // より上のグレード閾値も下回っている場合は最も近い閾値を返したいので
      // 低い方（B）から順に見て最初に届いていないものを返す
      return { grade, gap: min - efficiency };
    }
  }
  return null;
}
