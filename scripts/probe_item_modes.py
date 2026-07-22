#!/usr/bin/env python3
"""アイテムデータ調査プローブ #4: バスティオンブレイカー(2520) のダメージ計算式

修正パイプラインは適用されているが「確定ダメージ」が0に解決される。
externaldescription テンプレートのどの @Var@ がダメージで、それが
mDataValues / mItemCalculations のどれに対応し、なぜ0になるかを特定する。
"""
import json
import urllib.request

CD = "https://raw.communitydragon.org/latest"
STRINGTABLE_URL = f"{CD}/game/ja_jp/data/menu/en_us/lol.stringtable.json"


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "lol-db-probe"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    st = get_json(STRINGTABLE_URL)
    entries = st.get("entries", st)
    for k in ("generatedtip_item_2520_externaldescription", "item_2520_tooltip",
              "item_2520_tooltipextended"):
        print(f"--- {k} ---")
        print(entries.get(k, "(なし)"))
        print()

    bin_data = get_json(f"{CD}/game/items.cdtb.bin.json")
    for key in ("Items/2520", "Items/222520"):
        e = bin_data.get(key)
        if not e:
            continue
        print(f"===== {key} =====")
        print("price:", e.get("price"))
        print("mDataValues:")
        print(json.dumps(e.get("mDataValues"), ensure_ascii=False, indent=1))
        print("mItemCalculations:")
        print(json.dumps(e.get("mItemCalculations"), ensure_ascii=False, indent=1))
        # スペル側にダメージが定義されている可能性（mSpellObject など）
        for k in e:
            if "spell" in k.lower() or "effect" in k.lower():
                print(f"  {k}: {json.dumps(e[k], ensure_ascii=False)[:400]}")
        print()

    # スペル bin にダメージが載っている場合を探す
    spell_keys = [k for k in bin_data if "2520" in k and ("spell" in k.lower() or "buff" in k.lower())]
    print("2520関連スペル/バフキー:", spell_keys)
    for k in spell_keys[:4]:
        print(f"----- {k} -----")
        print(json.dumps(bin_data[k], ensure_ascii=False, indent=1)[:3000])
        print()


if __name__ == "__main__":
    main()
