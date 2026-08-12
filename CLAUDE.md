# プロジェクトメモ

## プロジェクト概要

- 日本人LoLプレイヤー向けデータベース「nunune.gg」。タグライン:「はやくて見やすい、LoLのデータベース。」
- 実体は `frontend/`（Vite + React + TypeScript の静的SPA）。ルート直下のPythonファイル群は無関係の旧学習用ツール
- デプロイ: Cloudflare Workers（プロジェクト名 `lol-database-3`、`frontend/wrangler.jsonc`）。mainへのpushで自動デプロイ
- データソース: Riot DDragon（ja_JP）+ CommunityDragon。ツールチップはGitHub Actionsで事前生成し `frontend/public/tooltips/` に静的配置
- お問い合わせ/バグ報告: Googleフォーム（URLは `frontend/src/app/components/ReportLink.tsx` で一元管理）

## コンテキスト消費を抑える

`.claude/settings.json` で以下を自動化済み。仕組みを壊さないこと。

- **冗長コマンドの出力圧縮**: `.claude/hooks/filter-verbose-output.sh`（PreToolUse/Bash）が
  build・typecheck・test・lint・npm install・wrangler deploy・`python3 scripts/*.py`・
  `git log` を、成功時はサマリ数行 / 失敗時はエラー周辺のみに絞る。
  素通しにしたい時だけ明示的にパイプ/リダイレクトを付ける（付いていれば二重加工しない）。
  加工後も**元コマンドの終了コードを必ず保つ**こと（`cmd | head` 形式は終了コードが
  常に0になり失敗を握り潰すため禁止）
- **巨大ファイルReadのガード**: `.claude/hooks/guard-large-read.sh`（PreToolUse/Read）が
  80KB超のファイルに自動で `limit` を付ける。実質1行の生成物はRead自体を拒否するので、
  `jq` や `python3 -c "..."` で件数・統計だけ抽出する
- **既知の巨大生成物はRead禁止**: `permissions.deny` で `package-lock.json` /
  `tooltips/{scaling,index,item-desc-fixes}.json` / `sitemap.xml` / `dist` / `node_modules` を遮断
- **MCP出力の上限**: `env.MAX_MCP_OUTPUT_TOKENS=10000`。GitHub Actionsのログは
  `get_job_logs` を毎回全量取得せず、まず `list_workflow_jobs` のステップ状況を見る
- **スキル一覧の圧縮**: `skillListingMaxDescChars` と `skillOverrides` で、このリポジトリに
  無関係なスキル（naming, xlsx, pptx, claude-api 等）を毎ターンの一覧から外している。
  必要になったら `/naming` のようにスラッシュコマンドで直接呼べば使える
- 大きめの探索・ファイル横断調査はAgentツール（サブエージェント）に投げ、
  結果の要約だけをメインの会話に持ち帰る

さらに削りたい場合の追加候補（品質とのトレードオフがあるため未設定）:
`effortLevel: "medium"`（thinkingトークン削減）、`autoCompactWindow`（早めに圧縮）、
`includeGitInstructions: false`。使用量は `/context` と `/cost` で確認できる。

# Compact instructions
compactする際は、直近の技術的決定・コード変更点・未解決の課題を優先して残し、
試行錯誤の経過や確認済みの成功ログは要約で構わない
