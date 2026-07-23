#!/usr/bin/env python3
"""調査プローブ: アイテムステータスのカテゴリ内ランキングのカバレッジ検証

frontend/src/app/utils/itemStatRank.ts と同じロジックをddragon実データに
適用し、どのステータスカテゴリでランキング（上位n%）が表示されるかを確認する。
"""
import json
import re
import urllib.request

DD = "https://ddragon.leagueoflegends.com"

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "probe"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

version = get_json(f"{DD}/api/versions.json")[0]
data = get_json(f"{DD}/cdn/{version}/data/ja_JP/item.json")["data"]
print(f"version: {version}, items: {len(data)}")

# useItemsByStats.ts の STAT_LABELS（統一後）
STAT_LABELS = {
    "FlatPhysicalDamageMod": "攻撃力",
    "FlatMagicDamageMod": "魔力",
    "FlatArmorMod": "物理防御",
    "FlatSpellBlockMod": "魔法防御",
    "FlatHPPoolMod": "体力",
    "FlatMPPoolMod": "マナ",
    "FlatMovementSpeedMod": "移動速度",
    "FlatCritChanceMod": "クリティカル率",
    "PercentCritDamageMod": "クリティカルダメージ",
    "PercentAttackSpeedMod": "攻撃速度",
    "PercentLifeStealMod": "ライフスティール",
    "PercentHealAndShieldPower": "ヒール＆シールドパワー",
    "FlatHPRegenMod": "体力自動回復",
    "FlatMPRegenMod": "マナ自動回復",
    "PercentMovementSpeedMod": "移動速度%",
    "FlatGoldPer10Mod": "ゴールド/10s",
    "FlatArmorPenetrationMod": "脅威",
    "PercentArmorPenetrationMod": "物理防御貫通",
    "FlatMagicPenetrationMod": "魔法防御貫通",
    "PercentMagicPenetrationMod": "魔法防御貫通%",
    "AbilityHaste": "スキルヘイスト",
}

# fetchItemList 相当: SRで購入可能な2000G以上の完成アイテム
def is_listed(iid, item):
    return (
        int(iid) < 100000
        and item.get("gold", {}).get("purchasable", True)
        and item.get("gold", {}).get("total", 0) >= 2000
        and item.get("maps", {}).get("11", False)
        and not item.get("requiredChampion")
        and item.get("inStore") is not False
    )

listed = [(iid, it) for iid, it in data.items() if is_listed(iid, it)]
print(f"2000G+ SR購入可: {len(listed)}")

# ラベル → [(id, value)] の母集団
pop = {}
for iid, it in listed:
    for k, v in (it.get("stats") or {}).items():
        if v == 0:
            continue
        label = STAT_LABELS.get(k, k)
        pop.setdefault(label, []).append((iid, it["name"], v))

print("\n== ステータス別 母集団サイズ（5件以上でランキング表示） ==")
for label, rows in sorted(pop.items(), key=lambda kv: -len(kv[1])):
    mark = "○" if len(rows) >= 5 else "×"
    print(f"{mark} {label}: {len(rows)}件")

# サンプル: 説明文<stats>ブロックの行がどれだけラベル照合できるか
print("\n== サンプルアイテムの照合結果 ==")
SAMPLES = ["3031", "3068", "3153", "3078", "6653", "3742", "6672"]
stats_block_re = re.compile(r'<stats>([\s\S]*?)</stats>', re.I)
tag_re = re.compile(r"<[^>]+>")
line_re = re.compile(r"^([\s\S]*?)\s*([+-]?\d[\d.,]*\s*%?)\s*$")
for sid in SAMPLES:
    it = data.get(sid)
    if not it:
        continue
    m = stats_block_re.search(it.get("description", ""))
    lines = []
    if m:
        for raw in re.split(r"<br\s*/?>", m.group(1), flags=re.I):
            plain = tag_re.sub("", raw).strip()
            if plain:
                lm = line_re.match(plain)
                lines.append(lm.group(1).strip() if lm else plain)
    hits = []
    for lb in lines:
        n = len(pop.get(lb, []))
        hits.append(f"{lb}={'○' if n >= 5 else '×'}({n})")
    print(f"{sid} {it['name']}: {' / '.join(hits) if hits else '(statsブロックなし)'}")
