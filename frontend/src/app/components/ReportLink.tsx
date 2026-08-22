/** お問い合わせ・バグ報告用 Google フォーム */
export const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSc27WqZGkej8D3i6b-RgAE2SJ068cB90tFYX6hx1olpkEGEmw/viewform';

/**
 * 詳細ページ末尾に置く「データの間違いを報告」導線。
 * 数値データの誤り報告はサイト品質に直結するため、目立ちすぎない形で常設する。
 */
export function ReportLink() {
  return (
    <p className="text-right">
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-border"
      >
        データの間違いを報告
      </a>
    </p>
  );
}
