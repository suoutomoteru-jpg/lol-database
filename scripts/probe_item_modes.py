#!/usr/bin/env python3
"""調査プローブ: nunune.gg の登録状態（RDAP）"""
import urllib.request

for url in ("https://rdap.org/domain/nunune.gg",
            "https://rdap.channelisles.net/domain/nunune.gg"):
    print(f"=== {url} ===")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "probe", "Accept": "application/rdap+json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            print("HTTP", r.status)
            print(r.read().decode()[:1500])
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, "-", "404 = 未登録（ドメインが存在しない）" if e.code == 404 else e.reason)
    except Exception as e:
        print("失敗:", e)
    print()
