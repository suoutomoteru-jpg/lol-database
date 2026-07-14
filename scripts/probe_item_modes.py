#!/usr/bin/env python3
"""モード限定アイテム調査プローブ

「ゼファー」「ギャンブラーの剣」など現サモナーズリフト（ドラフト）に
存在しないはずのアイテムが SR アイテムとして表示される問題の調査用。

出力:
  1. 対象アイテムの DDragon エントリ全文（maps / inStore / tags）
  2. map11=true かつ 2000G以上 の全アイテムの maps フラグ一覧
  3. CDragon items.json の対象エントリ（モード情報フィールドの有無を確認）
"""
import json
import urllib.request

DD = "https://ddragon.leagueoflegends.com"
CD = "https://raw.communitydragon.org/latest"
TARGET_NAMES = ["ゼファー", "ギャンブラーの剣"]


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "lol-db-probe"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    version = get_json(f"{DD}/api/versions.json")[0]
    print(f"=== DDragon version: {version} ===\n")

    items = get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]

    print("=== 1. 対象アイテムの DDragon エントリ ===")
    target_ids = []
    for iid, it in items.items():
        if it.get("name") in TARGET_NAMES:
            target_ids.append(iid)
            slim = {k: it.get(k) for k in
                    ("name", "maps", "inStore", "tags", "gold", "requiredChampion", "depth")}
            print(f"--- id={iid}")
            print(json.dumps(slim, ensure_ascii=False, indent=1))
    if not target_ids:
        print("!! 対象アイテムが見つからない（名前変更の可能性）")

    print("\n=== 2. map11 & 2000G以上 の全アイテム maps フラグ ===")
    for iid, it in sorted(items.items(), key=lambda kv: kv[1]["name"]):
        g = it.get("gold", {})
        maps = it.get("maps", {})
        if not (g.get("purchasable") and g.get("total", 0) >= 2000):
            continue
        if not maps.get("11"):
            continue
        if it.get("requiredChampion") or it.get("inStore") is False:
            continue
        flags = ",".join(sorted(k for k, v in maps.items() if v))
        print(f"{iid}\t{it['name']}\tmaps=[{flags}]")

    print("\n=== 3. CDragon items.json の対象エントリ（全フィールド）===")
    try:
        cd_items = get_json(f"{CD}/plugins/rcp-be-lol-game-data/global/ja_jp/v1/items.json")
        for entry in cd_items:
            if entry.get("name") in TARGET_NAMES or str(entry.get("id")) in target_ids:
                print(json.dumps(entry, ensure_ascii=False, indent=1))
    except Exception as e:  # noqa: BLE001
        print(f"CDragon fetch failed: {e}")


if __name__ == "__main__":
    main()
