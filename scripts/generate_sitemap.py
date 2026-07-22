#!/usr/bin/env python3
"""sitemap.xml 生成

生成済みツールチップの index.json（チャンピオン一覧）と DDragon の item.json
（フロントエンドと同じ絞り込み: 正規ID・購入可能・2000G以上・SR）から
全ページのURLを列挙する。

実行方法:
    python3 scripts/generate_sitemap.py --tooltips frontend/public/tooltips \
        --out frontend/public/sitemap.xml
    環境変数 SITE_URL でベースURLを変更可能（既定 https://nunune.pages.dev）
"""

import argparse
import datetime
import json
import os
import sys
import urllib.request

DD = "https://ddragon.leagueoflegends.com"
UA = {"User-Agent": "lol-database-sitemap/1.0"}


def get_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def canonical_item_ids() -> list[str]:
    """フロントエンドの一覧と同じ条件のアイテムID（SR完成アイテム＋ARAM）"""
    version = get_json(f"{DD}/api/versions.json")[0]
    items = get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]

    def ok(iid: str, it: dict, map_key: str, other_map_false: str | None) -> bool:
        g = it.get("gold", {})
        maps = it.get("maps", {})
        return (
            int(iid) < 100000  # 6桁IDはモード限定バリアント
            and g.get("purchasable")
            and g.get("total", 0) >= 2000
            and maps.get(map_key) is True
            and (other_map_false is None or maps.get(other_map_false) is not True)
            and not it.get("requiredChampion")
            and it.get("inStore") is not False
        )

    picked: dict[str, str] = {}  # name -> 最小ID（フロントの重複排除と同じ）
    for iid, it in items.items():
        if ok(iid, it, "11", None) or ok(iid, it, "12", "11"):
            prev = picked.get(it["name"])
            if prev is None or int(iid) < int(prev):
                picked[it["name"]] = iid
    return sorted(picked.values(), key=int)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tooltips", required=True, help="tooltips ディレクトリ（index.json）")
    ap.add_argument("--out", required=True, help="出力先 sitemap.xml")
    args = ap.parse_args()

    base = os.environ.get("SITE_URL", "https://nunune.pages.dev").rstrip("/")
    today = datetime.date.today().isoformat()

    with open(f"{args.tooltips}/index.json", encoding="utf-8") as f:
        index = json.load(f)
    champions = [c["alias"] for c in index["champions"] if "alias" in c]

    item_ids = canonical_item_ids()

    urls = ["/", "/privacy"]
    urls += [f"/champion/{a}" for a in sorted(champions)]
    urls += [f"/item/{i}" for i in item_ids]

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        lines.append(f"  <url><loc>{base}{u}</loc><lastmod>{today}</lastmod></url>")
    lines.append("</urlset>")

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"sitemap: {len(urls)} URLs → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
