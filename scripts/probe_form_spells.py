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


def probe_missing_template_keys() -> None:
    """アクシャンW / ガングプランクQ のテンプレ参照先キーの実名調査"""
    st = get_json(STRINGTABLE_URL)
    entries = st.get("entries", st)
    table = {k.lower(): v for k, v in entries.items() if isinstance(v, str)}
    for pat in ("akshanw", "gangplankq"):
        print(f"=== keys containing '{pat}' ===")
        for k in sorted(table):
            if pat in k:
                print(f"  {k} (len={len(table[k])})")
        print()


def probe_aphelios_deep() -> None:
    """アフェリオス第3弾: 武器スペル本体（ハッシュ化パス）の特定"""
    bin_data = get_json(f"{BASE}/game/data/characters/aphelios/aphelios.bin.json")

    print("=== 'CalibrumQ' を含むエントリの所在（生テキスト検索）===")
    raw = json.dumps(bin_data, ensure_ascii=False)
    for m in re.finditer(r"ApheliosCalibrumQ", raw):
        s = max(0, m.start() - 120)
        print("  ...", raw[s:m.end() + 60].replace("\n", " "), "...")
        print()

    print("=== mSpell を持つ全エントリの詳細（DataValues/calc名）===")
    for path, entry in sorted(bin_data.items()):
        if not isinstance(entry, dict) or "mSpell" not in entry:
            continue
        sp = entry["mSpell"]
        dvs = [dv.get("mName") for dv in (sp.get("mDataValues") or []) if isinstance(dv, dict)]
        calcs = list((sp.get("mSpellCalculations") or {}).keys())
        if not dvs and not calcs:
            continue
        script = path.split("/")[-1]
        extra = {k: entry[k] for k in entry if "script" in k.lower() or "name" in k.lower()}
        print(f"--- {script}  entrykeys={list(extra.keys())}")
        print(f"    dv={dvs[:12]}")
        print(f"    calcs={calcs[:12]}")

    print("\n=== ディレクトリ一覧 characters/aphelios/ ===")
    try:
        listing = get_json("https://raw.communitydragon.org/json/latest/game/data/characters/aphelios/")
        for f in listing:
            print("  ", f.get("name"), f.get("type"))
    except Exception as e:  # noqa: BLE001
        print(f"listing failed: {e}")


def probe_aphelios_calcs() -> None:
    """アフェリオス第5弾: 武器スペルの計算式JSON全文（ratio検証用）"""
    bin_data = get_json(f"{BASE}/game/data/characters/aphelios/aphelios.bin.json")
    targets = {
        "apheliosseverumq": ["Haste", "TotalDamage", "NumAttacks", "HealAmount"],
        "aphelioscalibrumq": ["SpellDamage"],
        "apheliosinfernumq": ["QWaveDamage"],
        "apheliosgravitumq": ["Damage"],
        "arurf": [],
    }
    for path, entry in bin_data.items():
        if not isinstance(entry, dict) or "mSpell" not in entry:
            continue
        script = str(entry.get("mScriptName") or path.split("/")[-1])
        if script.lower() not in targets:
            continue
        calcs = entry["mSpell"].get("mSpellCalculations") or {}
        wanted = targets[script.lower()]
        print(f"########## {script} ##########")
        for name, calc in calcs.items():
            if wanted and name not in wanted:
                continue
            print(f"--- {name}")
            print(json.dumps(calc, ensure_ascii=False, indent=1)[:2500])
        # DataValues も表示
        dvs = entry["mSpell"].get("mDataValues") or []
        print("DataValues:", json.dumps(dvs, ensure_ascii=False)[:1500])
        print()


def probe_severum_datavalues() -> None:
    """第6弾: StartingAttacks / ASCoeff の所在を bin 生テキストから探す"""
    raw = json.dumps(
        get_json(f"{BASE}/game/data/characters/aphelios/aphelios.bin.json"),
        ensure_ascii=False,
    )
    for needle in ("StartingAttacks", "ASCoeff"):
        print(f"=== '{needle}' の出現箇所 ===")
        count = 0
        for m in re.finditer(needle, raw):
            count += 1
            if count > 6:
                break
            s = max(0, m.start() - 200)
            print("  ...", raw[s:m.end() + 120].replace("\\n", " "))
            print()
        if count == 0:
            print("  （見つからず）")
        print()


def probe_ddragon_stats() -> None:
    """第7弾: DDragon実データの stats フィールド（AD成長値の欠落調査）"""
    dd = "https://ddragon.leagueoflegends.com"
    version = get_json(f"{dd}/api/versions.json")[0]
    print(f"version: {version}\n")

    print("=== champion/Urgot.json（詳細）の stats ===")
    detail = get_json(f"{dd}/cdn/{version}/data/ja_JP/champion/Urgot.json")
    print(json.dumps(detail["data"]["Urgot"]["stats"], ensure_ascii=False, indent=1))

    print("\n=== champion.json（一覧）の Urgot / Ambessa の stats ===")
    listing = get_json(f"{dd}/cdn/{version}/data/ja_JP/champion.json")
    for cid in ("Urgot", "Ambessa"):
        c = listing["data"].get(cid)
        print(f"--- {cid}")
        print(json.dumps(c["stats"] if c else None, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    probe_ddragon_stats()
