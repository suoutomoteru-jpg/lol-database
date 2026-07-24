#!/usr/bin/env python3
"""基礎ステータス成長値の補完データ生成

DDragon はパッチ16.2〜16.5頃から全チャンピオンの attackdamageperlevel を
0 で輸出するリグレッションを起こしている（16.1.1 までは正常値）。
本スクリプトは「現行バージョンで大半のチャンピオンが0になっている
*perlevel フィールド」を検出し、過去バージョンを遡って最後に正常だった
値を stat-overrides.json として出力する。

フロントエンドは現行値が0のときのみこの補完値を使うため、
DDragon側が修正されれば自動的に現行値が優先される。

実行方法:
    python3 scripts/generate_stat_overrides.py --out frontend/public/tooltips
"""

import argparse
import json
import sys
import urllib.request

DD = "https://ddragon.leagueoflegends.com"
UA = {"User-Agent": "lol-database-stat-overrides/1.0"}

# 補完対象の成長値フィールド
GROWTH_FIELDS = [
    "hpperlevel", "mpperlevel", "armorperlevel", "spellblockperlevel",
    "attackdamageperlevel", "attackspeedperlevel",
    "hpregenperlevel", "mpregenperlevel",
]

# 「大半が0」とみなす閾値（マナなしチャンピオン等、正常な0も存在するため）
BROKEN_RATIO = 0.7


def get_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_stats(version: str) -> dict[str, dict]:
    data = get_json(f"{DD}/cdn/{version}/data/en_US/champion.json")["data"]
    return {cid: c["stats"] for cid, c in data.items()}


def zero_ratio(stats_map: dict[str, dict], field: str) -> float:
    vals = [s.get(field, 0) for s in stats_map.values()]
    if not vals:
        return 1.0
    return sum(1 for v in vals if not v) / len(vals)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    versions: list[str] = get_json(f"{DD}/api/versions.json")
    curr = versions[0]
    curr_stats = fetch_stats(curr)
    print(f"current: {curr} ({len(curr_stats)} champions)")

    # 現行で「大半が0」の成長値フィールド＝リグレッション疑い
    broken = [f for f in GROWTH_FIELDS if zero_ratio(curr_stats, f) >= BROKEN_RATIO]
    print(f"broken fields: {broken}")

    result = {"source": None, "generatedFrom": curr, "fields": {}}

    if broken:
        # 過去バージョンを遡り、壊れたフィールドが正常（0率が低い）な
        # 最初のバージョンを探す（メジャーごとに代表1つずつ確認して高速化）
        seen_minor: set[str] = set()
        candidates = []
        for v in versions[1:]:
            minor = ".".join(v.split(".")[:2])
            if minor in seen_minor:
                continue
            seen_minor.add(minor)
            candidates.append(v)
            if len(candidates) >= 12:
                break

        good_version = None
        good_stats = None
        for v in candidates:
            try:
                stats_map = fetch_stats(v)
            except Exception as e:  # noqa: BLE001
                print(f"  {v}: fetch failed ({e})")
                continue
            ratios = {f: zero_ratio(stats_map, f) for f in broken}
            print(f"  {v}: zero-ratio {ratios}")
            if all(r < BROKEN_RATIO for r in ratios.values()):
                good_version = v
                good_stats = stats_map
                break

        if good_stats is None:
            print("正常なバージョンが見つからず。補完なしで出力")
        else:
            result["source"] = good_version
            for field in broken:
                per_champ = {}
                for cid, s in curr_stats.items():
                    if s.get(field, 0):
                        continue  # 現行値があるなら補完不要
                    old = (good_stats.get(cid) or {}).get(field, 0)
                    if old:
                        per_champ[cid] = old
                if per_champ:
                    result["fields"][field] = per_champ
                    print(f"  {field}: {len(per_champ)} champions ({good_version} の値で補完)")

    out_path = f"{args.out}/stat-overrides.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"wrote {out_path}")

    # サンプル出力（検証用）
    ad = result["fields"].get("attackdamageperlevel", {})
    for cid in ("Urgot", "Ambessa", "Jinx", "Kayle", "Senna"):
        print(f"  sample {cid}: ad/lv = {ad.get(cid, '(補完なし)')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
