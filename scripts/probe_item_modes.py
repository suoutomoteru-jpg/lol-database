#!/usr/bin/env python3
"""調査プローブ: Cloudflare Pages配信中のsw.jsが最新ビルドを指しているか確認する

vite-plugin-pwa (workbox) の生成物 sw.js には、プリキャッシュするファイルの
リビジョン（ビルド内容ハッシュ）が埋め込まれる。配信中のindex.htmlが読み込む
エントリJSのファイル名が、sw.jsのプリキャッシュリストに含まれていれば、
Cloudflare側は最新ビルドを正しく配信していると確認できる
（＝「Cloudflareが古い」ではなく、PWAインスタンス側が未リロードという話になる）。
"""
import re
import urllib.request

SITE = "https://nunune.pages.dev"

def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "probe"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace"), dict(r.headers)

html, html_headers = get(SITE + "/")
entry = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
print(f"index.html entry js: {entry.group(1) if entry else '(なし)'}")
print(f"index.html cache-control: {html_headers.get('cache-control')} / cf-cache-status: {html_headers.get('cf-cache-status')}")

try:
    sw, sw_headers = get(SITE + "/sw.js")
    print(f"\nsw.js取得OK（{len(sw)}文字）")
    print(f"sw.js cache-control: {sw_headers.get('cache-control')} / cf-cache-status: {sw_headers.get('cf-cache-status')}")
    if entry:
        fname = entry.group(1).split('/')[-1]
        print(f"sw.jsのプリキャッシュに{fname}が含まれるか: {'○ 含まれる' if fname in sw else '× 含まれない（古いSW）'}")
    print("registerType/autoUpdate関連の記述:", "見つかった" if "skipWaiting" in sw or "clientsClaim" in sw else "見当たらない")
except Exception as e:
    print(f"\nsw.js取得失敗: {e}")

try:
    manifest, _ = get(SITE + "/manifest.webmanifest")
    print(f"\nmanifest.webmanifest: {manifest[:300]}")
except Exception as e:
    print(f"\nmanifest取得失敗（別名の可能性）: {e}")
