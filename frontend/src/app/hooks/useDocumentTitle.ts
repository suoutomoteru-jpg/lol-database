import { useEffect } from 'react';

const DEFAULT_TITLE = 'nunune — LoL 日本語データベース';

/** ページごとに document.title を設定する（アンマウント時は既定に戻す） */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = title;
    return () => { document.title = DEFAULT_TITLE; };
  }, [title]);
}
