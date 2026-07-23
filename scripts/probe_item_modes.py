#!/usr/bin/env python3
"""調査プローブ: nunune.pages.dev にライブ配信中のビルドを特定する

index.html のタイトル・canonical・エントリJSのハッシュと、
遅延チャンク（ItemDetail）内の新機能マーカーの有無を確認し、
どのコミット時点のビルドが配信されているかを推定する。
"""
import re
import urllib.request

SITE = "https://nunune.pages.dev"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "probe"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="replace"), dict(r.headers)

html, headers = get(SITE + "/")
print("== index.html ==")
for pat, name in [
    (r"<title>([^<]*)</title>", "title"),
    (r'rel="canonical" href="([^"]+)"', "canonical"),
    (r'property="og:url" content="([^"]+)"', "og:url"),
]:
    m = re.search(pat, html)
    print(f"{name}: {m.group(1) if m else '(なし)'}")
print("age:", headers.get("age"), "/ cf-cache-status:", headers.get("cf-cache-status"))

entry = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
print("entry js:", entry.group(1) if entry else "(なし)")

markers = {
    "アイテムをえらぶ": "QuickSwitchPanel（今回追加）",
    "が得られるアイテムを見る": "ステータス行タップ（従来から＝検査自体の妥当性確認）",
}

if entry:
    js, _ = get(SITE + entry.group(1))
    # 遅延チャンクのファイル名を拾って全部検査する
    chunks = sorted(set(re.findall(r'assets/[A-Za-z]+-[\w-]+\.js', js)))
    print(f"chunks: {len(chunks)}")
    blob = js
    for c in chunks:
        try:
            body, _ = get(f"{SITE}/{c}")
            blob += body
        except Exception as e:
            print(f"  {c}: 取得失敗 {e}")
    print("\n== 新機能マーカー ==")
    for needle, desc in markers.items():
        print(f"{'○' if needle in blob else '×'} {desc}: {needle!r}")
    m = re.search(r'ItemDetail-[\w-]+\.js', js)
    print("ItemDetail chunk:", m.group(0) if m else "(なし)")
