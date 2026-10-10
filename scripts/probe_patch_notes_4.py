#!/usr/bin/env python3
"""調査プローブ(第4段): 日本語版(ja-jp)のパッチノート記事が存在し、
英語版と同じ見出し構造（h2 Champions > h3 チャンピオン名 > h4 スキル名）を
持つか確認する。nunune.ggは日本語ユーザー向けのため、表示するなら
日本語版が望ましい。
"""
import json
import re
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}
EN_URL = "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes"
JA_URL = "https://www.leagueoflegends.com/ja-jp/news/game-updates/league-of-legends-patch-26-20-notes"


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace"), r.status


def section(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


section("日本語版記事の存在確認")
try:
    html, status = get(JA_URL)
    print(f"status={status}, 文字数={len(html)}")
except urllib.error.HTTPError as e:
    print(f"HTTPエラー: {e.code}")
    html = ""
except Exception as e:
    print(f"取得失敗: {e}")
    html = ""

if html:
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if m:
        data = json.loads(m.group(1))
        try:
            body = data["props"]["pageProps"]["page"]["blades"][2]["richText"]["body"]
            print(f"richText.body: {len(body)} 文字")

            headings = re.findall(r'<h([1-4])[^>]*>(.*?)</h\1>', body, re.S)
            print(f"見出し総数: {len(headings)}")
            # Championsセクション配下だけ抜き出す
            in_champions = False
            shown = 0
            for lvl, text in headings:
                plain = re.sub(r"<[^>]+>", "", text).strip()
                if lvl == "2":
                    in_champions = (plain == "チャンピオン" or "champion" in plain.lower() or "チャンピオン" in plain)
                    print(f"  [h2] {plain}  (Championsセクション={in_champions})")
                elif in_champions and lvl == "3" and shown < 20:
                    print(f"    h3: {plain}")
                    shown += 1

            idx = body.find("カ・サンテ")
            if idx == -1:
                idx = body.find("K'Sante")
            if idx == -1:
                idx = body.lower().find("ksante")
            if idx >= 0:
                preceding = body[:idx]
                last_heading = None
                for hm in re.finditer(r'<h([1-4])[^>]*>(.*?)</h\1>', preceding, re.S):
                    last_heading = (hm.group(1), re.sub(r"<[^>]+>", "", hm.group(2)).strip())
                print(f"\nカ・サンテ/K'Sante 発見位置{idx}、直前の見出し: {last_heading}")
                snippet = body[max(0, idx - 100):idx + 700]
                plain = re.sub(r"<[^>]+>", " ", snippet)
                plain = re.sub(r"\s+", " ", plain).strip()
                print(f"周辺テキスト: {plain}")
            else:
                print("\nカ・サンテ/K'Sante がこの記事に見つからない")
        except KeyError as e:
            print(f"期待した構造が無い: {e}")
    else:
        print("__NEXT_DATA__ が見つからない")
