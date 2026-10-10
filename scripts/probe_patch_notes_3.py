#!/usr/bin/env python3
"""調査プローブ(第3段): richText.body（65KBのHTML文字列）の中の見出し構造を
確認し、チャンピオン名が見出しタグとして安定して出現するか確認する。

第2段で判明: 記事本文は __NEXT_DATA__.props.pageProps.page.blades[2].richText.body
という1つの巨大なHTML文字列で、構造化JSONではない。ここでは生HTMLとして
見出しタグ（h1〜h4）を全部拾い、K'Santeが見出しとして（本文中の言及ではなく）
出現するか、出現するならその直後の段落に意図説明の文章が続くかを確認する。
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


html = get(ARTICLE_URL)
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
body = data["props"]["pageProps"]["page"]["blades"][2]["richText"]["body"]
print(f"richText.body: {len(body)} 文字")

section("見出しタグ(h1〜h4)を全部出す（最初の80件）")
headings = re.findall(r'<h([1-4])[^>]*>(.*?)</h\1>', body, re.S)
print(f"見出し総数: {len(headings)}")
for lvl, text in headings[:80]:
    plain = re.sub(r"<[^>]+>", "", text).strip()
    print(f"  h{lvl}: {plain}")

section("K'Sante の全出現箇所（本文中・何個あるか）")
occurrences = [mm.start() for mm in re.finditer(r"K.Sante", body)]
print(f"K'Sante 出現回数: {len(occurrences)}")
for i, idx in enumerate(occurrences):
    print(f"\n--- 出現 {i+1} (位置{idx}) ---")
    # 直前の見出しタグを探す
    preceding = body[:idx]
    last_heading = None
    for hm in re.finditer(r'<h([1-4])[^>]*>(.*?)</h\1>', preceding, re.S):
        last_heading = (hm.group(1), re.sub(r"<[^>]+>", "", hm.group(2)).strip())
    print(f"直前の見出し: {last_heading}")
    snippet = body[max(0, idx - 300):idx + 900]
    plain = re.sub(r"<[^>]+>", " ", snippet)
    plain = re.sub(r"\s+", " ", plain).strip()
    print(f"周辺テキスト: {plain}")

section("'buff'や'nerf'に関連しそうな強弱アイコン/クラス名の手がかり")
# Riotの公式パッチノートはチャンピオン毎にbuff/nerfアイコンをCSSクラスで
# 表現していることがあるため、クラス名のパターンを探す
classes = re.findall(r'class="([^"]*(?:buff|nerf|adjust|rework|bugfix)[^"]*)"', body, re.I)
uniq_classes = list(dict.fromkeys(classes))
print(f"buff/nerf系クラス名候補: {len(uniq_classes)}件")
for c in uniq_classes[:20]:
    print(f"  {c}")
