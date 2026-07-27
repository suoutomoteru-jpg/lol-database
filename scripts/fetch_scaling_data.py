#!/usr/bin/env python3
"""
Scaling Chart 用データ収集スクリプト

Riot Match-V5 API から試合を収集し、「試合時間帯（序盤/中盤/終盤）ごとの
チャンピオン勝率」を集計した静的 JSON（frontend/public/tooltips/scaling.json）
を生成する。

集計方法（Lolalytics等と同じ手法。詳細は frontend/src/app/api/scalingData.ts
のコメントを参照）:
    各チャンピオンについて、そのチャンピオンが使われた試合を最終的な
    試合時間でバケット分けし、バケットごとの勝率を出す。タイムライン上の
    スナップショットではなく、試合結果からの相関的な指標。

サンプリング方針:
    「レートを絞らない」＝ Iron〜Challenger の全ティアから満遍なくサンプリング
    する（人口比重み付けはしない。低ランク帯が多数派なので人口比にすると
    低ランクデータに支配されてしまうため、ティアごとに同程度の量を集める）。
    対象キューはランクソロ/デュオ（RANKED_SOLO_5x5, queueId=420）。
    対象サーバーはまず日本鯖（jp1）。試合数が集まりにくい場合は
    --platforms で他鯖を追加できる。

実行方法:
    RIOT_API_KEY=xxx python3 scripts/fetch_scaling_data.py \
        --out frontend/public/tooltips/scaling.json

依存: 標準ライブラリのみ
"""

import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.request

UA = {"User-Agent": "lol-database-scaling-chart/1.0"}
QUEUE = "RANKED_SOLO_5x5"
QUEUE_ID = 420

# プラットフォーム → Match-V5 リージョナルルーティングの対応
PLATFORM_TO_REGION = {
    "jp1": "asia", "kr": "asia",
    "na1": "americas", "br1": "americas", "la1": "americas", "la2": "americas", "oc1": "americas",
    "euw1": "europe", "eun1": "europe", "tr1": "europe", "ru": "europe",
}

# Iron〜Diamond は division あり、Master以上は無し
DIVISION_TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"]
DIVISIONS = ["I", "II", "III", "IV"]
APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"]

# 試合時間バケットの境界（秒）
BUCKET_EARLY_MAX = 25 * 60
BUCKET_MID_MAX = 32 * 60

# Match-V5 の championName が DDragon の alias と食い違う稀なケース
CHAMPION_NAME_FIXES = {
    "FiddleSticks": "FiddleSticks",  # 参考: 現行APIは既にDDragon表記と一致
}

# 早期投了・リマッチ等、実プレイと言えない試合を除外する下限（秒）
MIN_VALID_DURATION = 5 * 60


# ── レート制御付きHTTP ─────────────────────────────────

class RateLimiter:
    """Riot Personal/Development Keyの既定レート
    （20 req/1s, 100 req/2min）に収まるよう待機する簡易トークンバケット。"""

    def __init__(self, per_second: int = 18, per_two_minutes: int = 95):
        self.per_second = per_second
        self.per_two_minutes = per_two_minutes
        self._short_window: list[float] = []
        self._long_window: list[float] = []

    def wait(self):
        now = time.monotonic()
        self._short_window = [t for t in self._short_window if now - t < 1.0]
        self._long_window = [t for t in self._long_window if now - t < 120.0]

        if len(self._short_window) >= self.per_second:
            time.sleep(1.0 - (now - self._short_window[0]) + 0.02)
        if len(self._long_window) >= self.per_two_minutes:
            time.sleep(max(0.0, 120.0 - (now - self._long_window[0]) + 0.05))

        t = time.monotonic()
        self._short_window.append(t)
        self._long_window.append(t)


def api_get(url: str, api_key: str, limiter: RateLimiter, timeout: int = 15, retries: int = 3):
    """Riot APIをGETする。429は Retry-After に従って待機・再試行する。"""
    req = urllib.request.Request(url, headers={**UA, "X-Riot-Token": api_key})
    last_err = None
    for attempt in range(retries + 1):
        limiter.wait()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = int(e.headers.get("Retry-After", "2"))
                print(f"  429 rate limited, waiting {retry_after}s...", file=sys.stderr)
                time.sleep(retry_after + 0.5)
                last_err = e
                continue
            if e.code == 404:
                return None
            last_err = e
        except Exception as e:  # noqa: BLE001
            last_err = e
        if attempt < retries:
            time.sleep(1.5 * (attempt + 1))
    raise last_err


# ── サンプリング対象Summoner一覧の取得 ──────────────────

def collect_puuids(platform: str, api_key: str, limiter: RateLimiter, per_bracket: int) -> list[str]:
    """Iron〜Challengerの全ティアから満遍なくpuuidを集める。"""
    base = f"https://{platform}.api.riotgames.com"
    puuids: list[str] = []

    def extract_puuids(entries) -> list[str]:
        out = []
        for e in entries[:per_bracket]:
            puuid = e.get("puuid")
            if puuid:
                out.append(puuid)
        return out

    # Iron〜Diamond: division毎にpage 1を取得
    for tier in DIVISION_TIERS:
        for division in DIVISIONS:
            url = f"{base}/lol/league/v4/entries/{QUEUE}/{tier}/{division}?page=1"
            print(f"  fetching {tier} {division}...", file=sys.stderr)
            entries = api_get(url, api_key, limiter) or []
            puuids.extend(extract_puuids(entries))

    # Master以上: apexリーグ（1エンドポイントに全員含まれる）
    for tier in APEX_TIERS:
        slug = {"MASTER": "masterleagues", "GRANDMASTER": "grandmasterleagues", "CHALLENGER": "challengerleagues"}[tier]
        url = f"{base}/lol/league/v4/{slug}/by-queue/{QUEUE}"
        print(f"  fetching {tier}...", file=sys.stderr)
        league = api_get(url, api_key, limiter) or {}
        puuids.extend(extract_puuids(league.get("entries", [])))

    return puuids


# ── 試合収集・集計 ────────────────────────────────────

def bucket_of(duration_sec: int) -> str:
    if duration_sec <= BUCKET_EARLY_MAX:
        return "early"
    if duration_sec <= BUCKET_MID_MAX:
        return "mid"
    return "late"


def normalize_champion_name(name: str) -> str:
    return CHAMPION_NAME_FIXES.get(name, name)


def collect_matches(
    platforms: list[str], api_key: str, limiter: RateLimiter,
    per_bracket: int, matches_per_player: int,
) -> dict:
    """champion alias -> {early: {games, wins}, mid: {...}, late: {...}}"""
    stats: dict[str, dict[str, dict[str, int]]] = {}
    seen_match_ids: set[str] = set()
    sampled_matches = 0

    def add(champion: str, bucket: str, win: bool):
        c = stats.setdefault(champion, {
            "early": {"games": 0, "wins": 0},
            "mid": {"games": 0, "wins": 0},
            "late": {"games": 0, "wins": 0},
        })
        c[bucket]["games"] += 1
        if win:
            c[bucket]["wins"] += 1

    for platform in platforms:
        region = PLATFORM_TO_REGION.get(platform)
        if not region:
            print(f"警告: {platform} のリージョンルーティングが未登録。スキップ", file=sys.stderr)
            continue
        regional_base = f"https://{region}.api.riotgames.com"

        print(f"[{platform}] サンプルSummoner収集中...", file=sys.stderr)
        puuids = collect_puuids(platform, api_key, limiter, per_bracket)
        print(f"[{platform}] {len(puuids)} 件のSummoner取得", file=sys.stderr)

        for i, puuid in enumerate(puuids):
            ids_url = (
                f"{regional_base}/lol/match/v5/matches/by-puuid/{puuid}/ids"
                f"?queue={QUEUE_ID}&count={matches_per_player}"
            )
            match_ids = api_get(ids_url, api_key, limiter) or []

            for match_id in match_ids:
                if match_id in seen_match_ids:
                    continue
                seen_match_ids.add(match_id)

                match = api_get(f"{regional_base}/lol/match/v5/matches/{match_id}", api_key, limiter)
                if not match:
                    continue
                info = match.get("info", {})
                duration = info.get("gameDuration", 0)
                # 極端に短い試合（早期投了・リマッチ）は実プレイを反映しないため除外
                if duration < MIN_VALID_DURATION:
                    continue
                bucket = bucket_of(duration)
                for p in info.get("participants", []):
                    champ = normalize_champion_name(p.get("championName", ""))
                    if not champ:
                        continue
                    add(champ, bucket, bool(p.get("win")))
                sampled_matches += 1

            if (i + 1) % 20 == 0:
                print(f"  [{platform}] {i + 1}/{len(puuids)} summoners処理済み "
                      f"(累計試合数 {sampled_matches})", file=sys.stderr)

    return {"stats": stats, "sampled_matches": sampled_matches}


# ── 出力整形 ──────────────────────────────────────────

def build_output(stats: dict, sampled_matches: int, queue: str, patch: str) -> dict:
    champions = []
    for alias, buckets in sorted(stats.items()):
        entry = {"alias": alias}
        for key in ("early", "mid", "late"):
            games = buckets[key]["games"]
            wins = buckets[key]["wins"]
            winrate = round(wins / games * 100, 1) if games > 0 else 0.0
            entry[key] = {"games": games, "wins": wins, "winrate": winrate}
        champions.append(entry)

    return {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "patch": patch,
        "queue": queue,
        "sampledMatches": sampled_matches,
        "buckets": {
            "early": {"maxMinutes": BUCKET_EARLY_MAX // 60},
            "mid": {"minMinutes": BUCKET_EARLY_MAX // 60, "maxMinutes": BUCKET_MID_MAX // 60},
            "late": {"minMinutes": BUCKET_MID_MAX // 60},
        },
        "champions": champions,
    }


# ── CLI ───────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platforms", default="jp1", help="カンマ区切り（例: jp1,kr）")
    parser.add_argument("--per-bracket", type=int, default=5, help="ティア×ディビジョン毎のサンプル人数")
    parser.add_argument("--matches-per-player", type=int, default=10, help="1人あたり直近何試合を見るか")
    parser.add_argument("--out", default="frontend/public/tooltips/scaling.json")
    parser.add_argument("--api-key", default=os.environ.get("RIOT_API_KEY"))
    args = parser.parse_args()

    if not args.api_key:
        print("エラー: RIOT_API_KEY が未設定です（環境変数 or --api-key）", file=sys.stderr)
        sys.exit(1)

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    limiter = RateLimiter()

    result = collect_matches(platforms, args.api_key, limiter, args.per_bracket, args.matches_per_player)
    output = build_output(result["stats"], result["sampled_matches"], QUEUE, patch="live")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1)

    print(f"完了: {len(output['champions'])} チャンピオン分, "
          f"サンプル試合数 {output['sampledMatches']} → {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
