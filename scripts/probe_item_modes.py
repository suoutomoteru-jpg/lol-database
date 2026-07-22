#!/usr/bin/env python3
"""アイテムデータ調査プローブ #6: mStat番号↔ステータス語の決定的対応表

テンプレート本文中の日本語ステータス語（「移動速度の@X*100@%」等）と、
その変数の計算式が参照する mStat 番号を、全チャンピオン＋全アイテムで
相関投票して対応表を確定する。scaleタグ（出力の型）ではなく
本文の語（入力の名指し）なので誤りにくい。

あわせて LoL Wiki をブラウザUAで再試行し、Bastion Breaker の実数値を取る。
"""
import json
import re
import urllib.request
from collections import Counter, defaultdict

CD = "https://raw.communitydragon.org/latest"
STRINGTABLE_URL = f"{CD}/game/ja_jp/data/menu/en_us/lol.stringtable.json"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# 本文中でステータスを名指しする語（長い語優先で照合）
STAT_WORDS = [
    "増加攻撃力", "合計攻撃力", "攻撃力",
    "増加体力", "最大体力", "現在の体力", "減少体力", "体力",
    "増加物理防御", "物理防御",
    "増加魔法防御", "魔法防御",
    "増加移動速度", "移動速度",
    "増加攻撃速度", "攻撃速度",
    "クリティカル率", "クリティカルダメージ",
    "脅威", "魔法貫通", "物理防御貫通",
    "スキルヘイスト", "行動妨害耐性", "魔力", "マナ", "射程", "ライフスティール",
]
WORD_RE = re.compile("|".join(map(re.escape, STAT_WORDS)))


def get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def get_json(url: str):
    return json.loads(get(url).decode("utf-8"))


def collect_stat_parts(node, out: list):
    if isinstance(node, dict):
        if "mStat" in node:
            out.append((node.get("mStat"), node.get("mStatFormula", 0)))
        for v in node.values():
            collect_stat_parts(v, out)
    elif isinstance(node, list):
        for v in node:
            collect_stat_parts(v, out)


def vote_from_template(tpl: str, calcs: dict, votes):
    """テンプレ中の @Var@ の直前30文字にあるステータス語と、
    Var計算式の（単一）mStat を相関させて投票"""
    for m in re.finditer(r"@([A-Za-z][\w]*)(?:\*[\d.-]+)?@", tpl):
        var = m.group(1).lower()
        calc = next((v for k, v in calcs.items() if str(k).lower() == var), None)
        if calc is None:
            continue
        parts: list = []
        collect_stat_parts(calc, parts)
        stats = {s for s, _ in parts}
        if len(stats) != 1:
            continue
        ctx = re.sub(r"<[^>]+>", "", tpl[max(0, m.start() - 34):m.start()])
        words = WORD_RE.findall(ctx)
        if words:
            votes[stats.pop()][words[-1]] += 1  # 直近の語に投票


def main() -> None:
    # ── Wiki 再試行（ブラウザUA） ──
    print("========== A. LoL Wiki（ブラウザUA再試行） ==========")
    for name in ("Bastion_Breaker", "Demonic_Embrace"):
        try:
            html = get(f"https://wiki.leagueoflegends.com/en-us/{name}", 60).decode("utf-8", "ignore")
            text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
            print(f"\n----- {name} (len={len(text)}) -----")
            for kw in ("Lethality", "true damage", "magic damage"):
                m = re.search(re.escape(kw), text, re.I)
                if m:
                    print(f"  [{kw}] …{text[max(0,m.start()-200):m.end()+200]}…")
        except Exception as e:  # noqa: BLE001
            print(f"{name}: 取得失敗 {e}")

    st_raw = get_json(STRINGTABLE_URL)
    entries = st_raw.get("entries", st_raw)
    st = {k.lower(): v for k, v in entries.items() if isinstance(v, str)}

    votes = defaultdict(Counter)

    # ── アイテム: externaldescription/tooltip と mItemCalculations ──
    items_bin = get_json(f"{CD}/game/items.cdtb.bin.json")
    for key, entry in items_bin.items():
        if not isinstance(entry, dict):
            continue
        calcs = entry.get("mItemCalculations")
        if not isinstance(calcs, dict):
            continue
        m = re.match(r"Items/(\d+)$", key)
        if not m:
            continue
        iid = m.group(1)
        tpl = (st.get(f"generatedtip_item_{iid}_externaldescription", "")
               + st.get(f"item_{iid}_tooltip", ""))
        if tpl:
            vote_from_template(tpl, calcs, votes)

    # ── チャンピオン: 全チャンピオンの mSpellCalculations × keyTooltip ──
    summary = get_json(f"{CD}/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json")
    aliases = [c["alias"].lower() for c in summary if c.get("id", 0) > 0]
    scanned = 0
    for alias in aliases:
        try:
            bin_data = get_json(f"{CD}/game/data/characters/{alias}/{alias}.bin.json")
        except Exception:  # noqa: BLE001
            continue
        scanned += 1
        for entry in bin_data.values():
            if not isinstance(entry, dict):
                continue
            spell = entry.get("mSpell") or entry
            calcs = spell.get("mSpellCalculations")
            if not isinstance(calcs, dict):
                continue
            lockeys = (((spell.get("mClientData") or {}).get("mTooltipData") or {}).get("mLocKeys") or {})
            tpl = "".join(st.get(str(lk).lower(), "") for lk in lockeys.values() if isinstance(lk, str))
            if tpl:
                vote_from_template(tpl, calcs, votes)

    print(f"\n========== B. mStat→本文語 投票表（champ {scanned}体 + item） ==========")
    for stat in sorted(votes, key=lambda x: (isinstance(x, str), x)):
        print(f"  mStat {stat!r:>6}: {votes[stat].most_common(6)}")


if __name__ == "__main__":
    main()
