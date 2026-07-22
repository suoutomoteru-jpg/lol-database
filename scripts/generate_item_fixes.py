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

# <stats>ブロック外の本文に現れる「壊れた0」（動的値の未解決）。
# Riotの静的エクスポートは動的計算値を0で出すため、ダメージ/回復/シールド/CDの
# 各文型を検出する。0.5秒 等の正当な数値を誤検出しないよう、0の直後が
# 「の◯◯ダメージ」「回復」「獲得」「秒)」等の限定文脈のときのみ壊れ判定する。
BROKEN_RE = re.compile(
    r"(を0[獲回]|が0回復|\(0秒\)|ダメージを0|0のダメージ|0の[^。<>]{0,10}?ダメージ|耐久値0|0のシールド|0を獲得)"
)
INCLUDE_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")
RUNTIME_COUNTER_RE = re.compile(r"@f\d+@")

# 数値を確定できない場合に、誤った「0」を残さず真実だが数値なしの文へ整える置換。
# （例: 「0の確定ダメージ」→「確定ダメージ」。0という誤情報を出すより無難）
NEUTRALIZE_SUBS = [
    (re.compile(r"0の([^。<>]{0,10}?ダメージ)"), r"\1"),
    (re.compile(r"ダメージを0与える"), "ダメージを与える"),
    (re.compile(r"耐久値0の(シールド)"), r"\1"),
    (re.compile(r"耐久値@[^@]+@の(シールド)"), r"\1"),
    (re.compile(r"を0獲得"), "を獲得"),
    (re.compile(r"を0を獲得"), "を獲得"),
    (re.compile(r"体力が0回復"), "体力が回復"),
    (re.compile(r"が0回復"), "が回復"),
]


def neutralize_broken_zero(desc: str) -> str:
    s = desc
    for pat, rep in NEUTRALIZE_SUBS:
        s = pat.sub(rep, s)
    return s


# テンプレートの「@Cooldown@ {{Item_Cooldown}}」展開で "90 (90秒)" のように
# 同じ数字が重複することがある。同値のときだけ先頭の裸の数字を畳んで "(90秒)" にする。
# （数字が異なる "5 (30秒)" 等は別々の意味なので残す）
REDUNDANT_CD_RE = re.compile(r"(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)秒\)")
DOUBLE_PAREN_CD_RE = re.compile(r"\(\((\d+(?:\.\d+)?秒)\)\)")


def collapse_redundant_cooldown(text: str) -> str:
    # 「90 (90秒)」→「(90秒)」（同値のみ）。裸の数字とinclude展開の重複を畳む
    s = REDUNDANT_CD_RE.sub(
        lambda m: f"({m.group(2)}秒)" if m.group(1) == m.group(2) else m.group(0),
        text,
    )
    # テンプレが「(@Cooldown@ {{Item_Cooldown}})」と外側括弧を持つと「((90秒))」に
    # なるため二重括弧も畳む
    s = DOUBLE_PAREN_CD_RE.sub(r"(\1)", s)
    return s


def body_without_stats(desc: str) -> str:
    return re.sub(r"<stats>[\s\S]*?</stats>", "", desc)


# ── 「数値なし効果文」の検出 ─────────────────────────────
# Riotの静的エクスポートは、0ではなく値ごと省略する壊れ方もする
# （例: 終わりなき飢え「体力を回復する」— いくら回復するのか書かれていない）。
# 効果を主張する語を含むのに数字が1つもない節をフラグする。
EFFECT_WORD_RE = re.compile(r"ダメージ|回復|シールド|増加|減少|獲得|吸収|軽減|移動速度|攻撃速度")
DIGIT_RE = re.compile(r"[0-9０-９]")


def numberless_effect_clauses(desc: str) -> list[str]:
    body = re.sub(r"<[^>]+>", "", body_without_stats(desc))
    body = re.sub(r"\{\{[^}]*\}\}", "", body)
    clauses = re.split(r"[。\n]", body)
    return [
        c.strip()
        for c in clauses
        if c.strip() and EFFECT_WORD_RE.search(c) and not DIGIT_RE.search(c)
    ]


def digit_count(desc: str) -> int:
    return len(DIGIT_RE.findall(re.sub(r"<[^>]+>", "", body_without_stats(desc))))


def fnv1a(s: str) -> str:
    """CDragonのハッシュキー（FNV-1a 32bit / 小文字）"""
    h = 0x811C9DC5
    for b in s.lower().encode():
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def build_bin_context(entry: dict) -> tuple[dict, dict]:
    """binエントリから 変数辞書 / 計算式辞書 を作る（max_rank=1相当）。

    binの一部は変数を {a99340ef} のようなハッシュで参照するため
    （例: 2520のmRangedMultiplier→RangeModifier）、名前に加えて
    FNV-1aハッシュ形式のエイリアスキーでも引けるようにする。
    """
    values: dict[str, list] = {}
    for dv in entry.get("mDataValues", []) or []:
        name = str(dv.get("mName", "")).lower()
        if name:
            values[name] = [float(dv.get("mValue", 0))]
            values[f"{{{fnv1a(name)}}}"] = values[name]
    calcs: dict[str, dict] = {}
    for k, v in (entry.get("mItemCalculations") or {}).items():
        if isinstance(v, dict):
            calcs[str(k).lower()] = v
            calcs[f"{{{fnv1a(str(k))}}}"] = v
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
    s = collapse_redundant_cooldown(s)  # "90 (90秒)" の重複を "(90秒)" に畳む
    s = re.sub(r"[ \t]+", " ", s)
    if gt.LEFTOVER_RE.search(s) or "{{" in s:
        return None  # 半端な解決結果は出荷しない
    if BROKEN_RE.search(body_without_stats(s)):
        return None
    return s.strip()


def fallback_repair(desc: str, entry: dict) -> str | None:
    """テンプレート再構築に失敗した場合の最小修復。
    (0秒)はbinのCD値で置換し、確定できないダメージ/回復/シールドの誤った0は
    数値を伏せた真実の文へ整える（0という誤情報は残さない）。"""
    s = desc
    if "(0秒)" in s:
        values, _ = build_bin_context(entry)
        cds = {v[0] for k, v in values.items() if "cooldown" in k and v[0] > 0}
        if len(cds) == 1:
            s = s.replace("(0秒)", f"({gt.fnum(cds.pop())}秒)")
        else:
            s = s.replace(" (0秒)", "").replace("(0秒)", "")
    s = neutralize_broken_zero(s)
    s = collapse_redundant_cooldown(s)  # "90(90秒)" 等の重複を畳む
    # まだ壊れた0が残る（想定外の文型）なら誤情報回避のため見送り
    if BROKEN_RE.search(body_without_stats(s)):
        return None
    return s if s != desc else None


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
        broken = bool(BROKEN_RE.search(body_without_stats(desc)))
        numberless = numberless_effect_clauses(desc)
        if not broken and not numberless:
            continue
        entry = bin_data.get(f"Items/{iid}") or {}

        fixed = render_from_template(iid, st, entry)
        if fixed is not None and fixed != desc:
            # 数値なし文が動機の場合は「数字が増えた」ときのみ採用（改悪防止）。
            # 壊れ0が動機なら従来どおり（0の除去自体が改善）
            if broken or digit_count(fixed) > digit_count(desc):
                fixes[iid] = fixed
                stats["template"] += 1
                why = "0壊れ" if broken else f"数値なし{len(numberless)}文"
                print(f"  template   {iid}\t{it.get('name', '')}\t({why})")
                continue

        patched = fallback_repair(desc, entry)
        if patched is not None and patched != desc:
            fixes[iid] = patched
            stats["fallback"] += 1
            print(f"  fallback   {iid}\t{it.get('name', '')}")
            continue

        if broken:
            stats["skipped"] += 1
            print(f"  skipped    {iid}\t{it.get('name', '')}")

    # ── 残存レポート: 修正適用後もなお数値なし効果文が残る正規アイテム ──
    print("\n===== 残存する数値なし効果文（修正適用後） =====")
    residual = 0
    for iid, it in sorted(items.items(), key=lambda x: int(x[0])):
        if int(iid) >= 100000:
            continue
        shown = fixes.get(iid, it.get("description", ""))
        clauses = numberless_effect_clauses(shown)
        if clauses:
            residual += 1
            sr = (it.get("maps") or {}).get("11")
            print(f"  {iid}\t{it.get('name', '')}\tSR={sr}")
            for c in clauses[:3]:
                print(f"      ・{c[:80]}")
    print(f"残存 {residual} アイテム")

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
