#!/usr/bin/env python3
"""アイテム説明文の欠落数値を修復する

DDragon / CDragon の静的エクスポートでは、動的計算されるアイテム数値
（ライフラインのCD・効果量など）が 0 や空欄のまま配信される
（例: プロトプラズム ハーネス「最大体力を0獲得」「(0秒)」）。

正しい値は stringtable のテンプレート（generatedtip_item_*_externaldescription、
@Var@ が未解決のまま残っている）と items.cdtb.bin の
mDataValues / mItemCalculations に存在するので、チャンピオンツールチップと
同じ機構（generate_tooltips の計算式評価器）で解決し、
frontend/public/tooltips/item-desc-fixes.json に修正済み説明文を出力する。

修復の優先順:
  1. テンプレート再構築（externaldescription + bin値）— 完全解決できた場合のみ採用
  2. フォールバック: DDragon説明文の「(0秒)」を bin の Cooldown 値で置換
  3. どちらも不可なら元の説明文のまま（fixesに含めない）
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import generate_tooltips as gt

DD = "https://ddragon.leagueoflegends.com"
CD = "https://raw.communitydragon.org/latest"
OUT_PATH = Path(__file__).resolve().parent.parent / "frontend/public/tooltips/item-desc-fixes.json"

# <stats>ブロック外の本文に現れる「壊れた0」（動的値の未解決）
BROKEN_RE = re.compile(r"(を0[獲回]|が0回復|\(0秒\)|ダメージを0|0のダメージ|耐久値0)")
INCLUDE_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")
RUNTIME_COUNTER_RE = re.compile(r"@f\d+@")


def body_without_stats(desc: str) -> str:
    return re.sub(r"<stats>[\s\S]*?</stats>", "", desc)


def build_bin_context(entry: dict) -> tuple[dict, dict]:
    """binエントリから 変数辞書 / 計算式辞書 を作る（max_rank=1相当）"""
    values: dict[str, list] = {}
    for dv in entry.get("mDataValues", []) or []:
        name = str(dv.get("mName", "")).lower()
        if name:
            values[name] = [float(dv.get("mValue", 0))]
    calcs = {
        str(k).lower(): v
        for k, v in (entry.get("mItemCalculations") or {}).items()
        if isinstance(v, dict)
    }
    return values, calcs


def expand_includes(text: str, st: dict[str, str], depth: int = 0) -> str:
    """{{ Item_Cooldown }} 形式の共有テンプレートを展開する"""
    if depth > 3:
        return text

    def repl(m: re.Match) -> str:
        body = st.get(m.group(1).lower())
        return expand_includes(body, st, depth + 1) if body is not None else ""

    return INCLUDE_RE.sub(repl, text)


def resolve_vars(text: str, values: dict, calcs: dict) -> str:
    """@Var@ / @Var*100@ を bin の値・計算式で解決する"""

    def repl(m: re.Match) -> str:
        name = m.group(1).lower()
        mult = float(m.group(2)) if m.group(2) else 1.0
        if name in values:
            return gt.fnum(values[name][0] * mult)
        if name in calcs:
            res = gt.eval_calculation(calcs[name], values, calcs, max_rank=1)
            rendered = gt.render_result(res, mult)
            if rendered is not None:
                return rendered
        return m.group(0)  # 未解決のまま残し、後段のLEFTOVERチェックで弾く

    return gt.PLACEHOLDER_RE.sub(repl, text)


def render_from_template(iid: str, st: dict[str, str], entry: dict) -> str | None:
    template = st.get(f"generatedtip_item_{iid}_externaldescription")
    if not template:
        return None
    values, calcs = build_bin_context(entry)
    s = expand_includes(template, st)
    s = resolve_vars(s, values, calcs)
    s = RUNTIME_COUNTER_RE.sub("", s)  # @f1@ 等の実行時カウンタは表示不能なので除去
    s = gt.ICON_RE.sub("", s)          # %i:scaleHealth% 等のアイコン参照
    s = re.sub(r"[ \t]+", " ", s)
    if gt.LEFTOVER_RE.search(s) or "{{" in s:
        return None  # 半端な解決結果は出荷しない
    if BROKEN_RE.search(body_without_stats(s)):
        return None
    return s.strip()


def fallback_cooldown_patch(desc: str, entry: dict) -> str | None:
    """テンプレート再構築に失敗した場合: (0秒) だけでも直す"""
    if "(0秒)" not in desc:
        return None
    values, _ = build_bin_context(entry)
    cds = {v[0] for k, v in values.items() if "cooldown" in k and v[0] > 0}
    if len(cds) == 1:
        return desc.replace("(0秒)", f"({gt.fnum(cds.pop())}秒)")
    # CDが特定できない場合は、英語版と同様に表記自体を落とす（誤情報よりも省略）
    return desc.replace(" (0秒)", "").replace("(0秒)", "")


def main() -> int:
    version = gt.get_json(f"{DD}/api/versions.json")[0]
    items = gt.get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]
    st = gt.load_stringtable()
    if not st:
        print("stringtable が取得できないため中止")
        return 1
    bin_data = gt.get_json(f"{CD}/game/items.cdtb.bin.json")

    fixes: dict[str, str] = {}
    stats = {"template": 0, "fallback": 0, "skipped": 0}

    for iid, it in sorted(items.items(), key=lambda x: int(x[0])):
        if int(iid) >= 100000:
            continue  # モード用の複製ID（フロントは正規IDのみ表示）
        desc = it.get("description", "")
        if not BROKEN_RE.search(body_without_stats(desc)):
            continue
        entry = bin_data.get(f"Items/{iid}") or {}

        fixed = render_from_template(iid, st, entry)
        if fixed is not None and fixed != desc:
            fixes[iid] = fixed
            stats["template"] += 1
            print(f"  template   {iid}\t{it.get('name', '')}")
            continue

        patched = fallback_cooldown_patch(desc, entry)
        if patched is not None and patched != desc:
            fixes[iid] = patched
            stats["fallback"] += 1
            print(f"  fallback   {iid}\t{it.get('name', '')}")
            continue

        stats["skipped"] += 1
        print(f"  skipped    {iid}\t{it.get('name', '')}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps({"version": version, "fixes": fixes}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(
        f"\n{OUT_PATH.name}: {len(fixes)}件 "
        f"(テンプレート再構築 {stats['template']} / CDのみ修正 {stats['fallback']} / 見送り {stats['skipped']})"
    )

    # 動作確認: プロトプラズム ハーネス
    if "2525" in fixes:
        print("\n=== 2525 プロトプラズム ハーネス（修正後）===")
        print(fixes["2525"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
