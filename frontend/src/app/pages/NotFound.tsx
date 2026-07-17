import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFound() {
  useDocumentTitle('ページが見つかりません | nunune.gg');

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      <p className="font-display font-black text-5xl text-primary/70">404</p>
      <p className="text-sm text-muted-foreground text-center">
        お探しのページは見つかりませんでした。<br />
        パッチで削除されたのかもしれません。
      </p>
      <Link
        to="/"
        className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        ホームへ戻る
      </Link>
    </div>
  );
}
