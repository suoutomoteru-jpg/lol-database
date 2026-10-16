#!/usr/bin/env python3
"""調査プローブ(第6段): 「パッチハイライト」セクション（ナーフ/バフで
チャンピオンアイコンが分類表示される公式ウィジェット）のデータ構造を
確認する。

ユーザー提供のスクリーンショットで、26.20のパッチハイライトに
「ナーフ: アンベッサ/アッシュ/カシオペア/カ・サンテ/ユナラ」
「バフ: ダイアナ/ケネン/キンドレッド/リリア/ルシアン/モルデカイザー/
ニーコ/スモルダー/スウェイン/タム・ケンチ/ヴェイン」という
公式の分類が確認できた。これがrichText.bodyの生HTMLの一部なのか、
それとも__NEXT_DATA__内の別の構造化フィールド（ウィジェット的に
レンダリングされるもの）なのかを確認する。構造化データとして
取れるなら、自前のバフ/ナーフ推定ロジックより遥かに正確で楽になる。
"""
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}
EN_URL = "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes"
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

section("page直下のキー一覧（blades以外にも何かあるか）")
print(list(page.keys()))

section("blades の一覧（各bladeの型とキー）")
blades = page.get("blades", [])
for i, b in enumerate(blades):
    if isinstance(b, dict):
        print(f"blade[{i}]: keys={list(b.keys())}")
    else:
        print(f"blade[{i}]: type={type(b).__name__}")

section("キー名に highlight/nerf/buff/tier/role/difficulty を含む箇所を全探索")


def walk(obj, path="root", depth=0, max_depth=8):
    if depth > max_depth:
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if any(w in lk for w in ("highlight", "nerf", "buff", "tier", "role", "difficulty", "lane", "lower", "raise")):
                kind = type(v).__name__
                length = len(v) if isinstance(v, (list, str, dict)) else "-"
                print(f"  {path}.{k}  ({kind}, len={length})")
                if isinstance(v, (list, dict)) and length != "-" and length < 40:
                    print(f"    値: {json.dumps(v, ensure_ascii=False)[:800]}")
            walk(v, f"{path}.{k}", depth + 1, max_depth)
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:5]):
            walk(v, f"{path}[{i}]", depth + 1, max_depth)


walk(page)

section("richText.body内に「ナーフ」「バフ」「パッチハイライト」の文字列があるか")
try:
    body = page["blades"][2]["richText"]["body"]
    for word in ("パッチハイライト", "ナーフ", "バフ（強化）", "弱体化"):
        idx = body.find(word)
        print(f"'{word}': {'位置' + str(idx) if idx >= 0 else '見つからない'}")
    # パッチハイライト見出し直後のHTMLを生で見る
    idx = body.find("パッチハイライト")
    if idx >= 0:
        print("\nパッチハイライト直後2000文字（生HTML）:")
        print(body[idx:idx + 2000])
except Exception as e:
    print(f"richText調査失敗: {e}")
