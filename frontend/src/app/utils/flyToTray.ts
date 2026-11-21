/**
 * 「積む」演出: アイテムアイコンの分身をトレイのスロットへ飛ばす
 *
 * 追加操作の結果（どこに積まれたか）を視線誘導で示す即時フィードバック。
 * DOM要素を1つ作って CSS transform で移動させるだけの軽量実装。
 * prefers-reduced-motion 時は何もしない。
 */
export function flyToTray(source: HTMLElement | null, imgUrl: string, itemId: string): void {
  if (!source) return;
  if (typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // トレイの再レンダリング（スロットが埋まる）を待ってから目標位置を取る
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const target =
      document.querySelector<HTMLElement>(`[data-tray-item="${itemId}"]`) ??
      document.querySelector<HTMLElement>('[data-tray-slots]');

    const s = source.getBoundingClientRect();
    let dx: number;
    let dy: number;
    let scale: number;
    if (target) {
      const t = target.getBoundingClientRect();
      dx = t.left + t.width / 2 - (s.left + s.width / 2);
      dy = t.top + t.height / 2 - (s.top + s.height / 2);
      scale = t.width / s.width;
    } else {
      // トレイ未描画時のフォールバック: 画面下部中央へ
      dx = window.innerWidth / 2 - (s.left + s.width / 2);
      dy = window.innerHeight - 40 - (s.top + s.height / 2);
      scale = 0.4;
    }

    const ghost = document.createElement('img');
    ghost.src = imgUrl;
    ghost.alt = '';
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${s.left}px`,
      top: `${s.top}px`,
      width: `${s.width}px`,
      height: `${s.height}px`,
      borderRadius: '8px',
      zIndex: '60',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
    });
    document.body.appendChild(ghost);

    ghost.getBoundingClientRect(); // 初期位置を確定させてから transition 開始
    ghost.style.transition = 'transform .55s cubic-bezier(.3,.7,.3,1), opacity .55s ease-in';
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    ghost.style.opacity = '0.25';
    setTimeout(() => ghost.remove(), 600);
  }));
}
