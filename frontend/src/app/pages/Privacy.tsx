import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm leading-relaxed text-foreground/80 space-y-2">{children}</div>
    </section>
  );
}

export function Privacy() {
  useDocumentTitle('プライバシーポリシー | nunune');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-2.5 max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} />
            戻る
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        <h1 className="text-2xl font-bold text-foreground">プライバシーポリシー</h1>

        <Section title="概要">
          <p>
            nunune（以下「本サービス」）は、League of Legends のチャンピオン・アイテム情報を
            閲覧できる非公式のデータベースサービスです。本ポリシーは、本サービスにおける
            利用者情報の取り扱いについて定めるものです。
          </p>
        </Section>

        <Section title="収集する情報">
          <p>
            本サービスは会員登録を必要とせず、氏名・メールアドレス等の個人情報を収集しません。
          </p>
          <p>
            ビルドトレイの内容などの設定情報は、お使いのブラウザのローカルストレージにのみ
            保存され、外部サーバーへ送信されることはありません。
          </p>
        </Section>

        <Section title="アクセス解析">
          <p>
            本サービスは、サービス改善のためにアクセス解析ツールを利用する場合があります。
            解析ツールはトラフィックデータを匿名で収集するものであり、個人を特定するものでは
            ありません。導入時には本ポリシーを更新します。
          </p>
        </Section>

        <Section title="広告">
          <p>
            本サービスは、将来的に第三者配信の広告サービスを利用する場合があります。
            広告配信事業者は、利用者の興味に応じた広告を表示するために Cookie を使用する
            ことがあります。導入時には本ポリシーを更新し、オプトアウト方法を案内します。
          </p>
        </Section>

        <Section title="外部データソース">
          <p>
            本サービスが表示するゲームデータは、Riot Games が提供する Data Dragon および
            コミュニティが運営する CommunityDragon から取得しています。これらへのアクセスは
            利用者のブラウザから直接行われる場合があります。
          </p>
        </Section>

        <Section title="ポリシーの変更">
          <p>
            本ポリシーの内容は、必要に応じて予告なく変更されることがあります。
            変更後のポリシーは、本ページに掲載された時点で効力を生じます。
          </p>
        </Section>
      </div>
    </div>
  );
}
