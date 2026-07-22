#!/usr/bin/env python3
"""アイテムデータ調査プローブ #5: mStat番号の実証的特定

アイテムのダメージ計算式が参照する mStat 番号（例: 2520の mStat:29）の
意味を推測でなく実証で確定する。

手法:
  A. LoL Wiki (英語) から Bastion Breaker / Demonic Embrace の実数値を取得し、
     binの式 300+25×stat29 等と突き合わせる
  B. チャンピオンbinの mSpellCalculations と、stringtableツールチップ中の
     <scaleXX>タグが包む @Var@ を相関させ、mStat番号→スケールタグの投票表を作る
  C. 全アイテムの mItemCalculations に出現する mStat 番号の使用頻度を集計
     （ラベルが必要な番号の全リスト）
"""
import json
import re
import urllib.request
from collections import Counter, defaultdict

CD = "https://raw.communitydragon.org/latest"
STRINGTABLE_URL = f"{CD}/game/ja_jp/data/menu/en_us/lol.stringtable.json"


def get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 lol-db-probe"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def get_json(url: str):
    return json.loads(get(url).decode("utf-8"))


def collect_stats(node, out: set):
    """計算式ノードから mStat 番号を再帰収集"""
    if isinstance(node, dict):
        if "mStat" in node:
            out.add(node["mStat"])
        for v in node.values():
            collect_stats(v, out)
    elif isinstance(node, list):
        for v in node:
            collect_stats(v, out)


def part_a_wiki():
    print("========== A. LoL Wiki 実数値 ==========")
    for name in ("Bastion_Breaker", "Demonic_Embrace", "Divine_Sunderer"):
        try:
            html = get(f"https://wiki.leagueoflegends.com/en-us/{name}", timeout=60).decode("utf-8", "ignore")
        except Exception as e:  # noqa: BLE001
            print(f"{name}: 取得失敗 {e}")
            continue
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text)
        print(f"\n----- {name} -----")
        # パッシブ説明らしき箇所: ダメージ/lethality/health 周辺を抜粋
        for kw in ("true damage", "Lethality", "magic damage", "maximum health"):
            for m in re.finditer(re.escape(kw), text, re.I):
                s = max(0, m.start() - 160)
                snippet = text[s:m.end() + 160]
                print(f"  [{kw}] …{snippet}…")
                break  # 各キーワード最初の1件


def part_b_champion_mining(st):
    print("\n========== B. mStat→scaleタグ 投票表 ==========")
    summary = get_json(f"{CD}/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json")
    aliases = [c["alias"].lower() for c in summary if c.get("id", 0) > 0][:70]
    votes = defaultdict(Counter)
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
            tpl = ""
            for lk in lockeys.values():
                if isinstance(lk, str):
                    tpl += st.get(lk.lower(), "")
            if not tpl:
                continue
            # <scaleXX>…@Var@ の組を抽出
            for m in re.finditer(r"<(scale[A-Za-z]+)>[^<]{0,60}?@([A-Za-z][\w]*)(?:\*[\d.-]+)?@", tpl):
                tag, var = m.group(1), m.group(2).lower()
                calc = next((v for k, v in calcs.items() if str(k).lower() == var), None)
                if calc is None:
                    continue
                stats: set = set()
                collect_stats(calc, stats)
                if len(stats) == 1:
                    votes[stats.pop()][tag] += 1
    print(f"走査チャンピオン: {scanned}")
    for stat in sorted(votes):
        top = votes[stat].most_common(4)
        print(f"  mStat {stat:>2}: {top}")


def part_c_item_stat_usage():
    print("\n========== C. アイテム計算式のmStat使用頻度 ==========")
    bin_data = get_json(f"{CD}/game/items.cdtb.bin.json")
    usage = Counter()
    examples = defaultdict(list)
    for key, entry in bin_data.items():
        if not isinstance(entry, dict) or "mItemCalculations" not in entry:
            continue
        for cname, calc in (entry.get("mItemCalculations") or {}).items():
            stats: set = set()
            collect_stats(calc, stats)
            for s in stats:
                usage[s] += 1
                if len(examples[s]) < 3:
                    examples[s].append(f"{key}:{cname}")
    for s, n in usage.most_common():
        print(f"  mStat {s:>2}: {n}回  例: {examples[s]}")


def main() -> None:
    part_a_wiki()
    st_raw = get_json(STRINGTABLE_URL)
    entries = st_raw.get("entries", st_raw)
    st = {k.lower(): v for k, v in entries.items() if isinstance(v, str)}
    part_b_champion_mining(st)
    part_c_item_stat_usage()


if __name__ == "__main__":
    main()
