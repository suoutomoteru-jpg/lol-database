#!/usr/bin/env python3
"""調査プローブ: 「パッチハイライト」h2セクション全体（次のh2まで）を
ちゃんと最後まで見て、その中の画像(img)をすべて洗い出す。

反省点: 前回はbody.find("パッチハイライト")の直後2000文字しか見ておらず、
スキルVOのニュース文で打ち切ってしまっていた（ユーザー指摘により判明）。
「パッチハイライト」h2は複数の話題（スキン情報＋バフ/ナーフ画像等）を
まとめて含む1セクションの可能性が高いため、次のh2が出るまで全部読む。
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
body = data["props"]["pageProps"]["page"]["blades"][2]["richText"]["body"]

# h2見出しを全部拾い、「パッチハイライト」のh2タグそのものを探す
h2_matches = list(re.finditer(r'<h2[^>]*>(.*?)</h2>', body, re.S))
section("本文中の全h2見出し")
for hm in h2_matches:
    print(" ", re.sub(r"<[^>]+>", "", hm.group(1)).strip())

target = None
for i, hm in enumerate(h2_matches):
    text = re.sub(r"<[^>]+>", "", hm.group(1)).strip()
    if "パッチハイライト" in text:
        target = i
        break

if target is None:
    print("\n'パッチハイライト' のh2が見つからない")
else:
    start = h2_matches[target].end()
    end = h2_matches[target + 1].start() if target + 1 < len(h2_matches) else len(body)
    full_section = body[start:end]
    section(f"パッチハイライトセクション全体: {len(full_section)} 文字")

    imgs = re.findall(r'<img[^>]+src="([^"]+)"[^>]*>', full_section)
    print(f"imgタグ数: {len(imgs)}")
    for u in imgs:
        print(f"  {u}")

    # alt属性も見る（キャラ名が入っているかもしれない）
    img_tags_full = re.findall(r'<img[^>]+>', full_section)
    section("imgタグの完全な中身（alt等の属性を見るため、最初の10個）")
    for t in img_tags_full[:10]:
        print(" ", t)

    section("セクション全体のプレーンテキスト（タグ除去）")
    plain = re.sub(r"<[^>]+>", " ", full_section)
    plain = re.sub(r"\s+", " ", plain).strip()
    print(plain[:3000])
