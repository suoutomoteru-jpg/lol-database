#!/usr/bin/env python3
"""調査プローブ: 複数の候補URLを比較し、どれが最新ビルドかを特定する

過去に誤作成した Cloudflare Workers 版が生きたまま残っていて、
ユーザーがブックマーク/検索結果からそちらを開いている可能性を検証する。
"""
import re
import urllib.request
import urllib.error

CANDIDATES = [
    "https://nunune.pages.dev",
    "https://nunune.suoutomoteru.workers.dev",
]

def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "probe"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace"), dict(r.headers), r.status

for site in CANDIDATES:
    print(f"\n== {site} ==")
    try:
        html, headers, status = get(site + "/")
    except urllib.error.HTTPError as e:
        print(f"HTTPエラー: {e.code}")
        continue
    except urllib.error.URLError as e:
        print(f"接続不可（DNS未解決/プロジェクト削除済みの可能性）: {e.reason}")
        continue
    print(f"status: {status}")
    title = re.search(r"<title>([^<]*)</title>", html)
    print(f"title: {title.group(1) if title else '(なし)'}")
    entry = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
    print(f"entry js: {entry.group(1) if entry else '(なし)'}")
    print(f"cache-control: {headers.get('cache-control')} / cf-cache-status: {headers.get('cf-cache-status')} / server: {headers.get('server')}")
    if entry:
        try:
            js, _, _ = get(site + entry.group(1))
            has_panel = "アイテムをえらぶ" in js
            print(f"QuickSwitchPanelマーカー: {'○ あり（新版）' if has_panel else '× なし（旧版）'}")
        except Exception as e:
            print(f"JS取得失敗: {e}")
