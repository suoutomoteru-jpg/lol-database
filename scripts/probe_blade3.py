#!/usr/bin/env python3
"""調査プローブ(第7段): blade[3]（header/items/layout構成）の中身を
ダンプする。前段の「キー名検索」はキー名に highlight/nerf/buff 等の
単語を含むものしか拾わなかったが、blade[3]は汎用的なキー名
（header/items/layout）のウィジェット構造をしており、値の中に
「パッチハイライト」やチャンピオン名＋カテゴリ（ナーフ/バフ）が
入っている可能性が高い。
"""
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}
JA_URL = "https://www.leagueoflegends.com/ja-jp/news/game-updates/league-of-legends-patch-26-20-notes"


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def section(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


html = get(JA_URL)
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
page = data["props"]["pageProps"]["page"]
blades = page["blades"]

section("blade[3] 全体をダンプ（最大8000文字）")
b3 = blades[3]
dumped = json.dumps(b3, ensure_ascii=False, indent=1)
print(f"全体サイズ: {len(dumped)} 文字")
print(dumped[:8000])

section("header の中身だけ単独で")
print(json.dumps(b3.get("header"), ensure_ascii=False, indent=1)[:1500])

section("items の件数と、先頭3件の構造")
items = b3.get("items", [])
print(f"items件数: {len(items)}")
for i, it in enumerate(items[:3]):
    print(f"\n--- items[{i}] ---")
    print(json.dumps(it, ensure_ascii=False, indent=1)[:1500])
