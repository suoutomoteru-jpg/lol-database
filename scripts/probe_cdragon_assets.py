#!/usr/bin/env python3
"""
CommunityDragon のロール/クラスアイコンの実パスを探すプローブ

/json/ プレフィックスのディレクトリ一覧APIで候補ディレクトリを列挙し、
role / class / position 系のファイル名を報告する。
"""

import json
import urllib.request

BASE = "https://raw.communitydragon.org/json/latest"
UA = {"User-Agent": "lol-database-asset-probe/1.0"}

CANDIDATE_DIRS = [
    "plugins/rcp-fe-lol-uikit/global/default/images",
    "plugins/rcp-fe-lol-static-assets/global/default/images",
    "plugins/rcp-fe-lol-static-assets/global/default/svg",
    "plugins/rcp-fe-lol-champion-details/global/default",
    "plugins/rcp-fe-lol-champ-select/global/default/images",
    "plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions",
]

KEYWORDS = ("role", "class", "position", "assassin", "marksman", "mage", "fighter", "tank", "support")


def listing(path: str):
    req = urllib.request.Request(f"{BASE}/{path}/", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def main():
    for d in CANDIDATE_DIRS:
        print(f"\n=== {d}/")
        try:
            entries = listing(d)
        except Exception as e:
            print(f"  (取得失敗) {e}")
            continue
        dirs  = [e["name"] for e in entries if e.get("type") == "directory"]
        files = [e["name"] for e in entries if e.get("type") == "file"]
        hit_dirs  = [n for n in dirs  if any(k in n.lower() for k in KEYWORDS)]
        hit_files = [n for n in files if any(k in n.lower() for k in KEYWORDS)]
        print(f"  dirs: {hit_dirs if hit_dirs else dirs[:15]}")
        print(f"  files(hit): {hit_files[:30]}")
        # ヒットしたサブディレクトリは1階層だけ潜って中身も出す
        for sub in hit_dirs[:4]:
            try:
                sub_entries = listing(f"{d}/{sub}")
                names = [e["name"] for e in sub_entries if e.get("type") == "file"]
                print(f"    {sub}/: {names[:30]}")
            except Exception as e:
                print(f"    {sub}/: (取得失敗) {e}")


if __name__ == "__main__":
    main()
