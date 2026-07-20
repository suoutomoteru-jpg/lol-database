import { Link } from 'react-router';
import { FEEDBACK_FORM_URL } from './ReportLink';

/**
 * 全ページ共通フッター
 * Riotのファンコンテンツポリシー（Legal Jibber Jabber）が求める
 * 非公式表記のボイラープレートを掲載する。
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          nunune.gg は Riot Games の承認を受けていない非公式のファンコンテンツであり、
          Riot Games ならびに League of Legends の制作・運営に公式に関与する者の
          見解や意見を反映するものではありません。League of Legends および Riot Games は
          Riot Games, Inc. の商標または登録商標です。
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          nunune.gg was created under Riot Games&apos; &quot;Legal Jibber Jabber&quot; policy
          using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            データ: <a href="https://developer.riotgames.com/docs/lol#data-dragon" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline decoration-border">Riot Data Dragon</a>
            {' / '}
            <a href="https://communitydragon.org" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline decoration-border">CommunityDragon</a>
          </span>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline decoration-border">お問い合わせ・バグ報告</a>
          <Link to="/privacy" className="hover:text-foreground underline decoration-border">プライバシーポリシー</Link>
          <span>© {new Date().getFullYear()} nunune.gg</span>
        </div>
      </div>
    </footer>
  );
}
