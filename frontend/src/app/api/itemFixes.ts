/**
 * アイテム説明文の修正データ（CI生成）
 *
 * DDragon/CDragon の静的エクスポートでは、一部アイテムの動的数値
 * （パッシブのCD・効果量など）が 0 や空欄のまま配信される。
 * CI がゲームバイナリ（items.cdtb.bin）の計算式から実数値を解決し、
 * 修正済み説明文を /tooltips/item-desc-fixes.json に出力する。
 * ファイルが無い・取得に失敗した場合は元の説明文のまま動作する。
 */

export interface ItemDescFixes {
  /** 生成元パッチ */
  version?: string;
  /** itemId → 修正済み description HTML */
  fixes: Record<string, string>;
}

let cache: Promise<Record<string, string>> | null = null;

export function fetchItemDescFixes(): Promise<Record<string, string>> {
  if (!cache) {
    cache = fetch('/tooltips/item-desc-fixes.json')
      .then(r => (r.ok ? (r.json() as Promise<ItemDescFixes>) : { fixes: {} }))
      .then(d => d.fixes ?? {})
      .catch(() => ({}));
  }
  return cache;
}
