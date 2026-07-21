# プロジェクトメモ

## 開発ルール（ユーザー指定）

- **UI・デザインの改修案は、実装前に必ずモックまたはイメージ画像を作成して提示し、ユーザーの確認を取ってから実装すること。** 確認なしで見た目の変更をデプロイしない。

## プロジェクト概要

- 日本人LoLプレイヤー向けデータベース「nunune.gg」。タグライン:「はやくて見やすい、LoLのデータベース。」
- 実体は `frontend/`（Vite + React + TypeScript の静的SPA）。ルート直下のPythonファイル群は無関係の旧学習用ツール
- デプロイ: Cloudflare Workers（プロジェクト名 `lol-database-3`、`frontend/wrangler.jsonc`）。mainへのpushで自動デプロイ
- データソース: Riot DDragon（ja_JP）+ CommunityDragon。ツールチップはGitHub Actionsで事前生成し `frontend/public/tooltips/` に静的配置
- お問い合わせ/バグ報告: Googleフォーム（URLは `frontend/src/app/components/ReportLink.tsx` で一元管理）
