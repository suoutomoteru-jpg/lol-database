#!/usr/bin/env python3
"""アイテムデータ調査プローブ #3: stringtable のアイテム説明テンプレート

items.cdtb.bin の mDataValues / mItemCalculations は取得できた。
残る問題は「説明文のどのスロットにどの変数が入るか」。
ja stringtable の generatedtip_item_* テンプレートに @Var@ 形式で
残っているはずなので、その存在と形式を確認する。
"""
import json
import re
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
    print(f"=== stringtable entries: {len(entries)} ===")

    gen_item = [k for k in entries if k.startswith("generatedtip_item_")]
    print(f"generatedtip_item_* keys: {len(gen_item)}")

    # 対象アイテムのテンプレート全文
    for iid in ["2525", "3040", "4011", "4637"]:
        keys = sorted(k for k in entries if f"item_{iid}_" in k)
        print(f"\n===== item {iid}: {len(keys)} keys =====")
        for k in keys:
            v = entries[k]
            print(f"--- {k} ---")
            print(v[:1200])
            print()

    # items.bin の SR 2525 の計算式（前回途切れた部分）
    bin_data = get_json(f"{CD}/game/items.cdtb.bin.json")
    e = bin_data.get("Items/2525", {})
    print("===== Items/2525 mDataValues / mItemCalculations =====")
    print(json.dumps({
        "mDataValues": e.get("mDataValues"),
        "mItemCalculations": e.get("mItemCalculations"),
        "mItemDataClient_keys": (e.get("mItemDataClient") or {}).get("mDescription"),
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
