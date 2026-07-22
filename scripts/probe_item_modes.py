#!/usr/bin/env python3
"""調査プローブ: ドメイン価格（Porkbun公開価格API・認証不要）"""
import json
import urllib.request

req = urllib.request.Request(
    "https://api.porkbun.com/api/json/v3/pricing/get",
    headers={"User-Agent": "probe"})
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.loads(r.read().decode())

pricing = data.get("pricing", {})
CANDIDATES = ["gg", "com", "net", "org", "jp", "app", "dev", "io",
              "games", "wiki", "moe", "gs", "info", "me", "lol", "xyz"]
print(f"TLD数: {len(pricing)}（USD/年）")
print(f"{'TLD':8s} {'登録':>8s} {'更新':>8s}")
for tld in CANDIDATES:
    p = pricing.get(tld)
    if p:
        print(f".{tld:7s} {p.get('registration','?'):>8s} {p.get('renewal','?'):>8s}")
    else:
        print(f".{tld:7s} {'取扱なし':>8s}")
