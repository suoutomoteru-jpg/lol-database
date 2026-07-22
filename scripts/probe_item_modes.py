#!/usr/bin/env python3
"""アイテムデータ調査プローブ #7: 数値なしアイテムの変数の在り処

終わりなき飢え(2517)・ラヴァナス(3074)・ステラック(3053)は説明文に
数値がなく、テンプレート再構築も失敗する。テンプレの @Var@ が
アイテム本体でなくスペル/バフ側 (Items/{id}/Spells/*) にあるか確認する。
"""
import json
import re
import urllib.request

CD = "https://raw.communitydragon.org/latest"
STRINGTABLE_URL = f"{CD}/game/ja_jp/data/menu/en_us/lol.stringtable.json"
TARGETS = ["2517", "3074", "3053"]


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "lol-db-probe"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def names_of(entry: dict) -> dict:
    spell = entry.get("mSpell") or entry
    out = {}
    dv = spell.get("mDataValues") or entry.get("mDataValues") or []
    out["DataValues"] = {str(d.get("mName")): d.get("mValue") for d in dv}
    for key in ("mSpellCalculations", "mItemCalculations"):
        c = spell.get(key) or entry.get(key)
        if c:
            out[key] = {k: json.dumps(v, ensure_ascii=False)[:220] for k, v in c.items()}
    ea = spell.get("mEffectAmount")
    if ea:
        out["mEffectAmount"] = [e.get("value") for e in ea if isinstance(e, dict)][:8]
    return out


def main() -> None:
    st_raw = get_json(STRINGTABLE_URL)
    entries = st_raw.get("entries", st_raw)
    st = {k.lower(): v for k, v in entries.items() if isinstance(v, str)}
    bin_data = get_json(f"{CD}/game/items.cdtb.bin.json")

    for iid in TARGETS:
        print(f"\n############ {iid} ############")
        tpl = st.get(f"generatedtip_item_{iid}_externaldescription", "(テンプレなし)")
        print("--- externaldescription ---")
        print(tpl[:1500])
        print("--- テンプレ内の @Var@ 一覧 ---")
        print(sorted(set(re.findall(r"@([A-Za-z][\w.:]*)(?:\*[\d.-]+)?@", tpl))))
        print("--- {{include}} 一覧 ---")
        print(sorted(set(re.findall(r"\{\{\s*([\w.]+)\s*\}\}", tpl))))
        entry = bin_data.get(f"Items/{iid}") or {}
        print("--- Items/本体 の変数 ---")
        print(json.dumps(names_of(entry), ensure_ascii=False, indent=1)[:1200])
        subkeys = [k for k in bin_data if k.startswith(f"Items/{iid}/")]
        print(f"--- サブエントリ {len(subkeys)}件 ---")
        for k in subkeys:
            info = names_of(bin_data[k])
            compact = {kk: vv for kk, vv in info.items() if vv}
            print(f"  {k}: {json.dumps(compact, ensure_ascii=False)[:600]}")


if __name__ == "__main__":
    main()
