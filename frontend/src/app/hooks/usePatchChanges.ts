import { useEffect, useState } from 'react';
import { fetchItemPatchDiff, type ItemPatchDiff } from '../api/patchDiff';

// セッション内で1回だけ計算する（複数コンポーネントから購読される）
let sharedPromise: Promise<ItemPatchDiff | null> | null = null;

/**
 * 今パッチで 新規/変更 されたアイテムの差分マップを返す。
 * 取得失敗時は null（バッジ非表示で動作継続）。
 */
export function usePatchChanges(): ItemPatchDiff | null {
  const [diff, setDiff] = useState<ItemPatchDiff | null>(null);

  useEffect(() => {
    let cancelled = false;
    sharedPromise ??= fetchItemPatchDiff();
    sharedPromise.then(d => { if (!cancelled) setDiff(d); });
    return () => { cancelled = true; };
  }, []);

  return diff;
}
