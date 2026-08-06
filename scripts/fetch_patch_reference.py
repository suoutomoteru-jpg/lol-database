#!/usr/bin/env python3
"""
Riot Data Dragon から最新パッチの基礎ステータスを取得し、
reference/generated-*.md を生成する。

目的:
    チャットでの数値参照用データプールを最新パッチに更新する。
    アプリ（frontend / app.py / database）とは完全に独立していて、
    生成物は reference/ 配下にしか書き込まない。

注意:
    Claude Code の実行環境からは ddragon.leagueoflegends.com への
    アクセスがネットワークポリシーで拒否されるため、**ローカル環境で実行すること**。

使い方:
    python scripts/fetch_patch_reference.py              # 全チャンピオン + アイテム
    python scripts/fetch_patch_reference.py --locale en_US
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

BASE_URL = "https://ddragon.leagueoflegends.com"
OUT_DIR = Path(__file__).resolve().parent.parent / "reference"

# 詳しく見たいチャンピオン（スキル数値も出力する）
FOCUS_CHAMPIONS = ["Aphelios", "Caitlyn", "Tristana", "Braum", "Zyra", "Shaco"]


def fetch_json(url: str):
    """DDragon から JSON を取得する。"""
    req = urllib.request.Request(url, headers={"User-Agent": "lol-database-reference/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def latest_version() -> str:
    return fetch_json(f"{BASE_URL}/api/versions.json")[0]


def stat_at_level(base: float, growth: float, level: int) -> float:
    """
    LoL のステータス成長式。線形ではない点に注意。
        stat(n) = base + growth * (n - 1) * (0.7025 + 0.0175 * (n - 1))
    """
    n = level - 1
    return base + growth * n * (0.7025 + 0.0175 * n)


def strip_html(text: str) -> str:
    """DDragon の説明文からHTMLタグを除去する。"""
    text = re.sub(r"<br\s*/?>", " / ", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def build_champions_md(version: str, locale: str) -> str:
    data = fetch_json(f"{BASE_URL}/cdn/{version}/data/{locale}/champion.json")["data"]

    lines = [
        "# 生成: チャンピオン基礎ステータス",
        "",
        f"**パッチ {version}** / Data Dragon から自動生成（`scripts/fetch_patch_reference.py`）",
        "",
        "手書きの検証済みメモは `aphelios.md` `opponents.md` 等を参照。このファイルは再生成で上書きされる。",
        "",
        "Lv18の値は LoL の成長式 `base + growth × 17 × (0.7025 + 0.0175 × 17)` で算出。",
        "",
        "| チャンピオン | AD (Lv1) | AD (Lv18) | AS (Lv1) | HP (Lv1) | HP (Lv18) | 防御力 (Lv1) | 防御力 (Lv18) | 射程 | 移動速度 |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]

    for champ in sorted(data.values(), key=lambda c: c["id"]):
        s = champ["stats"]
        ad18 = stat_at_level(s["attackdamage"], s["attackdamageperlevel"], 18)
        hp18 = stat_at_level(s["hp"], s["hpperlevel"], 18)
        ar18 = stat_at_level(s["armor"], s["armorperlevel"], 18)
        lines.append(
            f"| {champ['id']} | {s['attackdamage']:.0f} | {ad18:.0f} | "
            f"{s['attackspeed']:.3f} | {s['hp']:.0f} | {hp18:.0f} | "
            f"{s['armor']:.0f} | {ar18:.0f} | {s['attackrange']:.0f} | {s['movespeed']:.0f} |"
        )

    # 注目チャンピオンはスキル数値も出す
    lines += ["", "---", "", "## 注目チャンピオンのスキル数値", ""]
    for champ_id in FOCUS_CHAMPIONS:
        try:
            detail = fetch_json(
                f"{BASE_URL}/cdn/{version}/data/{locale}/champion/{champ_id}.json"
            )["data"][champ_id]
        except Exception as e:  # チャンピオンID変更・未実装などは飛ばす
            lines.append(f"### {champ_id}\n\n取得失敗: {e}\n")
            continue

        lines.append(f"### {detail['name']} ({champ_id})")
        lines.append("")
        passive = detail.get("passive", {})
        if passive:
            lines.append(f"- **パッシブ {passive.get('name','')}**: {strip_html(passive.get('description',''))}")
        for key, spell in zip("QWER", detail.get("spells", [])):
            cd = "/".join(str(x) for x in spell.get("cooldown", []))
            cost = "/".join(str(x) for x in spell.get("cost", []))
            rng = "/".join(str(x) for x in spell.get("range", []))
            lines.append(
                f"- **{key} {spell['name']}** — CD {cd} / コスト {cost} / 射程 {rng}\n"
                f"  - {strip_html(spell.get('tooltip', ''))}"
            )
        lines.append("")

    return "\n".join(lines) + "\n"


def build_items_md(version: str, locale: str) -> str:
    data = fetch_json(f"{BASE_URL}/cdn/{version}/data/{locale}/item.json")["data"]

    lines = [
        "# 生成: アイテム数値",
        "",
        f"**パッチ {version}** / Data Dragon から自動生成（`scripts/fetch_patch_reference.py`）",
        "",
        "サモナーズリフトで購入可能なアイテムのみ。手書きの検証済みメモは `items.md` を参照。",
        "",
        "⚠️ DDragon の `stats` は生データで、パッシブの数値は説明文に埋まっている。",
        "パッシブの正確な数値が必要な時は説明文を読むか、Wikiで裏取りすること。",
        "",
    ]

    entries = []
    for item_id, item in data.items():
        maps = item.get("maps", {})
        if not maps.get("11"):  # 11 = サモナーズリフト
            continue
        if not item.get("gold", {}).get("purchasable"):
            continue
        cost = item["gold"]["total"]
        if cost < 500:  # コンポーネント以下は除外
            continue
        entries.append((cost, item_id, item))

    for cost, item_id, item in sorted(entries, key=lambda x: (-x[0], x[2]["name"])):
        stats = ", ".join(f"{k} {v}" for k, v in item.get("stats", {}).items()) or "—"
        lines.append(f"### {item['name']} ({item_id}) — {cost}g")
        lines.append(f"- スタッツ: {stats}")
        lines.append(f"- 説明: {strip_html(item.get('description', ''))}")
        lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="DDragonからパッチ参照データを生成する")
    parser.add_argument("--locale", default="ja_JP", help="ロケール（既定: ja_JP）")
    parser.add_argument("--version", help="パッチ指定（既定: 最新）")
    args = parser.parse_args()

    try:
        version = args.version or latest_version()
    except Exception as e:
        print(f"バージョン取得に失敗しました: {e}", file=sys.stderr)
        print("ネットワークから ddragon.leagueoflegends.com に到達できるか確認してください。", file=sys.stderr)
        return 1

    print(f"パッチ {version} / ロケール {args.locale} で生成します")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, builder in (
        ("generated-champions.md", build_champions_md),
        ("generated-items.md", build_items_md),
    ):
        try:
            content = builder(version, args.locale)
        except Exception as e:
            print(f"{name} の生成に失敗しました: {e}", file=sys.stderr)
            return 1
        path = OUT_DIR / name
        path.write_text(content, encoding="utf-8")
        print(f"  書き込み: {path.relative_to(OUT_DIR.parent)} ({len(content):,} bytes)")

    print(f"\n完了。reference/patch-state.md の基準パッチを {version} に更新してください。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
