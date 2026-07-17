#!/usr/bin/env python3
"""アイテムデータ調査プローブ（現在: プロトプラズムハーネス）

「プロトプラズムハーネスの数値が0ばかり」報告の調査用。
DDragon の stats オブジェクト・<stats>ブロック・説明文の実データを
そのまま出力し、フロント側のどの表示経路が0になるかを特定する。

出力:
  1. 名前に「プロトプラズム」を含む全アイテムの DDragon エントリ全文
  2. 同アイテムの en_US エントリ（英名確認）
  3. CDragon items.json の該当エントリ（DDragonに数値が無い場合の代替源確認）
"""
import json
import urllib.request

DD = "https://ddragon.leagueoflegends.com"
CD = "https://raw.communitydragon.org/latest"
NAME_SUBSTR = "プロトプラズム"


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "lol-db-probe"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    version = get_json(f"{DD}/api/versions.json")[0]
    print(f"=== DDragon version: {version} ===\n")

    items = get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]
    hits = {iid: it for iid, it in items.items() if NAME_SUBSTR in it.get("name", "")}
    print(f"=== ja_JP 「{NAME_SUBSTR}」該当: {len(hits)}件 ===")
    for iid, it in hits.items():
        print(f"\n----- id={iid} -----")
        print(json.dumps(it, ensure_ascii=False, indent=1))

    items_en = get_json(f"{DD}/cdn/{version}/data/en_US/item.json")["data"]
    for iid in hits:
        en = items_en.get(iid)
        print(f"\n=== en_US id={iid}: {en.get('name') if en else 'なし'} ===")
        if en:
            print(json.dumps({k: en.get(k) for k in ("name", "stats", "description")},
                             ensure_ascii=False, indent=1))

    try:
        cd_items = get_json(f"{CD}/plugins/rcp-be-lol-game-data/global/ja_jp/v1/items.json")
        cd_hits = [x for x in cd_items if NAME_SUBSTR in x.get("name", "")]
        print(f"\n=== CDragon 該当: {len(cd_hits)}件 ===")
        for x in cd_hits:
            print(json.dumps(x, ensure_ascii=False, indent=1))
    except Exception as e:  # noqa: BLE001
        print(f"CDragon取得失敗: {e}")


if __name__ == "__main__":
    main()
