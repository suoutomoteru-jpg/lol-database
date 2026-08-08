#!/usr/bin/env python3
"""
CommunityDragon のゲーム内ストリングテーブル（ツールチップ全文）を探すプローブ

/json/ のディレクトリ一覧APIで game/ 配下を再帰的に歩き、
stringtable / fontconfig / menu 系のファイルを探す。
"""

import json
import urllib.request

BASE = "https://raw.communitydragon.org/json/latest"
UA = {"User-Agent": "lol-database-asset-probe/2.0"}

FILE_KEYWORDS = ("stringtable", "fontconfig", "trans", "main_")


def listing(path: str):
    req = urllib.request.Request(f"{BASE}/{path}/", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def walk(path: str, depth: int, max_children: int = 40):
    try:
        entries = listing(path)
    except Exception as e:
        print(f"{path}/ … (取得失敗) {e}")
        return
    files = [e["name"] for e in entries if e.get("type") == "file"]
    dirs = [e["name"] for e in entries if e.get("type") == "directory"]

    hits = [f for f in files if any(k in f.lower() for k in FILE_KEYWORDS)]
    if hits:
        print(f"★ {path}/ に一致: {hits}")
    else:
        print(f"{path}/  files={len(files)} dirs={dirs[:12]}{'…' if len(dirs) > 12 else ''}")

    if depth <= 0:
        return
    for d in dirs[:max_children]:
        walk(f"{path}/{d}", depth - 1)


def main():
    # ゲーム本体側（ロケール別ディレクトリの有無も確認）
    print("=== game/ 直下 ===")
    walk("game", 0)
    for root in ("game/ja_jp", "game/en_us", "game/data/menu", "game/ja_jp/data"):
        print(f"\n=== {root} 以下（深さ3）===")
        walk(root, 3)


if __name__ == "__main__":
    main()
