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

# ゲーム内ツールチップ全文（日本語ストリングテーブル）
# ※ en_us というサブフォルダ名だが game/ja_jp ロケールWADの中身＝日本語
STRINGTABLE_URL = f"{BASE}/game/ja_jp/data/menu/en_us/lol.stringtable.json"

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


def expand_breakpoints(part: dict) -> list[float]:
    """ByCharLevelBreakpoints をレベル1〜18の値の列に展開する。

    ブレークポイントの数値フィールド:
      {57fdc438} / mBonusPerLevelAtAndAfter: そのレベル以降、毎レベル加算
      {02deb550} / mAdditionalBonusAtThisLevel: そのレベルで一度だけ加算
      （未知のハッシュキーは一度だけ加算として扱う）
    """
    base = float(part.get("mLevel1Value", 0) or 0)
    rate = float(part.get("mInitialBonusPerLevel", 0) or 0)
    steps: dict[int, float] = {}
    per_from: dict[int, float] = {}
    for bp in part.get("mBreakpoints") or []:
        if not isinstance(bp, dict):
            continue
        lvl = int(bp.get("mLevel", 0) or 0)
        for k, v in bp.items():
            if k in ("__type", "mLevel") or not isinstance(v, (int, float)):
                continue
            if k in ("{57fdc438}", "mBonusPerLevelAtAndAfter"):
                per_from[lvl] = float(v)
            else:
                steps[lvl] = steps.get(lvl, 0.0) + float(v)
    vals = [base]
    cur = base
    for lvl in range(2, 19):
        if lvl in per_from:
            rate = per_from[lvl]
        cur += rate + steps.get(lvl, 0.0)
        vals.append(round(cur, 4))
    return vals


def fmt_bp(vals: list, mult: float = 1.0, suffix: str = "") -> str:
    """レベル系列を「値が変わるレベルだけ」の表記に整形する。

    例: [30,30,...,23.75,...] → "30/23.75/17.5/11.25/5（レベル1/6/9/11/13）"
    変化点が多い（毎レベル成長など）場合はレンジ表記に畳む。
    """
    # 丸め後の表示値で変化点を取る（0.02→0.0225 のような差は表示上同値）
    shown = [fnum(v * mult) for v in vals]
    pts = [(1, shown[0])]
    for i in range(1, len(shown)):
        if shown[i] != shown[i - 1]:
            pts.append((i + 1, shown[i]))
    if len(pts) == 1:
        return f"{shown[0]}{suffix}"
    if len(pts) <= 6:
        nums = "/".join(v for _, v in pts)
        lvls = "/".join(str(l) for l, _ in pts)
        return f"{nums}{suffix}（レベル{lvls}）"
    return f"{shown[0]}〜{shown[-1]}{suffix}（レベル1〜18）"


# 先頭の割合値列（0.4 / 0.4〜0.7 / 0.4/0.45/0.5 等。1以上の値が混ざる場合は不一致）
HEAD_FRACTIONS = re.compile(r"^(-?0?\.\d+(?:[/〜]-?0?\.\d+)*)(?=$|[^\d./〜])")


def maybe_percentify(rendered: str, following: str) -> str:
    """0.4 のような割合値を 40% 表記に直す。

    LCU の説明文が *100 の乗数を持たないまま割合値を参照するケース
    （例: ロックの W の攻撃速度・移動速度）への対応。
    「0.4〜0.7（レベル比例）」「0.4/0.45（＋魔力の…）」のような
    複合表記でも先頭の数値列だけを変換する。
    直後が「秒」なら時間、「%」なら既にパーセント値とみなして変換しない。
    """
    m = HEAD_FRACTIONS.match(rendered)
    if not m:
        return rendered
    head, rest = m.group(1), rendered[m.end():]
    nxt = (rest.lstrip() or following.lstrip())[:1]
    if nxt in ("秒", "%", "％"):
        return rendered
    converted = re.sub(r"-?0?\.\d+", lambda v: fnum(float(v.group()) * 100), head)
    return f"{converted}%{rest}"


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

# mStat番号→表示名。番号の意味は実証ベースで確定したもののみ登録する:
#  - 6=魔法防御: ガーゴイル(3193)のBonusMR計算式 / 2525の物理防御(1)とのペア /
#    全チャンピオン本文語投票で確認（旧「移動速度」は誤りだった）
#  - 29=脅威: 脅威アイテム3種(2520/3179/6696)の看板パッシブが全て参照
#  - 34=攻撃速度: 4011のTotalAS計算式 / 本文語投票
#  - 9=クリティカルダメージ: 本文語投票3-0
# 証拠のない番号（7/8/13/31等）は誤表示を避けるため未登録のまま
# （未知statを含む計算式は数値を出さず、フォールバックで数値を伏せる）
STAT_NAMES = {
    0: "魔力", 1: "物理防御", 2: "攻撃力", 3: "攻撃速度", 4: "攻撃速度",
    5: "魔法防御", 6: "魔法防御", 9: "クリティカルダメージ",
    11: "最大体力", 12: "体力", 29: "脅威", 34: "攻撃速度",
}

# これ未満の係数はエンジン内部の微小項（毎フレーム更新用等）とみなして無視する
# 例: アフェリオス セヴェラムQ の移動速度 25% + 0.001×stat（表示上は 25% が正）
COEFF_EPSILON = 0.005
FORMULA_NAMES = {0: "合計", 1: "基礎", 2: "増加"}


# 基礎/増加の区別を持たないステータス（「合計脅威」等の不自然な接頭辞を避ける）
NO_PREFIX_STATS = {0, 29}


def stat_label(stat: int, formula: int) -> str | None:
    name = STAT_NAMES.get(stat)
    if name is None:
        return None  # 未知のスタット参照は呼び出し側で計算式ごと除外する
    if stat in NO_PREFIX_STATS:
        return name  # 魔力・脅威は「合計◯◯」と言わない
    prefix = FORMULA_NAMES.get(formula, "")
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
        if abs(coeff) < COEFF_EPSILON:
            return ("nums", [0.0] * max_rank)  # エンジン内部の微小項は無視
        label = stat_label(part.get("mStat", 0), part.get("mStatFormula", 0))
        if label is None:
            return None
        # 脅威1につき25 のような大係数は「脅威×25」表記（2500%は読みにくい）
        if abs(coeff) >= 5:
            return ("text", f"{label}×{fnum(coeff)}")
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
        if sub[0] == "bp":
            # 1未満なら割合（0.02→2%）、1以上なら既に%単位（ガレンの1.5等）
            mult = 100 if abs(sub[1][0]) < 1 else 1
            return ("text", f"{label}の{fmt_bp(sub[1], mult, '%')}")
        return None

    if t == "AbilityResourceByCoefficientCalculationPart":
        coeff = float(part.get("mCoefficient", 1))
        return ("text", f"最大マナの{fnum(coeff * 100)}%")

    if t == "ByCharLevelInterpolationCalculationPart":
        s, e = part.get("mStartValue", 0), part.get("mEndValue", 0)
        return ("text", f"{fnum(s)}〜{fnum(e)}（レベル比例）")

    if t == "ByCharLevelBreakpointsCalculationPart":
        return ("bp", expand_breakpoints(part))

    if t == "SumOfSubPartsCalculationPart":
        parts = [eval_part(p, values, max_rank) for p in part.get("mSubparts", [])]
        return combine_parts(parts, max_rank)

    if t == "ProductOfSubPartsCalculationPart":
        p1 = eval_part(part.get("mPart1"), values, max_rank)
        p2 = eval_part(part.get("mPart2"), values, max_rank)
        if p1 and p2 and p1[0] == "nums" and p2[0] == "nums":
            return ("nums", [a * b for a, b in zip(p1[1], p2[1])])
        if p1 and p2:
            a = render_result(p1)
            b = render_result(p2)
            if a is not None and b is not None:
                return ("text", f"{a}×{b}")
        return None

    return None


def combine_parts(parts: list, max_rank: int):
    # 単独のレベル比例値はそのまま返す（呼び出し側で%等に整形できるように）
    if len(parts) == 1 and parts[0] is not None and parts[0][0] == "bp":
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
        elif p[0] == "bp":
            texts.append(fmt_bp(p[1]))
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
    if kind == "bp":
        return fmt_bp(val, mult)
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
    # CDragonがハッシュ化した派生型（例: {e9a3c91d} = mRangedMultiplier付き計算）も
    # mFormulaParts を持てば GameCalculation として評価する。
    # mRangedMultiplier（近接/遠隔差）は基準値=近接をそのまま表示するため無視する。
    if t not in ("GameCalculation", "GameCalculationModified") and "mFormulaParts" in calc:
        t = "GameCalculation"
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
            if res[0] == "bp":
                # 1未満なら割合、1以上なら既に%単位の値とみなす
                pm = 100 if abs(res[1][0]) < 1 else 1
                return ("text", fmt_bp(res[1], pm, "%"))
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
        # 乗数がスタット反映（テキスト）の場合は「基準×乗数」のテキストで表す
        # （例: アフェリオス セヴェラムQ の合計ダメージ = 攻撃回数×合計攻撃力のX%）
        if base and m:
            base_r = render_result(base)
            m_r = render_result(m)
            if base_r is not None and m_r is not None:
                return ("text", f"{base_r}×{m_r}")
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
    """スクリプト名（例 UrgotQ）に一致する mSpell 持ちエントリを探す。

    アフェリオスの武器スペル等はパスがハッシュ化されている（{9501e989} 等）ため、
    パス末尾に加えて mScriptName / ObjectName フィールドでも照合する。
    """
    if not script_name:
        return None
    target = script_name.lower()
    for path, entry in bin_data.items():
        if not isinstance(entry, dict) or "mSpell" not in entry:
            continue
        names = {path.lower().split("/")[-1]}
        for field in ("mScriptName", "ObjectName"):
            v = entry.get(field)
            if isinstance(v, str):
                names.add(v.lower().split("/")[-1])
        if target in names:
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


def passive_label(name: str) -> str | None:
    """辞書で訳せないものは None（内部名を露出させないため表示しない）"""
    low = name.lower()
    for key, label in PASSIVE_LABELS:
        if key in low:
            return label
    return None


def build_passive_details(spell: dict) -> list[str]:
    """パッシブスペルの計算式を「ラベル: 値」の行に整形する"""
    values = collect_data_values(spell, max_rank=1)
    calcs = {k.lower(): v for k, v in (spell.get("mSpellCalculations") or {}).items()}
    lines: list[str] = []
    for cname, calc in (spell.get("mSpellCalculations") or {}).items():
        label = passive_label(cname)
        if label is None or cname.lower() in ("rangecheck",):
            continue
        res = eval_calculation(calcs[cname.lower()], values, calcs, max_rank=1)
        # percent/ratio 系の名前を持つ割合値は%表記に
        if (
            res is not None and res[0] == "bp"
            and re.search(r"percent|ratio", cname, re.I) and abs(res[1][0]) < 1
        ):
            rendered: str | None = fmt_bp(res[1], 100, "%")
        else:
            rendered = render_result(res)
            if rendered is not None:
                rendered = maybe_percentify(rendered, "")
        if not rendered:
            continue
        lines.append(f"{label}: {rendered}")
    return lines


# ── ストリングテーブル（ゲーム内ツールチップ本文）────────


def load_stringtable() -> dict[str, str]:
    """日本語ストリングテーブルを {小文字キー: 本文} で返す（失敗時は空）"""
    try:
        data = get_json(STRINGTABLE_URL)
    except Exception as e:  # noqa: BLE001 - 取得失敗時は従来表示にフォールバック
        print(f"ストリングテーブル取得失敗（フォールバック動作）: {e}")
        return {}
    entries = data.get("entries", data)
    table = {
        k.lower(): v for k, v in entries.items() if isinstance(v, str)
    }
    print(f"ストリングテーブル: {len(table)} エントリ")
    return table


def passive_tooltip_bodies(stringtable: dict[str, str], spell: dict) -> list[str]:
    """パッシブスペルの locキーからゲーム内ツールチップ本文の候補を引く。

    keyTooltipExtended が「補足行のみ」のチャンピオンがいるため
    （例: アーゴットはモンスター上限の1行だけ）、両方を候補として返し、
    呼び出し側で解決結果が最も充実したものを採用する。
    """
    if not stringtable:
        return []
    loc_keys = (
        (spell.get("mClientData") or {}).get("mTooltipData") or {}
    ).get("mLocKeys") or {}
    bodies = []
    for pref in ("keyTooltip", "keyTooltipExtended"):
        key = loc_keys.get(pref)
        if key and key.lower() in stringtable:
            bodies.append(stringtable[key.lower()])
    return bodies


# ── プレースホルダー解決 ────────────────────────────────

# @Var@ / @Var*100@ / @Var*-100@ / @Spell.XxxYyy:Var@（相互参照形式）
# 乗数はスロウ値（負数格納）の反転用に負値も許容する
PLACEHOLDER_RE = re.compile(r"@([A-Za-z][\w.:]*)(?:\*(-?\d+(?:\.\d+)?))?@")
ICON_RE = re.compile(r"%i:[^%]+%")
# 置換後に残った生プレースホルダーの検出（未対応形式の追跡用）
LEFTOVER_RE = re.compile(r"@[A-Za-z][^@\s]{0,80}@")


def resolve_description(
    text: str,
    values: dict,
    calcs: dict,
    global_values: dict,
    global_calcs: dict,
    max_rank: int,
    cd_str: str,
    cost_str: str,
    script_maps: dict | None = None,
) -> tuple[str, list]:
    """@変数@ を実数値に解決する。

    script_maps: {スクリプト名(小文字): (values, calcs)} —
    "@spell.JayceToTheSkies:Slow@" のようなクロススペル参照を、
    参照先スペルの値で解決するための索引（bin 内の全スペル）。
    """
    unresolved = []

    def repl(m: re.Match) -> str:
        raw, mult_s = m.group(1), m.group(2)
        # "Spell.UrgotPassive:PerLegCD" 形式はコロン以降が変数名
        name = raw.split(":")[-1].lower().split(".")[0]
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

        # クロススペル参照: 参照先スペルの値/計算式を最優先で使う
        lookups = []
        low = raw.lower()
        if ":" in low and script_maps:
            script = low.split(":", 1)[0]
            if script.startswith("spell."):
                script = script[len("spell."):]
            if script in script_maps:
                lookups.append(script_maps[script])
        lookups += [(values, calcs), (global_values, global_calcs)]

        for val_map, calc_map in (
            (v, c) if isinstance(c, dict) else (v, {}) for v, c in lookups
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
    # 正規表現にマッチしない形式のプレースホルダーが残っていたら記録する
    for tok in LEFTOVER_RE.findall(out):
        unresolved.append(f"raw:{tok}")
    out = ICON_RE.sub("", out)
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out.strip(), unresolved


# ── {{...}} テンプレート展開 ────────────────────────────


def make_template_expander(stringtable: dict[str, str], name_map: dict[str, str]):
    """{{key}} をストリングテーブル/スキル名で展開する関数を返す。

    - 完全一致キーはその本文に展開
    - 末尾が '_' のキー（例 Spell_ApheliosR_WeaponMod_）は前方一致する
      全キーの本文を連結して展開（武器別バリエーションの列挙）
    - spell_xxx_name はスキル表示名に展開
    """

    def sub_one(mm: re.Match) -> str:
        tok = mm.group(1).lower()
        if tok in stringtable:
            return stringtable[tok]
        if tok.endswith("_"):
            hits = sorted(k for k in stringtable if k.startswith(tok))
            if 0 < len(hits) <= 8:
                return "<br>".join(stringtable[k] for k in hits)
        nm = re.fullmatch(r"spell_(.+?)_name", tok)
        if nm and nm.group(1) in name_map:
            return name_map[nm.group(1)]
        return mm.group(0)  # 展開不能 → 残して呼び出し側で検出

    def expand(text: str) -> str:
        # {{ Key_@f1@ }} のような動的サフィックス付きは @..@ を落として
        # 前方一致展開に回す（アフェリオスRの武器ボーナス等）
        text = re.sub(r"(\{\{\s*[A-Za-z0-9_]+)@[^@{}]*@[A-Za-z0-9_]*(\s*\}\})", r"\1\2", text)
        for _ in range(2):  # 2段のネストまで
            if "{{" not in text:
                break
            text = re.sub(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", sub_one, text)
        return text

    return expand


# ── サブスペル（形態・武器別スキル）展開 ────────────────
#
# エリスの蜘蛛形態などの第2形態スキルは QWER スロットではなく
# 独立したスペルとして bin に格納されている。ここに定義したスペルを
# 該当スロットの説明文へセクションとして追記する。
# スクリプト名は scripts/probe_form_spells.py の CI 出力で実データ確認済み。

FORM_SPECS: dict[str, dict[str, list[tuple[str, str]]]] = {
    "Elise": {
        "q": [("蜘蛛形態", "EliseSpiderQCast")],
        "w": [("蜘蛛形態", "EliseSpiderW")],
        "e": [("蜘蛛形態", "EliseSpiderE")],
        "r": [("蜘蛛形態", "EliseRSpider")],
    },
    "Nidalee": {
        "q": [("クーガー形態", "Takedown")],
        "w": [("クーガー形態", "Pounce")],
        "e": [("クーガー形態", "Swipe")],
    },
    "Gnar": {
        "q": [("メガナー", "GnarBigQ")],
        "w": [("メガナー", "GnarBigW")],
        "e": [("メガナー", "GnarBigE")],
    },
    "Jayce": {
        "q": [("マーキュリーキャノン", "JayceShockBlast")],
        "w": [("マーキュリーキャノン", "JayceHyperCharge")],
        "e": [("マーキュリーキャノン", "JayceAccelerationGate")],
        "r": [("マーキュリーキャノン時", "JayceStanceGtH")],
    },
}


def build_subspell_section(
    bin_data: dict,
    stringtable: dict[str, str],
    script: str,
    label: str,
    global_values: dict,
    global_calcs: dict,
    script_maps: dict,
    expand,
    max_rank: int,
) -> tuple[str | None, list]:
    """サブスペル1件をセクションHTMLに整形する（本文はゲーム内表記）"""
    spell = find_spell_entry(bin_data, script)
    if spell is None:
        return None, [f"form:{script}:spell-not-found"]

    values = collect_data_values(spell, max_rank)
    calcs = {k.lower(): v for k, v in (spell.get("mSpellCalculations") or {}).items()}
    loc = ((spell.get("mClientData") or {}).get("mTooltipData") or {}).get("mLocKeys") or {}
    name = stringtable.get((loc.get("keyName") or "").lower(), "")
    body = stringtable.get((loc.get("keyTooltip") or "").lower(), "")
    if not body:
        return None, [f"form:{script}:no-tooltip"]

    text, unresolved = resolve_description(
        expand(body), values, calcs, global_values, global_calcs,
        max_rank, cd_str="", cost_str="", script_maps=script_maps,
    )
    if not text:
        return None, [f"form:{script}:empty"]

    title = f"{label}: {name}" if name and name not in label else label
    return f"<br><br><strong>◆ {title}</strong><br>{text}", unresolved


# ── アフェリオス専用: 5武器のスキル説明を合成 ───────────
#
# 武器別ツールチップは stringtable に spell_apheliosq_tooltip_1..5 等として
# 全文が存在し、数値は @spell.ApheliosCalibrumQ:SpellDamage@ のような
# クロススペル参照で bin 内のハッシュ化スペル（mScriptName で照合）から引ける。
# インデックス対応: 1=キャリバー 2=セヴェラム 3=インファーナム
#                   4=クレッシェンダム 5=グラヴィタム


def apply_aphelios_weapons(
    skills: dict,
    stringtable: dict[str, str],
    expand,
    global_values: dict,
    global_calcs: dict,
    script_maps: dict,
) -> list[str]:
    unresolved_all: list[str] = []

    def resolve_key(st_key: str, max_rank: int) -> str:
        body = stringtable.get(st_key, "")
        if not body:
            unresolved_all.append(f"st:{st_key}:missing")
            return ""
        text, u = resolve_description(
            expand(body), {}, {}, global_values, global_calcs,
            max_rank, cd_str="", cost_str="", script_maps=script_maps,
        )
        unresolved_all.extend(u)
        return text

    gun_names = [
        re.sub(r"<[^>]+>", "", stringtable.get(f"apheliosgun_lorename_{i}", f"武器{i}"))
        for i in range(1, 6)
    ]

    # Q: 武器ごとの発動スキル
    q_rank = int(skills["q"].get("maxRank") or 6)
    q_secs = []
    for i, name in enumerate(gun_names, 1):
        text = resolve_key(f"spell_apheliosq_tooltip_{i}", q_rank)
        if text:
            q_secs.append(f"<strong>◆ {name}</strong><br>{text}")
    if q_secs:
        skills["q"]["description"] = "<br><br>".join(q_secs)
        skills["q"]["source"] = "stringtable"

    # E: 武器キュー（武器ごとの通常攻撃特性と武器アクション）
    e_secs = []
    for i, name in enumerate(gun_names, 1):
        parts = [
            t for t in (
                resolve_key(f"apheliosgun_autoattack_tooltip_{i}", 1),
                resolve_key(f"apheliosgun_tooltip_{i}", 1),
            ) if t
        ]
        if parts:
            e_secs.append(f"<strong>◆ {name}</strong><br>" + "<br>".join(parts))
    if e_secs:
        intro = "弾薬が切れた武器は次の武器と交代する（パッシブ参照）。各武器の通常攻撃特性と武器アクション:"
        skills["e"]["description"] = intro + "<br><br>" + "<br><br>".join(e_secs)
        skills["e"]["source"] = "stringtable"

    return unresolved_all


# ── チャンピオン単位の生成 ──────────────────────────────


def generate_champion(champ: dict, patch: str, stringtable: dict[str, str]) -> dict:
    alias = champ["alias"]
    cid = champ["id"]
    folder = alias.lower()

    lcu = get_json(
        f"{BASE}/plugins/rcp-be-lol-game-data/global/ja_jp/v1/champions/{cid}.json"
    )
    bin_data = get_json(f"{BASE}/game/data/characters/{folder}/{folder}.bin.json")

    spell_names, passive_ref = find_character_spells(bin_data)

    # bin 内の全スペル索引（@spell.X:Var@ クロススペル参照・サブスペル展開用）
    # ハッシュ化パスのスペルは mScriptName / ObjectName でも引けるようにする
    script_maps: dict[str, tuple[dict, dict]] = {}
    for path, entry in bin_data.items():
        if isinstance(entry, dict) and isinstance(entry.get("mSpell"), dict):
            sp = entry["mSpell"]
            maps = (
                collect_data_values(sp, 6),
                {k.lower(): v for k, v in (sp.get("mSpellCalculations") or {}).items()},
            )
            script_maps.setdefault(path.split("/")[-1].lower(), maps)
            for field in ("mScriptName", "ObjectName"):
                v = entry.get(field)
                if isinstance(v, str):
                    script_maps.setdefault(v.lower().split("/")[-1], maps)

    # {{...}} 参照の展開用: スキルスクリプト名 → 表示名（spell_xxx_name 対策）
    name_map: dict[str, str] = {}
    for i, key in enumerate(("q", "w", "e", "r")):
        script = spell_names[i] if i < len(spell_names) else f"{alias}{key.upper()}"
        lcu_sp = next((s for s in lcu.get("spells", []) if s.get("spellKey") == key), {})
        if lcu_sp.get("name"):
            name_map[str(script).lower()] = lcu_sp["name"]
    if passive_ref and lcu.get("passive", {}).get("name"):
        name_map[str(passive_ref).lower()] = lcu["passive"]["name"]
    expand = make_template_expander(stringtable, name_map)

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
        per_spell[f"{key}:spell"] = spell  # type: ignore[assignment]
        for d, g in ((values, global_values), (calcs, global_calcs)):
            for k, v in d.items():
                g.setdefault(k, v)

    # 最終フォールバック: bin 内全スペルの値/計算式（QWERスロット優先のまま）
    # サブスペル本文が参照する変数（アフェリオスR武器ボーナス等）を拾うため
    for vals, cs in script_maps.values():
        for k, v in vals.items():
            global_values.setdefault(k, v)
        for k, v in cs.items():
            global_calcs.setdefault(k, v)

    skills: dict = {}
    total_unresolved: list[str] = []

    passive = lcu.get("passive", {})
    passive_spell = (
        find_spell_entry(bin_data, passive_ref or "")
        or find_spell_entry(bin_data, f"{alias}passive")
        or find_spell_entry(bin_data, f"{alias}p")
    )

    # 第一候補: ゲーム内ツールチップ本文（ストリングテーブル）を bin の数値で解決
    passive_desc = ""
    passive_unresolved: list = []
    passive_source = "lcu"
    if passive_spell:
        p_values = collect_data_values(passive_spell, max_rank=1)
        p_calcs = {
            k.lower(): v
            for k, v in (passive_spell.get("mSpellCalculations") or {}).items()
        }
        lcu_passive_len = len(passive.get("description", ""))
        candidates: list[str] = []
        for st_body in passive_tooltip_bodies(stringtable, passive_spell):
            expanded = expand(st_body)
            body, st_unresolved = resolve_description(
                expanded, p_values, p_calcs, global_values, global_calcs,
                max_rank=1, cd_str="", cost_str="", script_maps=script_maps,
            )
            body = body.strip()
            # 穴あき文（未解決変数・未展開テンプレート）は採用しない
            if not body or st_unresolved or "{{" in body or "@" in body:
                continue
            candidates.append(body)
        best = max(candidates, key=len, default="")
        # LCU の短文より短い候補（補足行だけ等）はゲーム内本文とみなさない
        if best and len(best) >= lcu_passive_len:
            passive_desc = best
            passive_source = "stringtable"

    # フォールバック: LCU の短文 + bin 計算式の「詳細数値」追記
    if passive_source != "stringtable":
        passive_desc, passive_unresolved = resolve_description(
            passive.get("description", ""),
            {}, {}, global_values, global_calcs,
            max_rank=1, cd_str="", cost_str="", script_maps=script_maps,
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
        "source": passive_source,
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

        # {{テンプレ}} をゲーム内文面に展開してから変数解決する
        # （アクシャンW・ガングプランクQ 等は説明文全体がテンプレ参照）
        raw_desc = lcu_spell.get("dynamicDescription") or lcu_spell.get("description") or ""
        desc, unresolved = resolve_description(
            expand(raw_desc),
            values,
            calcs,
            global_values,
            global_calcs,
            max_rank,
            cd_str,
            cost_str,
            script_maps=script_maps,
        )
        # 展開できなかった {{...}} は記録して表示からは除去する
        for tok in re.findall(r"\{\{[^{}]*\}\}", desc):
            unresolved.append(f"tpl:{tok}")
            desc = desc.replace(tok, "").strip()

        # ゲーム内本文（ストリングテーブル）優先:
        # 完全解決できて LCU 版より情報量が多い場合のみ差し替える
        # （パッシブと同じ品質ゲート。ユナラのR強化説明などが該当）
        source = "lcu"
        spell_obj = per_spell.get(f"{key}:spell")
        if isinstance(spell_obj, dict) and stringtable:
            loc = (
                (spell_obj.get("mClientData") or {}).get("mTooltipData") or {}
            ).get("mLocKeys") or {}
            plain_lcu = re.sub(r"<[^>]+>", "", desc)
            best_st = ""
            for loc_key in ("keyTooltip", "keyTooltipExtended"):
                st_body = stringtable.get((loc.get(loc_key) or "").lower(), "")
                if not st_body:
                    continue
                st_desc, st_unres = resolve_description(
                    expand(st_body), values, calcs, global_values, global_calcs,
                    max_rank, cd_str, cost_str, script_maps=script_maps,
                )
                plain_st = re.sub(r"<[^>]+>", "", st_desc)
                ok = (
                    st_desc and not st_unres
                    and "{{" not in st_desc and "@" not in st_desc
                    and len(plain_st) > len(plain_lcu)
                )
                if ok and len(plain_st) > len(re.sub(r"<[^>]+>", "", best_st)):
                    best_st = st_desc
                elif not ok and len(plain_st) > len(plain_lcu):
                    # 差し替え候補だったのに却下された場合は理由をCIログに残す
                    print(
                        f"    st-gate skip {alias} {key.upper()}/{loc_key}: "
                        f"unres={st_unres[:3]} tpl={'{{' in st_desc} at={'@' in st_desc}"
                    )
            if best_st:
                desc, unresolved, source = best_st, [], "stringtable"

        # サブスペル（形態・武器別）のセクションを追記
        for label, script in (FORM_SPECS.get(alias, {}).get(key) or []):
            section, sub_unresolved = build_subspell_section(
                bin_data, stringtable, script, label,
                global_values, global_calcs, script_maps, expand, max_rank,
            )
            if section:
                desc += section
            unresolved.extend(sub_unresolved)

        total_unresolved.extend(f"{key.upper()}:{u}" for u in unresolved)

        rng = lcu_spell.get("range") or []
        skills[key] = {
            "name": lcu_spell.get("name", ""),
            "description": desc,
            "cooldown": cd_str,
            "cost": cost_str,
            "range": fmt_values(rng[:max_rank]) if rng else "",
            "maxRank": max_rank,
            "source": source,
            "unresolved": unresolved,
        }

    # アフェリオス: Q/E を5武器の合成説明に差し替える
    if alias == "Aphelios" and stringtable:
        aphelios_unresolved = apply_aphelios_weapons(
            skills, stringtable, expand, global_values, global_calcs, script_maps
        )
        total_unresolved.extend(aphelios_unresolved)

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

    stringtable = load_stringtable()

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
            data = generate_champion(champ, patch, stringtable)
            with open(f"{args.out}/{alias}.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            n_unres = data["unresolvedCount"]
            total_unresolved += n_unres
            index["champions"].append(
                {"alias": alias, "id": champ["id"], "name": data["name"],
                 "unresolvedCount": n_unres,
                 "passiveSource": data["skills"]["passive"].get("source", "lcu")}
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
    n_st = sum(1 for c in index["champions"] if c.get("passiveSource") == "stringtable")
    print(f"\nパッシブ本文をゲーム内表記で解決: {n_st} 体")
    print(f"\n完了: 成功 {ok} / 失敗 {failed}")
    print(f"未解決プレースホルダーあり: {n_champ_unres} 体 / 計 {total_unresolved} 件")
    # 少数の失敗ではジョブを止めない（index.json にエラーとして記録済み）
    return 1 if ok == 0 or failed > 10 else 0


if __name__ == "__main__":
    sys.exit(main())
