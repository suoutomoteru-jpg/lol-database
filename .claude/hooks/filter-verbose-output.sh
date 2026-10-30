#!/bin/bash
# Bashコマンド実行前に、ビルド/型チェック/テストの出力をエラーのみに絞る。
# 目的: `npm run build` や `tsc --noEmit` の全量ログを毎回コンテキストに
# 流し込まず、失敗時の必要な行だけを残してトークン消費を抑える。
# 参照: https://code.claude.com/docs/en/costs#offload-processing-to-hooks-and-skills
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

filtered=""
case "$cmd" in
  *"npm run build"*|*"npm run typecheck"*|*"tsc --noEmit"*|*"tsc -p"*)
    # 成功時は最終行(ビルドサマリ)だけ、失敗時はエラー行とその前後を残す。
    # tee は標準出力にも流れてしまい抑制にならないため、ファイルへの
    # リダイレクトのみで一旦キャプチャしてから必要な部分だけ出す
    filtered="$cmd >/tmp/.hook-build-out.log 2>&1; ec=\$?; \
if [ \$ec -eq 0 ]; then tail -n 5 /tmp/.hook-build-out.log; else \
grep -B1 -A6 -iE 'error|Error TS|✗' /tmp/.hook-build-out.log | head -150; fi; \
rm -f /tmp/.hook-build-out.log; exit \$ec"
    ;;
  *"npm test"*|*"pytest"*|*"go test"*|"npm run test"*)
    filtered="$cmd 2>&1 | grep -A 8 -iE '(FAIL|ERROR|error:|✗)' | head -150"
    ;;
  *"py_compile"*)
    filtered="$cmd 2>&1 | head -60"
    ;;
esac

if [[ -n "$filtered" ]]; then
  json_cmd=$(jq -n --arg c "$filtered" '$c')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":${json_cmd}}}}"
else
  echo '{}'
fi
