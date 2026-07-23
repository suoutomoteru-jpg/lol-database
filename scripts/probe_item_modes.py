#!/usr/bin/env python3
"""調査プローブ: アイテムステータスのカテゴリ内ランキングのカバレッジ検証

useItemsByStats.ts（stats欄＋説明文<stats>ブロック補完）と
itemStatRank.ts（ラベル＋単位一致・母集団5件以上）を再現し、
実データでどのステータス行にランキングが付くかを確認する。
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
    "PercentMovementSpeedMod": "移動速度",
    "FlatGoldPer10Mod": "ゴールド/10s",
    "FlatArmorPenetrationMod": "脅威",
    "PercentArmorPenetrationMod": "物理防御貫通",
    "FlatMagicPenetrationMod": "魔法防御貫通",
    "PercentMagicPenetrationMod": "魔法防御貫通",
    "AbilityHaste": "スキルヘイスト",
}
PCT_STAT = ("Percent", "FlatCritChanceMod")

# stats.ts ITEM_KEYWORDS 相当（text → labelJa、長い語優先）
KW = [
    ("ヒール&シールドパワー", "ヒール＆シールドパワー"),
    ("ヒール＆シールドパワー", "ヒール＆シールドパワー"),
    ("クリティカルダメージ", "クリティカルダメージ"),
    ("クリティカル率", "クリティカル率"),
    ("通常攻撃時効果", "通常攻撃時効果"),
    ("物理防御貫通", "物理防御貫通"),
    ("魔法防御貫通", "魔法防御貫通"),
    ("行動妨害耐性", "行動妨害耐性"),
    ("体力回復速度", "体力自動回復"),
    ("体力自動回復", "体力自動回復"),
    ("マナ回復速度", "マナ自動回復"),
    ("マナ自動回復", "マナ自動回復"),
    ("ライフスティール", "ライフスティール"),
    ("オムニヴァンプ", "オムニヴァンプ"),
    ("スキルヘイスト", "スキルヘイスト"),
    ("ゴールド獲得", "ゴールド獲得"),
    ("シールド量", "ヒール＆シールドパワー"),
    ("体力回復", "体力自動回復"),
    ("マナ回復", "マナ自動回復"),
    ("移動速度", "移動速度"),
    ("攻撃速度", "攻撃速度"),
    ("物理防御", "物理防御"),
    ("魔法防御", "魔法防御"),
    ("アーマー", "物理防御"),
    ("攻撃力", "攻撃力"),
    ("脅威", "脅威"),
    ("魔力", "魔力"),
    ("体力", "体力"),
    ("マナ", "マナ"),
]
KW.sort(key=lambda p: -len(p[0]))

STATS_BLOCK_RE = re.compile(r"<stats>([\s\S]*?)</stats>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
LINE_RE = re.compile(r"^([\s\S]*?)\s*([+-]?\d[\d.,]*\s*%?)\s*$")

def fmt_stat(key, val):
    if key.startswith("Percent") or key == "FlatCritChanceMod":
        return f"{round(val * 100)}%"
    return str(round(val))

def desc_stat_lines(desc):
    m = STATS_BLOCK_RE.search(desc or "")
    if not m:
        return []
    out = []
    for raw in re.split(r"<br\s*/?\s*>", m.group(1), flags=re.I):
        plain = TAG_RE.sub("", raw).strip()
        if not plain:
            continue
        lm = LINE_RE.match(plain)
        if not lm:
            continue
        hit = next((lab for text, lab in KW if text in lm.group(1)), None)
        if hit:
            out.append((hit, re.sub(r"\s+", "", lm.group(2))))
    return out

def stat_lines(item):
    lines = [(STAT_LABELS.get(k, k), fmt_stat(k, v))
             for k, v in (item.get("stats") or {}).items() if v != 0]
    labels = {lb for lb, _ in lines}
    for lb, v in desc_stat_lines(item.get("description", "")):
        if lb not in labels:
            lines.append((lb, v))
            labels.add(lb)
    return lines

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

# (label, is_pct) → 件数
pop = {}
for iid, it in listed:
    for lb, v in stat_lines(it):
        key = (lb, v.endswith("%"))
        pop.setdefault(key, []).append(iid)

print("\n== ステータス別 母集団サイズ（5件以上でランキング表示） ==")
for (lb, pct), rows in sorted(pop.items(), key=lambda kv: -len(kv[1])):
    mark = "○" if len(rows) >= 5 else "×"
    print(f"{mark} {lb}{'(%)' if pct else ''}: {len(rows)}件")

print("\n== サンプルアイテム: 表示されるランキング ==")
SAMPLES = ["3031", "3068", "3153", "3078", "6653", "3742", "6672", "6693", "3115"]
for sid in SAMPLES:
    it = data.get(sid)
    if not it:
        continue
    parts = []
    for lb, v in stat_lines(it):
        n = len(pop.get((lb, v.endswith("%")), []))
        parts.append(f"{lb} {v}={'○' if n >= 5 else '×'}({n})")
    print(f"{sid} {it['name']}: {' / '.join(parts) or '(なし)'}")
