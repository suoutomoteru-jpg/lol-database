# プロジェクトメモ

## プロジェクト概要

- 日本人LoLプレイヤー向けデータベース「nunune.gg」。タグライン:「はやくて見やすい、LoLのデータベース。」
- 実体は `frontend/`（Vite + React + TypeScript の静的SPA）。ルート直下のPythonファイル群は無関係の旧学習用ツール
- デプロイ: Cloudflare Workers（プロジェクト名 `lol-database-3`、`frontend/wrangler.jsonc`）。mainへのpushで自動デプロイ
- データソース: Riot DDragon（ja_JP）+ CommunityDragon。ツールチップはGitHub Actionsで事前生成し `frontend/public/tooltips/` に静的配置
- お問い合わせ/バグ報告: Googleフォーム（URLは `frontend/src/app/components/ReportLink.tsx` で一元管理）

## コンテキスト消費を抑える

- `frontend/public/tooltips/*.json`（特に `scaling.json`）等の生成物は丸ごとReadせず、
  `python3 -c "..."` や `jq` で件数・統計だけ抽出する
- ビルド/型チェック/テストは `.claude/hooks/filter-verbose-output.sh` が自動でエラーのみに
  絞る（対象: `npm run build`, `tsc --noEmit`, `npm test` 等）。素通しにしたい時だけ
  明示的にパイプ/リダイレクトを付ける
- GitHub Actionsのログは `get_job_logs` を毎回全量取得せず、まず `list_workflow_jobs` の
  ステップ状況で完了/失敗を確認してから必要な時だけ取得する
- 大きめの探索・ファイル横断調査はAgentツール（サブエージェント）に投げ、
  結果の要約だけをメインの会話に持ち帰る

# Compact instructions
compactする際は、直近の技術的決定・コード変更点・未解決の課題を優先して残し、
試行錯誤の経過や確認済みの成功ログは要約で構わない
