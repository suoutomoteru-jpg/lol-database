#!/usr/bin/env python3
"""調査プローブ(第2段): __NEXT_DATA__ の構造化JSONの中身を見て、
チャンピオン単位で変更点テキストを安定して切り出せるか確認する。

前段のプローブで、記事ページ(Next.js)に __NEXT_DATA__ という埋め込み
JSON(115KB)があることが分かった。生HTMLへの文字列検索では「K'Sante」が
記事冒頭の概要文でしか見つからなかったため、本段ではJSONをパースして
構造（キャラ名をキーにしたブロックがあるか等）とK'Sante個別項目の有無を
確認する。
"""
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}
ARTICLE_URL = "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes"


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def section(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


section("記事取得")
html = get(ARTICLE_URL)
print(f"HTML: {len(html)} 文字")

m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
if not m:
    print("__NEXT_DATA__ が見つからない")
    raise SystemExit(0)

data = json.loads(m.group(1))
print(f"__NEXT_DATA__: {len(m.group(1))} 文字をパース成功")


def walk(obj, path="root", depth=0, max_depth=6):
    """キー名に手がかりがありそうな場所を探索（深さ制限つき）"""
    if depth > max_depth:
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if any(w in lk for w in ("champion", "patch", "content", "body", "blog", "article", "sections", "slices")):
                kind = type(v).__name__
                length = len(v) if isinstance(v, (list, str, dict)) else "-"
                print(f"  {path}.{k}  ({kind}, len={length})")
            walk(v, f"{path}.{k}", depth + 1, max_depth)
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:3]):  # 先頭3件だけ
            walk(v, f"{path}[{i}]", depth + 1, max_depth)


section("構造探索（キー名に 'champion/patch/content/body/article/sections/slices' を含む箇所）")
walk(data)

section("JSON全体の中から 'K'Sante' をテキスト検索")
raw = json.dumps(data, ensure_ascii=False)
idx = raw.find("K\\u2019Sante")
if idx == -1:
    idx = raw.find("K'Sante")
if idx == -1:
    idx = raw.lower().find("ksante")

if idx >= 0:
    print(f"見つかった位置: {idx} (JSON文字列中)")
    # 前後のJSON断片を出す（キー名が見えるように広めに）
    snippet = raw[max(0, idx - 600):idx + 1500]
    print("周辺のJSON断片:")
    print(snippet)
else:
    print("JSON全体を文字列化してもK'Santeが見つからない")
    # 記事中に出てくる既知チャンピオン名で代わりに探す（Ambessa, Kennen, Kindredは
    # イントロで言及されていた）
    for name in ("Ambessa", "Kennen", "Kindred"):
        idx2 = raw.find(name)
        if idx2 >= 0:
            print(f"\n代わりに '{name}' が見つかった（位置{idx2}）。周辺のJSON断片:")
            print(raw[max(0, idx2 - 400):idx2 + 1200])
            break
