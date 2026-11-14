#!/usr/bin/env python3
"""
データソース鮮度チェックスクリプト

DDragon の最新パッチバージョンを基準として、ツールチップ数値の補完に使う
候補データソースがどこまで追従しているかを検証する。

チェック対象:
  1. Riot DDragon        : versions.json（基準となる最新パッチ）
  2. CommunityDragon raw : content-metadata.json のバージョン +
                           ディレクトリ一覧(JSON)の patch フォルダと更新日時 +
                           Ahri の bin データの Last-Modified
  3. Meraki Analytics    : champions/Ahri.json の version / patchLastChanged +
                           Last-Modified ヘッダー
  4. LoL Wiki            : 最新パッチページ(V26.13等)の存在 +
                           Template:Data_Ahri/Q の最終編集日時

実行方法:
    python3 scripts/check_data_sources.py

依存: 標準ライブラリのみ（CI でそのまま動かせるように）
"""

import json
import re
import sys
import urllib.request
import urllib.error

UA = {"User-Agent": "lol-database-freshness-check/1.0 (data source evaluation)"}
TIMEOUT = 30


def fetch(url: str, as_json: bool = True, max_bytes: int | None = None):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        raw = res.read(max_bytes) if max_bytes else res.read()
        headers = dict(res.headers)
    if as_json:
        return json.loads(raw), headers
    return raw.decode("utf-8", errors="replace"), headers


def fetch_headers(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA, method="HEAD")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        return dict(res.headers)


def major_minor(version: str) -> str:
    """'26.13.1' / '26.13.7xx.yyyy' → '26.13'"""
    m = re.match(r"(\d+)\.(\d+)", version)
    return f"{m.group(1)}.{m.group(2)}" if m else version


def section(title: str):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")


def main() -> int:
    results: dict[str, str | None] = {}

    # ── 1. DDragon（基準） ─────────────────────────────
    section("1. Riot DDragon (基準)")
    try:
        versions, _ = fetch("https://ddragon.leagueoflegends.com/api/versions.json")
        latest = versions[0]
        results["ddragon"] = major_minor(latest)
        print(f"  最新バージョン        : {latest}")
        print(f"  パッチ (major.minor)  : {results['ddragon']}")
    except Exception as e:
        print(f"  ERROR: {e}")
        results["ddragon"] = None

    # ── 2. CommunityDragon ─────────────────────────────
    section("2. CommunityDragon (raw.communitydragon.org)")
    try:
        meta, _ = fetch("https://raw.communitydragon.org/latest/content-metadata.json")
        version = str(meta.get("version", ""))
        results["cdragon"] = major_minor(version)
        print(f"  latest/content-metadata.json version: {version}")
        print(f"  パッチ (major.minor)  : {results['cdragon']}")
    except Exception as e:
        print(f"  ERROR (content-metadata): {e}")
        results["cdragon"] = None

    # ディレクトリ一覧（JSONインデックス）から最新パッチフォルダと更新日時
    try:
        listing, _ = fetch("https://raw.communitydragon.org/json/")
        dirs = [
            (e.get("name", ""), e.get("mtime", ""))
            for e in listing
            if e.get("type") == "directory"
        ]
        patch_dirs = sorted(
            (d for d in dirs if re.fullmatch(r"\d+\.\d+", d[0])),
            key=lambda d: tuple(map(int, d[0].split("."))),
        )
        print("  patch ディレクトリ（新しい順に5件）:")
        for name, mtime in patch_dirs[-5:][::-1]:
            print(f"    {name:>7}  (mtime: {mtime})")
        special = {n: m for n, m in dirs if n in ("latest", "pbe")}
        for name, mtime in special.items():
            print(f"    {name:>7}  (mtime: {mtime})")
    except Exception as e:
        print(f"  ERROR (directory listing): {e}")

    # 実データ（Ahri の bin）の鮮度
    try:
        h = fetch_headers(
            "https://raw.communitydragon.org/latest/game/data/characters/ahri/ahri.bin.json"
        )
        print(f"  ahri.bin.json Last-Modified: {h.get('Last-Modified', 'N/A')}")
        print(f"  ahri.bin.json Content-Length: {h.get('Content-Length', 'N/A')}")
    except Exception as e:
        print(f"  ERROR (ahri.bin.json): {e}")

    # ── 3. Meraki Analytics ────────────────────────────
    section("3. Meraki Analytics (cdn.merakianalytics.com)")
    try:
        ahri, headers = fetch(
            "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/Ahri.json"
        )
        version = str(ahri.get("version", ""))
        patch_changed = str(ahri.get("patchLastChanged", ""))
        # version フィールドがない場合は patchLastChanged で代用（25.08 → 15.8 相当の季節表記）
        results["meraki"] = major_minor(version or patch_changed) or None
        print(f"  Ahri.json version         : {version or 'N/A'}")
        print(f"  Ahri.json patchLastChanged: {patch_changed or 'N/A'}")
        print(f"  Last-Modified             : {headers.get('Last-Modified', 'N/A')}")
        q = (ahri.get("abilities", {}).get("Q") or [{}])[0]
        has_numbers = bool(q.get("effects"))
        print(f"  Q スキルの数値データ有無  : {'あり' if has_numbers else 'なし'}")
    except Exception as e:
        print(f"  ERROR: {e}")
        results["meraki"] = None

    # ── 4. LoL Wiki ────────────────────────────────────
    section("4. LoL Wiki (wiki.leagueoflegends.com)")
    try:
        patch = results.get("ddragon")
        titles = "Template:Data Ahri/Q"
        if patch:
            # DDragon は旧様式 (16.13)、パッチノート/Wiki は +10 した季節表記 (26.13)
            major, minor = patch.split(".")
            titles += f"|V{int(major) + 10}.{minor}"
        api = (
            "https://wiki.leagueoflegends.com/en-us/api.php"
            "?action=query&format=json&prop=revisions&rvprop=timestamp"
            f"&redirects=1&titles={urllib.request.quote(titles)}"
        )
        data, _ = fetch(api)
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            title = page.get("title", "?")
            if "missing" in page:
                print(f"  {title}: ページなし")
            else:
                ts = (page.get("revisions") or [{}])[0].get("timestamp", "N/A")
                print(f"  {title}: 最終編集 {ts}")
        results["wiki"] = "checked"
    except Exception as e:
        print(f"  ERROR: {e}")
        results["wiki"] = None

    # ── 判定サマリー ────────────────────────────────────
    section("判定サマリー")
    base = results.get("ddragon")
    print(f"  基準パッチ (DDragon): {base or '取得失敗'}")
    for key, label in (("cdragon", "CommunityDragon"), ("meraki", "Meraki")):
        v = results.get(key)
        if v is None:
            verdict = "取得失敗"
        elif base is None:
            verdict = f"{v}（基準取得失敗のため比較不可）"
        elif v == base:
            verdict = f"{v} → ✅ 最新パッチと一致"
        else:
            verdict = f"{v} → ⚠️ 最新 {base} に対して遅延あり"
        print(f"  {label:16}: {verdict}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
