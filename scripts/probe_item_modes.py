#!/usr/bin/env python3
"""調査プローブ: nunune.gg のネームサーバー状態（Cloudflare移行が3日進まない件）"""
import json
import urllib.request

def doh(name: str, rtype: str):
    url = f"https://dns.google/resolve?name={name}&type={rtype}"
    req = urllib.request.Request(url, headers={"User-Agent": "probe"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

for rtype in ("NS", "DS", "SOA", "A"):
    d = doh("nunune.gg", rtype)
    print(f"=== {rtype} === Status={d.get('Status')}")
    for a in d.get("Answer", []) or d.get("Authority", []) or []:
        print("  ", a.get("type"), a.get("data"))
    print()
# .gg レジストリの委任情報（親ゾーンから見たNS）
d = doh("nunune.gg", "NS")
print("Comment:", d.get("Comment", ""))
