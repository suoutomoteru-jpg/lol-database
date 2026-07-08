#!/usr/bin/env python3
"""
CommunityDragon からチャンピオンの詳細ツールチップ素材を取得する試作スクリプト

取得するもの:
  1. LCU データ (ja_jp)  : パッシブ/スキルの名前と説明文（日本語）
  2. ゲーム bin データ    : スキルのランク毎数値 (mDataValues)・計算式
                           (mSpellCalculations)・CD/コスト・tooltip の loc キー
  3. ストリングテーブル    : ゲーム内ツールチップ本文（日本語、@変数@ 付き）

実行方法:
    python3 scripts/fetch_champion_tooltips.py urgot

依存: 標準ライブラリのみ
"""

import json
import re
import sys
import urllib.request

BASE = "https://raw.communitydragon.org/latest"
UA = {"User-Agent": "lol-database-tooltip-poc/1.0"}


def get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def get_json(url: str):
    return json.loads(get(url))


def section(title: str):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def strip_markup(s: str) -> str:
    """ツールチップの HTML 風タグを除去して平文化（@変数@ は残す）"""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<li>", "\n・", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


# ── 計算式 (mSpellCalculations) の簡易レンダラ ──────────────

STAT_NAMES = {
    0: "AP", 1: "物防", 2: "AD", 3: "AS", 4: "AR?", 5: "魔防",
    6: "MS", 7: "Crit", 11: "最大HP", 12: "HP", 20: "?",
}
FORMULA_NAMES = {0: "合計", 1: "基礎", 2: "増加"}


def render_part(p) -> str:
    if not isinstance(p, dict):
        return str(p)
    t = p.get("__type", "")
    try:
        if t == "NamedDataValueCalculationPart":
            return f"[{p.get('mDataValue')}]"
        if t == "EffectValueCalculationPart":
            return f"[Effect{p.get('mEffectIndex')}Amount]"
        if t == "NumberCalculationPart":
            return str(p.get("mNumber"))
        if t == "StatByCoefficientCalculationPart":
            stat = STAT_NAMES.get(p.get("mStat", 0), f"stat{p.get('mStat', 0)}")
            fml = FORMULA_NAMES.get(p.get("mStatFormula", 0), "")
            return f"{p.get('mCoefficient', 1) * 100:g}%{fml}{stat}"
        if t == "StatByNamedDataValueCalculationPart":
            stat = STAT_NAMES.get(p.get("mStat", 0), f"stat{p.get('mStat', 0)}")
            fml = FORMULA_NAMES.get(p.get("mStatFormula", 0), "")
            return f"[{p.get('mDataValue')}]×{fml}{stat}"
        if t == "StatBySubPartCalculationPart":
            stat = STAT_NAMES.get(p.get("mStat", 0), f"stat{p.get('mStat', 0)}")
            fml = FORMULA_NAMES.get(p.get("mStatFormula", 0), "")
            return f"({render_part(p.get('mSubpart'))})×{fml}{stat}"
        if t == "AbilityResourceByCoefficientCalculationPart":
            return f"{p.get('mCoefficient', 1) * 100:g}%マナ"
        if t == "ByCharLevelInterpolationCalculationPart":
            return f"{p.get('mStartValue')}〜{p.get('mEndValue')}(Lv比例)"
        if t == "ByCharLevelBreakpointsCalculationPart":
            return f"Lv毎({p.get('mLevel1Value')}起点)"
        if t == "ProductOfSubPartsCalculationPart":
            return f"({render_part(p.get('mPart1'))})×({render_part(p.get('mPart2'))})"
        if t == "SumOfSubPartsCalculationPart":
            return " + ".join(render_part(x) for x in p.get("mSubparts", []))
    except Exception:
        pass
    return json.dumps(p, ensure_ascii=False)[:160]


def render_calc(c) -> str:
    if not isinstance(c, dict):
        return str(c)
    t = c.get("__type", "")
    if t == "GameCalculation":
        parts = " + ".join(render_part(p) for p in c.get("mFormulaParts", []))
        mult = c.get("mMultiplier")
        if mult is not None:
            parts = f"({parts}) × ({render_part(mult)})"
        return parts
    if t == "GameCalculationModified":
        return (
            f"({render_part(c.get('mMultiplier'))}) × "
            f"参照[{c.get('mModifiedGameCalculation')}]"
        )
    return json.dumps(c, ensure_ascii=False)[:160]


def main() -> int:
    champ = (sys.argv[1] if len(sys.argv) > 1 else "urgot").lower()

    # ── 1. チャンピオン ID の解決 ──────────────────────────
    summary = get_json(
        f"{BASE}/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json"
    )
    cid = next(c["id"] for c in summary if c.get("alias", "").lower() == champ)
    print(f"champion: {champ}  id={cid}")

    # ── 2. LCU 日本語データ ────────────────────────────────
    section("LCU ja_jp データ（名前・説明文）")
    lcu = get_json(
        f"{BASE}/plugins/rcp-be-lol-game-data/global/ja_jp/v1/champions/{cid}.json"
    )
    print(f"name: {lcu.get('name')}  title: {lcu.get('title')}")
    p = lcu.get("passive", {})
    print(f"\n--- Passive: {p.get('name')}")
    print(strip_markup(p.get("description", "")))
    for sp in lcu.get("spells", []):
        print(f"\n--- {sp.get('spellKey', '?').upper()}: {sp.get('name')}")
        print(f"  cooldown: {sp.get('cooldown')}  cost: {sp.get('cost')}  range: {sp.get('range')}")
        print(strip_markup(sp.get("dynamicDescription", "")))

    # ── 3. ゲーム bin データ（数値・計算式・locキー）────────
    section("ゲーム bin データ（数値・計算式）")
    bin_data = get_json(f"{BASE}/game/data/characters/{champ}/{champ}.bin.json")
    loc_keys: set[str] = set()
    spell_re = re.compile(rf"Spells/{champ}(passive|q|w|e|r)", re.I)

    for path, entry in bin_data.items():
        if not isinstance(entry, dict) or "mSpell" not in entry:
            continue
        if not spell_re.search(path):
            continue
        spell = entry["mSpell"]
        print(f"\n--- {path}")
        for field, label in (
            ("cooldownTime", "CD"),
            ("mana", "コスト"),
            ("castRangeDisplayOverride", "射程(表示)"),
            ("castRange", "射程"),
        ):
            if field in spell:
                print(f"  {label}: {spell[field]}")
        for dv in spell.get("mDataValues", []):
            name = dv.get("mName", "?")
            vals = dv.get("mValues", [])
            print(f"  DataValue [{name}]: {vals}")
        for cname, calc in (spell.get("mSpellCalculations") or {}).items():
            print(f"  Calc [{cname}] = {render_calc(calc)}")
        tooltip = (spell.get("mClientData") or {}).get("mTooltipData") or {}
        keys = tooltip.get("mLocKeys") or {}
        for k, v in keys.items():
            print(f"  LocKey {k}: {v}")
            loc_keys.add(v)

    # ── 4. ストリングテーブル（ゲーム内ツールチップ本文）────
    section("ストリングテーブル（ツールチップ本文）")
    candidates = [
        f"{BASE}/game/ja_jp/data/menu/main_ja_jp.stringtable.json",
        f"{BASE}/game/data/menu/main_ja_jp.stringtable.json",
        f"{BASE}/game/data/menu/fontconfig_ja_jp.txt",
        f"{BASE}/game/data/menu/main_en_us.stringtable.json",
    ]
    entries: dict[str, str] = {}
    for cand in candidates:
        try:
            raw = get(cand)
        except Exception as e:
            print(f"  (skip) {cand}: {e}")
            continue
        print(f"  取得成功: {cand}  ({len(raw) // 1024} KB)")
        if cand.endswith(".json"):
            parsed = json.loads(raw)
            entries = parsed.get("entries", parsed)
        else:
            for m in re.finditer(r'tr "([^"]+)" = "((?:[^"\\]|\\.)*)"', raw.decode("utf-8", "replace")):
                entries[m.group(1)] = m.group(2).replace('\\"', '"').replace("\\n", "\n")
        break

    if not entries:
        print("  ストリングテーブルを取得できませんでした")
        return 0

    wanted = {k.lower() for k in loc_keys}
    hits = {
        k: v
        for k, v in entries.items()
        if isinstance(v, str)
        and (k.lower() in wanted or re.search(rf"spell_{champ}", k, re.I))
    }
    print(f"  一致キー数: {len(hits)}")
    for k in sorted(hits):
        print(f"\n### {k}")
        print(strip_markup(hits[k]))

    return 0


if __name__ == "__main__":
    sys.exit(main())
