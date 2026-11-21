#!/usr/bin/env python3
"""調査プローブ(最終段): チャンピオン毎のセクション文章に「強化」「弱体化」
「調整」等のキーワードが直接含まれているか確認する。含まれていれば、
数値の増減から自前でバフ/ナーフを推測するより、本文のキーワードを
そのまま分類に使う方が確実で簡単。

対象: 26.20のナーフ組(アンベッサ/アッシュ/カシオペア/カ・サンテ/ユナラ)
     バフ組(ダイアナ/ケネン/キンドレッド/リリア/ルシアン/モルデカイザー/
            ニーコ/スモルダー/スウェイン/タム・ケンチ/ヴェイン)
     （ユーザー提供スクリーンショットの公式分類と照合する）
"""
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}
JA_URL = "https://www.leagueoflegends.com/ja-jp/news/game-updates/league-of-legends-patch-26-20-notes"

NERF_CHAMPS = ["アンベッサ", "アッシュ", "カシオペア", "カ・サンテ", "ユナラ"]
BUFF_CHAMPS = ["ダイアナ", "ケネン", "キンドレッド", "リリア", "ルシアン",
               "モルデカイザー", "ニーコ", "スモルダー", "スウェイン",
               "タム・ケンチ", "ヴェイン"]

KEYWORDS = ["強化", "弱体化", "調整", "改善", "修正", "ナーフ", "バフ"]


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


html = get(JA_URL)
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
body = data["props"]["pageProps"]["page"]["blades"][2]["richText"]["body"]

headings = list(re.finditer(r'<h([1-4])[^>]*>(.*?)</h\1>', body, re.S))


def section_text_for(champ_name: str) -> str | None:
    """チャンピオン名のh3見出しを探し、次のh2/h3見出しまでの本文を返す"""
    target_idx = None
    for i, hm in enumerate(headings):
        lvl = hm.group(1)
        text = re.sub(r"<[^>]+>", "", hm.group(2)).strip()
        if lvl == "3" and text == champ_name:
            target_idx = i
            break
    if target_idx is None:
        return None
    start = headings[target_idx].end()
    end = len(body)
    for hm in headings[target_idx + 1:]:
        if hm.group(1) in ("2", "3"):
            end = hm.start()
            break
    raw = body[start:end]
    plain = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", plain).strip()


def classify(text: str) -> list[str]:
    return [kw for kw in KEYWORDS if kw in text]


print("=" * 70)
print("ナーフ組（公式分類）の本文キーワード照合")
print("=" * 70)
correct = 0
total = 0
for champ in NERF_CHAMPS:
    text = section_text_for(champ)
    if text is None:
        print(f"{champ}: セクションが見つからない")
        continue
    hits = classify(text)
    print(f"\n{champ}: キーワード={hits}")
    print(f"  冒頭200文字: {text[:200]}")
    total += 1
    if "弱体化" in hits:
        correct += 1

print("\n" + "=" * 70)
print("バフ組（公式分類）の本文キーワード照合")
print("=" * 70)
for champ in BUFF_CHAMPS:
    text = section_text_for(champ)
    if text is None:
        print(f"{champ}: セクションが見つからない")
        continue
    hits = classify(text)
    print(f"\n{champ}: キーワード={hits}")
    print(f"  冒頭200文字: {text[:200]}")
    total += 1
    if "強化" in hits:
        correct += 1

print(f"\n\n一致率: {correct}/{total}")
