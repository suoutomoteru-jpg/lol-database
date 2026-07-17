#!/usr/bin/env python3
"""アイテムデータ調査プローブ #2: items.bin の計算式構造

プロトプラズムハーネス（2525）の「ライフライン」数値（最大体力獲得量・
回復量・CD）が DDragon/CDragon の説明文で 0/空欄になる問題。
実数値は game/items.bin.json の GameCalculation にあるはずなので、
その構造を確認する。

出力:
  1. items.bin.json 内の 2525 エントリ全文
  2. 説明文に「壊れた0」を含む ja_JP アイテムの全件リスト（影響範囲）
"""
import json
import re
import urllib.request

DD = "https://ddragon.leagueoflegends.com"
CD = "https://raw.communitydragon.org/latest"


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "lol-db-probe"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def listdir(path: str):
    """CDragon のディレクトリリスティング（/json/ プレフィックス）"""
    url = f"https://raw.communitydragon.org/json/latest/{path}"
    try:
        return [(x.get("name"), x.get("type")) for x in get_json(url)]
    except Exception as e:  # noqa: BLE001
        return [("ERROR", str(e))]


def main() -> None:
    # ── 0. ディレクトリ探索: items系binの実パスを見つける ──
    for p in ["game/", "game/data/", "game/global/", "game/items/"]:
        print(f"--- ls {p} ---")
        for name, typ in listdir(p):
            print(f"  {typ}\t{name}")
        print()

    # ── 1. items.bin の対象エントリ（パス候補を順に試す）──
    candidates = [
        f"{CD}/game/items.bin.json",
        f"{CD}/game/global/items/items.bin.json",
        f"{CD}/game/data/items/items.bin.json",
    ]
    bin_data = None
    for url in candidates:
        try:
            bin_data = get_json(url)
            print(f"OK: {url}")
            break
        except Exception as e:  # noqa: BLE001
            print(f"NG: {url} ({e})")
    if bin_data is None:
        print("items.bin が見つからない（ディレクトリリストから特定する）")
        return
    print(f"=== items.bin.json: {len(bin_data)} root keys ===")
    hits = [k for k in bin_data if "2525" in k]
    print(f"キーに2525を含む: {hits}\n")
    for k in hits:
        print(f"----- {k} -----")
        print(json.dumps(bin_data[k], ensure_ascii=False, indent=1)[:8000])
        print()

    # ── 2. 影響範囲: 「壊れた0」を含むアイテム ──
    version = get_json(f"{DD}/api/versions.json")[0]
    items = get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]
    # <stats>ブロック外の本文で 「を0獲得」「が0回復」「(0秒)」「 0増加」等の疑わしいゼロ
    pat = re.compile(r"(を0[獲回]|が0回復|\(0秒\)|\b0を獲得|ダメージを0|0のダメージ)")
    broken = []
    for iid, it in items.items():
        desc = it.get("description", "")
        body = re.sub(r"<stats>[\s\S]*?</stats>", "", desc)
        if pat.search(body):
            broken.append((iid, it.get("name", ""), it.get("maps", {}).get("11"), pat.findall(body)))
    print(f"=== ja_JP 壊れた0を含むアイテム: {len(broken)}件 (version {version}) ===")
    for iid, name, sr, marks in broken:
        print(f"  {iid}\t{name}\tSR={sr}\t{marks}")


if __name__ == "__main__":
    main()
