#!/usr/bin/env python3
"""調査プローブ: アイテム説明文<stats>ブロックの実際のマークアップ構造を確認する

frontend/src/app/pages/ItemDetail.tsx の splitStatLines() が
<attention>数値</attention> のようなタグ付き数値をどう処理しているか、
実データで再現できているかを検証する。
"""
import json
import re
import urllib.request

DD = "https://ddragon.leagueoflegends.com"

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "probe"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

version = get_json(f"{DD}/api/versions.json")[0]
data = get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]

SAMPLES = ["3031", "3068", "3153", "3078", "6653"]
for sid in SAMPLES:
    it = data.get(sid)
    if not it:
        continue
    desc = it["description"]
    m = re.search(r"<stats>([\s\S]*?)</stats>", desc, re.I)
    print(f"\n=== {sid} {it['name']} ===")
    print("raw <stats> block:")
    print(repr(m.group(1)) if m else "(なし)")
