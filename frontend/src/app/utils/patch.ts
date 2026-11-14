/**
 * パッチ番号の表示用変換
 *
 * DDragon のバージョンは旧様式（例: 16.13.1）のままだが、2025年の
 * 表記変更以降、ゲーム内・パッチノートはメジャーを +10 した季節表記
 * （例: 26.13）を使う。ユーザー向け表示は後者に合わせる。
 */
export function displayPatch(ddragonVersion: string): string {
  const [maj, min] = ddragonVersion.split('.');
  const n = parseInt(maj, 10);
  if (Number.isNaN(n) || !min) return ddragonVersion;
  return n >= 15 ? `${n + 10}.${min}` : `${maj}.${min}`;
}
