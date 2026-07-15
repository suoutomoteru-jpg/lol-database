#!/usr/bin/env python3
"""形態変化チャンピオンのサブスペル調査プローブ

アフェリオス（5武器）、エリス/ニダリー/ナー/ジェイス（第2形態）、
ユナラ（R強化）などについて、ゲーム bin 内の全スペルエントリの
スクリプト名と、ストリングテーブル上の表示名/ツールチップ有無を出力する。
generate_tooltips.py の FORM_SPECS（サブスペル展開定義）作成用。
"""
import json
import re
import urllib.request

BASE = "https://raw.communitydragon.org/latest"
UA = {"User-Agent": "lol-db-form-probe"}
STRINGTABLE_URL = f"{BASE}/game/ja_jp/data/menu/en_us/lol.stringtable.json"

TARGETS: list[str] = []  # 第1弾で調査済み。第2弾はアフェリオス深掘りのみ


def get_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    st = get_json(STRINGTABLE_URL)
    entries = st.get("entries", st)
    table = {k.lower(): v for k, v in entries.items() if isinstance(v, str)}
    print(f"stringtable: {len(table)} entries\n")

    for champ in TARGETS:
        print(f"########## {champ} ##########")
        try:
            bin_data = get_json(f"{BASE}/game/data/characters/{champ}/{champ}.bin.json")
        except Exception as e:  # noqa: BLE001
            print(f"bin fetch failed: {e}")
            continue

        # CharacterRecords のスペル名
        for path, entry in bin_data.items():
            if isinstance(entry, dict) and "/characterrecords/root" in path.lower():
                print("spellNames:", entry.get("spellNames") or entry.get("mSpellNames"))
                print("passive:", entry.get("mCharacterPassiveSpell"))
                # 形態関連フィールドがあれば表示
                for k in entry:
                    if re.search(r"form|transform|extra", k, re.I):
                        print(f"  {k}: {json.dumps(entry[k], ensure_ascii=False)[:200]}")

        # mSpell を持つ全エントリ
        for path, entry in sorted(bin_data.items()):
            if not isinstance(entry, dict) or "mSpell" not in entry:
                continue
            spell = entry["mSpell"]
            script = path.split("/")[-1]
            loc = ((spell.get("mClientData") or {}).get("mTooltipData") or {}).get("mLocKeys") or {}
            name_key = (loc.get("keyName") or "").lower()
            tip_key = (loc.get("keyTooltip") or "").lower()
            disp = table.get(name_key, "")[:30]
            has_tip = "T" if tip_key in table else "-"
            tip_len = len(table.get(tip_key, ""))
            n_dv = len(spell.get("mDataValues") or [])
            print(f"  {script}\tname={disp!r}\ttooltip={has_tip}({tip_len})\tdv={n_dv}")

        # アフェリオスのRウェポンMOD等: 該当stringtableキーの列挙
        print("  --- stringtable keys ---")
        for k in sorted(table):
            if champ in k and re.search(r"tooltip|weaponmod", k):
                print(f"  ST: {k} (len={len(table[k])})")
        print()


def probe_aphelios_deep() -> None:
    """アフェリオス第2弾: 武器スペルの数値データの所在と、ST本文の変数形式"""
    st = get_json(STRINGTABLE_URL)
    entries = st.get("entries", st)
    table = {k.lower(): v for k, v in entries.items() if isinstance(v, str)}

    print("=== 武器別ツールチップ本文（変数形式の確認）===")
    keys = (
        [f"spell_apheliosq_tooltip_{i}" for i in range(1, 6)]
        + [f"spell_apheliose_tooltipextended_long_{i}" for i in range(1, 6)]
        + [f"spell_apheliosr_weaponmod_{i}" for i in range(1, 6)]
        + ["spell_apheliose_tooltip", "spell_apheliosq_mastertooltipextended",
           "spell_apheliosr_tooltip"]
        + [f"apheliosgun_tooltip_{i}" for i in range(1, 6)]
    )
    for k in keys:
        print(f"--- {k}")
        print(table.get(k, "(なし)"))

    print("\n=== skin0.bin 内のアフェリオス武器スペル ===")
    try:
        skin = get_json(f"{BASE}/game/data/characters/aphelios/skins/skin0.bin.json")
        for path, entry in sorted(skin.items()):
            if not isinstance(entry, dict) or "mSpell" not in entry:
                continue
            script = path.split("/")[-1]
            if not re.search(r"calibrum|severum|gravitum|infernum|crescendum|apheliosq|apheliose|apheliosr", script, re.I):
                continue
            sp = entry["mSpell"]
            dvs = [dv.get("mName") for dv in (sp.get("mDataValues") or []) if isinstance(dv, dict)]
            n_calc = len(sp.get("mSpellCalculations") or {})
            print(f"  {script}\tdv={dvs}\tcalcs={n_calc}")
    except Exception as e:  # noqa: BLE001
        print(f"skin0 fetch failed: {e}")


if __name__ == "__main__":
    main()
    probe_aphelios_deep()
