#!/bin/bash
# Readツールが巨大ファイルを丸ごと読み込むのを防ぐ。
# - 通常の大きいテキスト: limit を自動で付けて先頭だけに絞る
# - 1行が極端に長いファイル(生成JSON/minified等): limit が効かないので拒否し、
#   jq / python3 での抽出に誘導する
# 個別の既知ファイルは settings.json の permissions.deny でも塞いでいるが、
# こちらは「これから増える生成物」にも効く汎用ガード。
input=$(cat)

read -r path lim off <<<"$(echo "$input" | jq -r '[.tool_input.file_path // "", (.tool_input.limit // "-"), (.tool_input.offset // "-")] | @tsv')"

# 範囲指定済み / パス不明 / 実ファイルでない場合は素通し
if [[ -z "$path" || ! -f "$path" || "$lim" != "-" || "$off" != "-" ]]; then
  echo '{}'
  exit 0
fi

bytes=$(wc -c <"$path" 2>/dev/null || echo 0)
THRESHOLD=80000
if (( bytes <= THRESHOLD )); then
  echo '{}'
  exit 0
fi

lines=$(wc -l <"$path" 2>/dev/null || echo 0)

# 行数が少ない＝1行あたりが巨大。limit を付けても削減にならないので読ませない。
if (( lines < 50 )); then
  reason="${path} は約$((bytes / 1024))KBで実質1行の生成物です。丸ごとReadするとコンテキストを大量消費します。jq や python3 -c で必要な項目・件数だけ抽出してください。"
  jq -n --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
fi

# 大きいテキストファイルは先頭400行に制限（続きは offset 指定で読める）
updated=$(echo "$input" | jq -c '.tool_input + {limit: 400}')
jq -n --argjson u "$updated" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput:$u}}'
