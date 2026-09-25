import { useEffect, useRef, useState } from 'react';

/**
 * 数値のカウントアップ表示（積んだ瞬間の即時フィードバック用）
 *
 * target が変わると直前の表示値から target まで rAF で補間する。
 * prefers-reduced-motion 時は即座に target を返す。
 */
export function useCountUp(target: number, duration = 450): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  displayRef.current = display;

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;

    if (typeof matchMedia !== 'undefined' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3; // easeOutCubic
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
