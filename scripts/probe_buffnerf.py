#!/usr/bin/env python3
"""調査プローブ(第5段): K'Sante Wのマナコスト変更行まわりの「生の」HTMLを
確認し、公式がバフ/ナーフを示すアイコン・色分け・class等を使っているか
確認する（前段のクラス名検索は 'buff|nerf|adjust|rework|bugfix' という
単語限定だったため、アイコン画像・絵文字・色クラス(例: text-red-500)等を
見落としている可能性がある）。
"""
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}
EN_URL = "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes"


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def section(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


html = get(EN_URL)
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
body = data["props"]["pageProps"]["page"]["blades"][2]["richText"]["body"]

section("K'Sante の h3 見出し位置を特定し、そこから2500文字の生HTMLをダンプ")
# h3 K'Sante を直接探す（タグごと）
hm = re.search(r'<h3[^>]*>\s*K.Sante\s*</h3>', body)
if hm:
    start = hm.start()
    raw = body[start:start + 2500]
    print(raw)
else:
    print("h3 K'Sante タグが見つからない。見出し一覧を出す")
    for mm in re.finditer(r'<h3[^>]*>(.*?)</h3>', body):
        print(" ", re.sub(r"<[^>]+>", "", mm.group(1)).strip())

section("svg/img/絵文字/色クラスらしきものの手がかり（記事全体）")
print("svgタグ数:", len(re.findall(r"<svg", body)))
print("imgタグ数:", len(re.findall(r"<img", body)))
# 矢印記号・色を示す可能性のあるUnicode文字
for ch, name in [("↑", "↑"), ("↓", "↓"), ("▲", "▲"), ("▼", "▼"),
                  ("\U0001F7E2", "🟢"), ("\U0001F534", "🔴"), ("➕", "➕"), ("➖", "➖")]:
    cnt = body.count(ch)
    if cnt:
        print(f"{name} の出現回数: {cnt}")
style_classes = re.findall(r'class="([^"]*)"', body)
color_like = [c for c in style_classes if re.search(r"(red|green|positive|negative|increase|decrease|up|down)", c, re.I)]
uniq_color = list(dict.fromkeys(color_like))
print(f"\n色/増減を示唆するclass候補: {len(uniq_color)}件")
for c in uniq_color[:20]:
    print(" ", c)
