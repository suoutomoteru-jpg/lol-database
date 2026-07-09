#!/usr/bin/env python3
"""
全チャンピオンの詳細ツールチップ JSON 生成スクリプト

CommunityDragon の本番パッチデータから、チャンピオン毎に:
  - LCU 日本語データ（スキル名・説明文テンプレート）
  - ゲーム bin データ（ランク毎数値・計算式・CD・コスト）
を取得し、説明文中の @変数@ プレースホルダーを実数値に解決した
静的 JSON を出力する。フロントエンドはこの JSON を読むだけでよい。

実行方法:
    python3 scripts/generate_tooltips.py --out frontend/public/tooltips
    python3 scripts/generate_tooltips.py --only Urgot,Ahri --out /tmp/test

既知の制限（残課題）:
  - パッシブおよびレベル比例値の ByCharLevelBreakpoints 展開は未実装
    （起点値のみ「X〜（レベルに応じて変化）」と表示）
  - 変身系チャンピオン（Jayce 等）は第1形態のスキルセットのみ対象

依存: 標準ライブラリのみ
"""

import argparse
import datetime
import json
import re
import sys
import time
import urllib.request

BASE = "https://raw.communitydragon.org/latest"
UA = {"User-Agent": "lol-database-tooltip-generator/1.0"}

# ── HTTP ──────────────────────────────────────────────


def get_json(url: str, timeout: int = 120, retries: int = 2):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.load(res)
        except Exception as e:  # noqa: BLE001 - リトライ後に再送出する
            last = e
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    raise last


# ── 数値フォーマット ──────────────────────────────────


def fnum(v) -> str:
    """0.23499999 → '23.5' のような浮動小数の丸め表示"""
    r = round(float(v), 3)
    if r == int(r):
        return str(int(r))
    return f"{r:g}"


def fmt_values(vals: list, mult: float = 1.0) -> str:
    """ランク毎数値リストを '25/70/115' 形式に（全ランク同値なら単一値に畳む）

    bin データには稀に文字列やネスト配列が混ざるため、数値化できない
    要素はそのまま文字列として出力する。
    """
    out = []
    for v in vals:
        try:
            out.append(fnum(float(v) * mult))
        except (TypeError, ValueError):
            out.append(str(v))
    if not out:
        return ""
    return out[0] if len(set(out)) == 1 else "/".join(out)


FRACTION_RE = re.compile(r"^-?0?\.\d+(?:/-?0?\.\d+)*$")


def maybe_percentify(rendered: str, following: str) -> str:
    """0.4 のような割合値を 40% 表記に直す。

    LCU の説明文が *100 の乗数を持たないまま割合値を参照するケース
    （例: ロックの W の移動速度）への対応。直後が「秒」なら時間、
    「%」なら既にパーセント値とみなして変換しない。
    """
    if not FRACTION_RE.fullmatch(rendered):
        return rendered
    nxt = following.lstrip()[:1]
    if nxt in ("秒", "%", "％"):
        return rendered
    return "/".join(fnum(float(p) * 100) for p in rendered.split("/")) + "%"


def slice_ranks(arr: list, max_rank: int) -> list:
    """bin の数値配列からランク 1..max_rank の値を取り出す。

    7要素配列はインデックス1..max_rank（0はレベル0のプレースホルダー）、
    6要素以下の配列はインデックス0..max_rank-1 がランクに対応する。
    """
    if not arr:
        return []
    if len(arr) >= 7:
        return arr[1 : 1 + max_rank]
    return arr[:max_rank]


# ── 計算式 (mSpellCalculations) の解決 ─────────────────
#
# 各パートを ("nums", [ランク毎数値]) または ("text", "表示文字列") に
# 評価し、数値パート同士は合算、テキストパート（スタット反映分）は
# 「（＋増加攻撃力の135%）」のように後置する。

STAT_NAMES = {
    0: "魔力", 1: "物理防御", 2: "攻撃力", 3: "攻撃速度", 5: "魔法防御",
    6: "移動速度", 7: "クリティカル率", 11: "最大体力", 12: "体力",
}
FORMULA_NAMES = {0: "合計", 1: "基礎", 2: "増加"}


def stat_label(stat: int, formula: int) -> str | None:
    name = STAT_NAMES.get(stat)
    if name is None:
        return None  # 未知のスタット参照は呼び出し側で計算式ごと除外する
    prefix = FORMULA_NAMES.get(formula, "")
    if stat == 0:
        return name  # 魔力は「合計魔力」と言わない
    return f"{prefix}{name}"


def eval_part(part, values: dict, max_rank: int):
    """計算式パートを ('nums', [..]) / ('text', str) / None に評価する"""
    if isinstance(part, (int, float)):
        return ("nums", [float(part)] * max_rank)
    if not isinstance(part, dict):
        return None
    t = part.get("__type", "")

    if t == "NumberCalculationPart":
        return ("nums", [float(part.get("mNumber", 0))] * max_rank)

    if t == "NamedDataValueCalculationPart":
        name = str(part.get("mDataValue", "")).lower()
        if name in values:
            return ("nums", values[name])
        return None

    if t == "EffectValueCalculationPart":
        name = f"effect{part.get('mEffectIndex')}amount"
        if name in values:
            return ("nums", values[name])
        return None

    if t == "StatByCoefficientCalculationPart":
        coeff = float(part.get("mCoefficient", 1))
        label = stat_label(part.get("mStat", 0), part.get("mStatFormula", 0))
        if label is None:
            return None
        return ("text", f"{label}の{fnum(coeff * 100)}%")

    if t == "StatByNamedDataValueCalculationPart":
        name = str(part.get("mDataValue", "")).lower()
        label = stat_label(part.get("mStat", 0), part.get("mStatFormula", 0))
        if label is not None and name in values:
            return ("text", f"{label}の{fmt_values(values[name], 100)}%")
        return None

    if t == "StatBySubPartCalculationPart":
        sub = eval_part(part.get("mSubpart"), values, max_rank)
        label = stat_label(part.get("mStat", 0), part.get("mStatFormula", 0))
        if label is None or sub is None:
            return None
        if sub[0] == "nums":
            return ("text", f"{label}の{fmt_values(sub[1], 100)}%")
        if sub[0] == "bpnum":
            return ("text", f"{label}の{fnum(sub[1] * 100)}%〜（レベルに応じて増加）")
        return None

    if t == "AbilityResourceByCoefficientCalculationPart":
        coeff = float(part.get("mCoefficient", 1))
        return ("text", f"最大マナの{fnum(coeff * 100)}%")

    if t == "ByCharLevelInterpolationCalculationPart":
        s, e = part.get("mStartValue", 0), part.get("mEndValue", 0)
        return ("text", f"{fnum(s)}〜{fnum(e)}（レベル比例）")

    if t == "ByCharLevelBreakpointsCalculationPart":
        # 残課題: ブレークポイント展開は未実装（起点値のみ保持し、表示側で整形）
        return ("bpnum", float(part.get("mLevel1Value", 0)))

    if t == "SumOfSubPartsCalculationPart":
        parts = [eval_part(p, values, max_rank) for p in part.get("mSubparts", [])]
        return combine_parts(parts, max_rank)

    if t == "ProductOfSubPartsCalculationPart":
        p1 = eval_part(part.get("mPart1"), values, max_rank)
        p2 = eval_part(part.get("mPart2"), values, max_rank)
        if p1 and p2 and p1[0] == "nums" and p2[0] == "nums":
            return ("nums", [a * b for a, b in zip(p1[1], p2[1])])
        if p1 and p2:
            a = p1[1] if p1[0] == "text" else fmt_values(p1[1])
            b = p2[1] if p2[0] == "text" else fmt_values(p2[1])
            return ("text", f"{a}×{b}")
        return None

    return None


def combine_parts(parts: list, max_rank: int):
    # 単独のレベル比例値はそのまま返す（呼び出し側で%等に整形できるように）
    if len(parts) == 1 and parts[0] is not None and parts[0][0] == "bpnum":
        return parts[0]

    nums = None
    texts = []

    def add_nums(vals: list):
        nonlocal nums
        nums = list(vals) if nums is None else [a + b for a, b in zip(nums, vals)]

    for p in parts:
        if p is None:
            return None
        if p[0] == "nums":
            add_nums(p[1])
        elif p[0] == "combo":  # ネストした部分和（数値＋スケーリング）を統合
            sub_nums, sub_texts = p[1]
            add_nums(sub_nums)
            texts.extend(sub_texts)
        elif p[0] == "bpnum":
            texts.append(f"{fnum(p[1])}〜（レベルに応じて変化）")
        else:
            texts.append(p[1])
    if nums is not None and texts:
        return ("combo", (nums, texts))
    if nums is not None:
        return ("nums", nums)
    if texts:
        return ("text", " ＋ ".join(texts))
    return None


def render_result(res, mult: float = 1.0) -> str | None:
    if res is None:
        return None
    kind, val = res
    if kind == "bpnum":
        return f"{fnum(val * mult)}〜（レベルに応じて変化）"
    if kind == "nums":
        return fmt_values(val, mult)
    if kind == "text":
        return val if mult == 1.0 else f"{val}×{fnum(mult)}"
    if kind == "combo":
        nums, texts = val
        scaling = " ".join(f"＋{t}" for t in texts)
        return f"{fmt_values(nums, mult)}（{scaling}）"
    return None


def eval_calculation(calc, values: dict, calcs: dict, max_rank: int, depth: int = 0):
    """GameCalculation / GameCalculationModified を評価する"""
    if not isinstance(calc, dict) or depth > 3:
        return None
    t = calc.get("__type", "")
    if t == "GameCalculation":
        parts = [eval_part(p, values, max_rank) for p in calc.get("mFormulaParts", [])]
        res = combine_parts(parts, max_rank)
        mult = calc.get("mMultiplier")
        if res and mult is not None:
            m = eval_part(mult, values, max_rank)
            if m and m[0] == "nums" and res[0] in ("nums",):
                res = ("nums", [a * b for a, b in zip(res[1], m[1])])
            elif m and m[0] == "nums" and res[0] == "combo":
                nums, texts = res[1]
                res = ("combo", ([a * b for a, b in zip(nums, m[1])], texts))
        if res and calc.get("mDisplayAsPercent"):
            if res[0] == "nums":
                return ("text", fmt_values(res[1], 100) + "%")
            if res[0] == "bpnum":
                return ("text", f"{fnum(res[1] * 100)}%〜（レベルに応じて変化）")
        return res
    if t == "GameCalculationModified":
        ref_name = str(calc.get("mModifiedGameCalculation", "")).lower()
        ref = calcs.get(ref_name)
        base = (
            eval_calculation(ref, values, calcs, max_rank, depth + 1) if ref else None
        )
        m = eval_part(calc.get("mMultiplier"), values, max_rank)
        if base and m and m[0] == "nums":
            if base[0] == "nums":
                return ("nums", [a * b for a, b in zip(base[1], m[1])])
            if base[0] == "combo":
                nums, texts = base[1]
                return ("combo", ([a * b for a, b in zip(nums, m[1])], texts))
        return base
    return None


# ── bin データからのスキル情報抽出 ─────────────────────


def as_numbers(vals: list) -> list | None:
    """リストを数値のみの list に変換する（数値化できない要素があれば None）"""
    out = []
    for v in vals:
        try:
            out.append(float(v))
        except (TypeError, ValueError):
            return None
    return out


def collect_data_values(spell: dict, max_rank: int) -> dict:
    """mSpell 直下の DataValues を {小文字名: ランク毎数値} で返す"""
    out = {}
    for key in ("mDataValues", "DataValues"):
        for dv in spell.get(key) or []:
            if not isinstance(dv, dict):
                continue
            name = dv.get("mName") or dv.get("name")
            vals = dv.get("mValues") or dv.get("values")
            nums = as_numbers(vals) if isinstance(vals, list) else None
            if isinstance(name, str) and nums:
                out[name.lower()] = slice_ranks(nums, max_rank)
    # Effect{N}Amount 形式（旧式スキル）。@eN@ / @fN@ の別名でも参照される
    for i, eff in enumerate(spell.get("mEffectAmount") or []):
        vals = eff.get("value") if isinstance(eff, dict) else None
        nums = as_numbers(vals) if isinstance(vals, list) else None
        if nums:
            sliced = slice_ranks(nums, max_rank)
            out[f"effect{i + 1}amount"] = sliced
            out.setdefault(f"e{i + 1}", sliced)
            out.setdefault(f"f{i + 1}", sliced)
    # チャージ（アンモ）式スキルのリチャージ時間・最大チャージ数
    ammo = spell.get("mAmmo") or spell.get("ammo") or {}
    if isinstance(ammo, dict):
        for akey, aval in ammo.items():
            nums = as_numbers(aval) if isinstance(aval, list) else None
            if nums:
                # bin の "mAmmoRechargeTime" 形式は先頭の m を1文字だけ除去
                norm = akey[1:] if len(akey) > 1 and akey[0] == "m" and akey[1].isupper() else akey
                out.setdefault(norm.lower(), slice_ranks(nums, max_rank))
    return out


def find_character_spells(bin_data: dict) -> tuple[list, str | None]:
    """CharacterRecords/Root から QWER スペル名とパッシブ参照を得る"""
    for path, entry in bin_data.items():
        if not isinstance(entry, dict):
            continue
        if "/characterrecords/root" not in path.lower():
            continue
        names = entry.get("spellNames") or entry.get("mSpellNames") or []
        passive = entry.get("mCharacterPassiveSpell")
        return [str(n).split("/")[-1] for n in names], (
            str(passive).split("/")[-1] if passive else None
        )
    return [], None


def find_spell_entry(bin_data: dict, script_name: str) -> dict | None:
    """スクリプト名（例 UrgotQ）に一致する mSpell 持ちエントリを探す"""
    if not script_name:
        return None
    target = script_name.lower()
    for path, entry in bin_data.items():
        if not isinstance(entry, dict) or "mSpell" not in entry:
            continue
        if path.lower().split("/")[-1] == target:
            return entry["mSpell"]
    return None


# ── パッシブの詳細数値 ──────────────────────────────────
#
# パッシブの説明文にはプレースホルダーが存在しないため、bin の計算式
# （mSpellCalculations）を「詳細数値」リストとして説明文に追記する。

PASSIVE_LABELS: list[tuple[str, str]] = [
    ("percenthp", "最大体力比"), ("percenthealth", "最大体力比"), ("hpratio", "最大体力比"),
    ("totaldamage", "合計ダメージ"),
    ("addamage", "ダメージ（攻撃力反映）"), ("apdamage", "ダメージ（魔力反映）"),
    ("damage", "ダメージ"),
    ("perlegcd", "クールダウン（部位毎）"), ("cooldown", "クールダウン"), ("cd", "クールダウン"),
    ("monstercap", "モンスターへの上限"), ("cap", "上限"),
    ("duration", "効果時間"),
    ("heal", "回復"), ("shield", "シールド"),
    ("triggerrange", "発動範囲"), ("castrange", "射程"), ("range", "範囲"),
    ("slowresist", "スロウ耐性"), ("slow", "スロウ"), ("stun", "スタン"),
    ("movespeed", "移動速度"), ("ms", "移動速度"),
    ("attackspeed", "攻撃速度"), ("armor", "物理防御"), ("mana", "マナ"),
]


def passive_label(name: str) -> str:
    low = name.lower()
    for key, label in PASSIVE_LABELS:
        if key in low:
            return label
    return name


def build_passive_details(spell: dict) -> list[str]:
    """パッシブスペルの計算式を「ラベル: 値」の行に整形する"""
    values = collect_data_values(spell, max_rank=1)
    calcs = {k.lower(): v for k, v in (spell.get("mSpellCalculations") or {}).items()}
    lines: list[str] = []
    for cname, calc in (spell.get("mSpellCalculations") or {}).items():
        if cname.lower() in ("rangecheck",):
            continue
        res = eval_calculation(calcs[cname.lower()], values, calcs, max_rank=1)
        # percent/ratio 系の名前を持つ割合値は%表記に
        if (
            res is not None and res[0] == "bpnum"
            and re.search(r"percent|ratio", cname, re.I) and abs(res[1]) < 1
        ):
            rendered: str | None = f"{fnum(res[1] * 100)}%〜（レベルに応じて増加）"
        else:
            rendered = render_result(res)
            if rendered is not None:
                rendered = maybe_percentify(rendered, "")
        if not rendered:
            continue
        lines.append(f"{passive_label(cname)}: {rendered}")
    return lines


# ── プレースホルダー解決 ────────────────────────────────

PLACEHOLDER_RE = re.compile(r"@([A-Za-z][\w.]*)(?:\*(\d+(?:\.\d+)?))?@")
ICON_RE = re.compile(r"%i:[^%]+%")


def resolve_description(
    text: str,
    values: dict,
    calcs: dict,
    global_values: dict,
    global_calcs: dict,
    max_rank: int,
    cd_str: str,
    cost_str: str,
) -> tuple[str, list]:
    unresolved = []

    def repl(m: re.Match) -> str:
        raw, mult_s = m.group(1), m.group(2)
        name = raw.lower().split(".")[0]
        mult = float(mult_s) if mult_s else 1.0

        if name == "spellmodifierdescriptionappend":
            return ""
        if name == "abilityresourcename":
            return "マナ"
        if name == "cooldown":
            return cd_str
        if name == "cost":
            return cost_str

        def finish(rendered: str) -> str:
            # 乗数なしで参照された割合値（0.4等）は%表記に直す
            if mult == 1.0:
                return maybe_percentify(rendered, m.string[m.end():])
            return rendered

        for calc_map, val_map in (
            (calcs, values),
            (global_calcs, global_values),
        ):
            if name in calc_map:
                res = eval_calculation(calc_map[name], val_map, calc_map, max_rank)
                rendered = render_result(res, mult)
                if rendered is not None:
                    return finish(rendered)
            if name in val_map:
                return finish(fmt_values(val_map[name], mult))

        unresolved.append(raw)
        return ""

    out = PLACEHOLDER_RE.sub(repl, text)
    out = ICON_RE.sub("", out)
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out.strip(), unresolved


# ── チャンピオン単位の生成 ──────────────────────────────


def generate_champion(champ: dict, patch: str) -> dict:
    alias = champ["alias"]
    cid = champ["id"]
    folder = alias.lower()

    lcu = get_json(
        f"{BASE}/plugins/rcp-be-lol-game-data/global/ja_jp/v1/champions/{cid}.json"
    )
    bin_data = get_json(f"{BASE}/game/data/characters/{folder}/{folder}.bin.json")

    spell_names, passive_ref = find_character_spells(bin_data)

    # 全スキルの値/計算式を集約（他スキル参照のフォールバック用）
    per_spell: dict[str, tuple[dict, dict]] = {}
    global_values: dict = {}
    global_calcs: dict = {}
    for key_idx, key in enumerate(("q", "w", "e", "r")):
        script = spell_names[key_idx] if key_idx < len(spell_names) else f"{alias}{key.upper()}"
        spell = find_spell_entry(bin_data, script) or find_spell_entry(
            bin_data, f"{alias}{key.upper()}"
        )
        if spell is None:
            per_spell[key] = ({}, {})
            continue
        lcu_spell = next(
            (s for s in lcu.get("spells", []) if s.get("spellKey") == key), {}
        )
        max_rank = int(lcu_spell.get("maxLevel") or (3 if key == "r" else 5))
        values = collect_data_values(spell, max_rank)
        calcs = {
            k.lower(): v for k, v in (spell.get("mSpellCalculations") or {}).items()
        }
        cd = slice_ranks(spell.get("cooldownTime") or [], max_rank)
        cost = slice_ranks(spell.get("mana") or [], max_rank)
        per_spell[key] = (values, calcs)
        per_spell[f"{key}:meta"] = (cd, cost)  # type: ignore[assignment]
        for d, g in ((values, global_values), (calcs, global_calcs)):
            for k, v in d.items():
                g.setdefault(k, v)

    skills: dict = {}
    total_unresolved: list[str] = []

    passive = lcu.get("passive", {})
    passive_desc, passive_unresolved = resolve_description(
        passive.get("description", ""),
        {}, {}, global_values, global_calcs,
        max_rank=1, cd_str="", cost_str="",
    )
    # 説明文に数値がないため、bin の計算式から「詳細数値」を追記する
    passive_spell = (
        find_spell_entry(bin_data, passive_ref or "")
        or find_spell_entry(bin_data, f"{alias}passive")
        or find_spell_entry(bin_data, f"{alias}p")
    )
    if passive_spell:
        detail_lines = build_passive_details(passive_spell)
        if detail_lines:
            passive_desc += (
                "<br><br><strong>詳細数値</strong>"
                + "".join(f"<br>・{line}" for line in detail_lines)
            )

    skills["passive"] = {
        "name": passive.get("name", ""),
        "description": passive_desc,
        "unresolved": passive_unresolved,
    }
    total_unresolved.extend(f"P:{u}" for u in passive_unresolved)

    for key in ("q", "w", "e", "r"):
        lcu_spell = next(
            (s for s in lcu.get("spells", []) if s.get("spellKey") == key), {}
        )
        max_rank = int(lcu_spell.get("maxLevel") or (3 if key == "r" else 5))
        values, calcs = per_spell.get(key, ({}, {}))
        cd, cost = per_spell.get(f"{key}:meta", ([], []))  # type: ignore[misc]
        cd_str = fmt_values(cd) if cd else ""
        cost_str = fmt_values(cost) if cost else ""

        desc, unresolved = resolve_description(
            lcu_spell.get("dynamicDescription") or lcu_spell.get("description") or "",
            values,
            calcs,
            global_values,
            global_calcs,
            max_rank,
            cd_str,
            cost_str,
        )
        total_unresolved.extend(f"{key.upper()}:{u}" for u in unresolved)

        rng = lcu_spell.get("range") or []
        skills[key] = {
            "name": lcu_spell.get("name", ""),
            "description": desc,
            "cooldown": cd_str,
            "cost": cost_str,
            "range": fmt_values(rng[:max_rank]) if rng else "",
            "maxRank": max_rank,
            "unresolved": unresolved,
        }

    return {
        "alias": alias,
        "id": cid,
        "name": lcu.get("name", ""),
        "title": lcu.get("title", ""),
        "patch": patch,
        "skills": skills,
        "unresolvedCount": len(total_unresolved),
    }


# ── メイン ──────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="出力ディレクトリ")
    ap.add_argument("--only", help="カンマ区切りの alias で対象を限定（テスト用）")
    args = ap.parse_args()

    import os

    os.makedirs(args.out, exist_ok=True)

    meta = get_json(f"{BASE}/content-metadata.json")
    patch = str(meta.get("version", "unknown"))
    print(f"patch: {patch}")

    summary = get_json(
        f"{BASE}/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json"
    )
    champs = [c for c in summary if c.get("id", -1) > 0]
    if args.only:
        wanted = {a.strip().lower() for a in args.only.split(",")}
        champs = [c for c in champs if c["alias"].lower() in wanted]
    print(f"対象チャンピオン数: {len(champs)}")

    index = {
        "patch": patch,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "champions": [],
    }
    ok = failed = 0
    total_unresolved = 0

    for i, champ in enumerate(sorted(champs, key=lambda c: c["alias"])):
        alias = champ["alias"]
        try:
            data = generate_champion(champ, patch)
            with open(f"{args.out}/{alias}.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            n_unres = data["unresolvedCount"]
            total_unresolved += n_unres
            index["champions"].append(
                {"alias": alias, "id": champ["id"], "name": data["name"],
                 "unresolvedCount": n_unres}
            )
            ok += 1
            flag = "" if n_unres == 0 else f"  ⚠️ 未解決 {n_unres} 件"
            print(f"[{i + 1}/{len(champs)}] {alias}{flag}")
            if n_unres:
                for key in ("q", "w", "e", "r"):
                    u = data["skills"][key]["unresolved"]
                    if u:
                        print(f"    {key.upper()}: {u}")
        except Exception as e:  # noqa: BLE001 - 1体の失敗で全体を止めない
            import traceback

            failed += 1
            tb = traceback.extract_tb(e.__traceback__)
            where = f"{tb[-1].name}:{tb[-1].lineno}" if tb else "?"
            index["champions"].append({"alias": alias, "id": champ["id"], "error": str(e)})
            print(f"[{i + 1}/{len(champs)}] {alias}  ❌ {e} ({where})")

    with open(f"{args.out}/index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    n_champ_unres = sum(
        1 for c in index["champions"] if c.get("unresolvedCount", 0) > 0
    )
    print(f"\n完了: 成功 {ok} / 失敗 {failed}")
    print(f"未解決プレースホルダーあり: {n_champ_unres} 体 / 計 {total_unresolved} 件")
    # 少数の失敗ではジョブを止めない（index.json にエラーとして記録済み）
    return 1 if ok == 0 or failed > 10 else 0


if __name__ == "__main__":
    sys.exit(main())
