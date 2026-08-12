#!/bin/bash
# Bashコマンド実行前に、冗長なコマンドの出力をエラー/要約のみに絞る。
# 目的: `npm run build` や `npm install` の全量ログを毎回コンテキストに
# 流し込まず、必要な行だけを残してトークン消費を抑える。
# 参照: https://code.claude.com/docs/en/costs#offload-processing-to-hooks-and-skills
#
# 重要: 加工後も元コマンドの終了コードを必ず保つこと。
#   `cmd | grep` 形式にすると grep の終了コードで上書きされ、
#   「テスト全通過なのに失敗扱い」「py_compile失敗が成功扱い」になる。
#   そのため一旦ファイルに落としてから `exit $ec` する形に統一している。
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

if [[ -z "$cmd" ]]; then
  echo '{}'
  exit 0
fi

# 既にパイプ/リダイレクトで加工済みのコマンドはそのまま通す（二重加工を避ける）
if [[ "$cmd" == *"|"* || "$cmd" == *">"* ]]; then
  echo '{}'
  exit 0
fi

# $ok / $ng は「成功時 / 失敗時に何を残すか」のシェル片。
# 実行時に評価させたいので、変数展開は \ でエスケープする。
wrap() {
  local ok="$1" ng="$2"
  printf '%s' "log=\$(mktemp /tmp/.cc-hook-XXXXXX); { $cmd; } >\"\$log\" 2>&1; ec=\$?; \
if [ \$ec -eq 0 ]; then $ok; else $ng; fi; rm -f \"\$log\"; exit \$ec"
}

filtered=""
case "$cmd" in
  # --- ビルド / 型チェック: 成功時はサマリだけ、失敗時はエラー周辺だけ ---
  *"npm run build"*|*"npm run typecheck"*|*"tsc --noEmit"*|*"tsc -p"*|*"vite build"*)
    filtered=$(wrap \
      'tail -n 5 "$log"' \
      'grep -B1 -A6 -iE "error|Error TS|✗" "$log" | head -150')
    ;;
  # --- テスト: 成功時は末尾サマリ、失敗時は失敗ケース周辺 ---
  *"npm test"*|*"npm run test"*|*"vitest run"*|*"pytest"*|*"go test"*)
    filtered=$(wrap \
      'tail -n 15 "$log"' \
      'grep -A8 -iE "(FAIL|ERROR|error:|✗|AssertionError)" "$log" | head -150')
    ;;
  # --- Lint: 成功時は無出力、失敗時は指摘のみ ---
  *"npm run lint"*|*"eslint"*|*"ruff "*)
    filtered=$(wrap \
      'echo "lint OK"' \
      'head -100 "$log"')
    ;;
  # --- 依存インストール: 成功ログは丸ごと不要 ---
  *"npm install"*|*"npm ci"*|*"npm i "*|*"pip install"*|*"pip3 install"*)
    filtered=$(wrap \
      'tail -n 3 "$log"' \
      'tail -n 60 "$log"')
    ;;
  # --- デプロイ ---
  *"wrangler deploy"*|*"npm run deploy"*)
    filtered=$(wrap \
      'tail -n 8 "$log"' \
      'tail -n 60 "$log"')
    ;;
  # --- データ生成スクリプト: 進捗ログが長大になりがち ---
  *"python3 scripts/"*|*"python scripts/"*)
    filtered=$(wrap \
      'tail -n 20 "$log"' \
      'tail -n 60 "$log"')
    ;;
  *"py_compile"*)
    filtered=$(wrap \
      'echo "py_compile OK"' \
      'head -60 "$log"')
    ;;
  # --- git log: 無指定だと全履歴が流れ込む ---
  *"git log"*)
    filtered=$(wrap \
      'head -60 "$log"' \
      'head -20 "$log"')
    ;;
esac

if [[ -n "$filtered" ]]; then
  json_cmd=$(jq -n --arg c "$filtered" '$c')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":${json_cmd}}}}"
else
  echo '{}'
fi
