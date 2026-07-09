/**
 * 手描き風アクセント（インラインSVG・依存なし）
 *
 * データ表示は几帳面なまま、注釈・下線・矢印だけを手描き風に揺らして
 * 遊びを出す。色は currentColor を継承する。
 */

/** くるっとカールした下向き矢印（注釈 → 対象を指す用） */
export function CurlyArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" fill="none" aria-hidden className={className}>
      <path
        d="M29 4 C 37 13, 31 21, 22 25 C 12 29.5, 11.5 37, 17.5 42"
        stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
      />
      <path
        d="M11 36.5 L 17.8 42.4 L 19.5 34"
        stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
