#!/usr/bin/env python3
"""調査プローブ: 「全アイテムにARAMタグが付く」不具合の原因を特定する

frontend/src/app/api/dataDragon.ts の isAram 判定
  (maps['12'] === true) && (maps['21'] !== true)
が、現在のDDragonデータに対してどう評価されるか実測する。
"""
import json
import urllib.request

UA = {"User-Agent": "nunune-probe/1.0"}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


versions = get_json("https://ddragon.leagueoflegends.com/api/versions.json")
version = versions[0]
print(f"version: {version}")

data = get_json(f"https://ddragon.leagueoflegends.com/cdn/{version}/data/ja_JP/item.json")["data"]
print(f"total items in item.json: {len(data)}")


def is_canonical(item_id):
    return int(item_id) < 100000


canonical = {
    id_: item for id_, item in data.items()
    if is_canonical(id_)
    and item.get("gold", {}).get("purchasable")
    and item["gold"]["total"] >= 2000
    and item.get("maps", {}).get("11") is True
    and not item.get("requiredChampion")
    and item.get("inStore") is not False
}
print(f"canonical SR items (fetchItemList filter, pre-isAram): {len(canonical)}")

aram_true = 0
map12_true = 0
map21_true = 0
map21_present = 0
samples = []
for id_, item in canonical.items():
    maps = item.get("maps", {})
    m12 = maps.get("12")
    m21 = maps.get("21")
    if m12 is True:
        map12_true += 1
    if "21" in maps:
        map21_present += 1
    if m21 is True:
        map21_true += 1
    is_aram = (m12 is True) and (m21 is not True)
    if is_aram:
        aram_true += 1
    if len(samples) < 8:
        samples.append((item["name"], maps))

print(f"maps['12'] === true: {map12_true} / {len(canonical)}")
print(f"maps has key '21' at all: {map21_present} / {len(canonical)}")
print(f"maps['21'] === true: {map21_true} / {len(canonical)}")
print(f"=> isAram would be True for: {aram_true} / {len(canonical)}")

print("\nsample maps dicts:")
for name, maps in samples:
    print(f"  {name}: {maps}")
