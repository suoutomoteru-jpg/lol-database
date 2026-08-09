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

積み上げ式（cumulative）収集:
    Riot Personal API Keyのレート制限（20 req/1s, 100 req/2min）は1回の
    実行では変わらないため、GitHub Actionsの1ジョブ上限（ホスト型ランナー
    は最大6時間）内でどれだけ回しても、1回で集められる試合数には上限が
    ある。そのため生の試合データを --state-file に永続化し、実行のたびに
    「まだ見ていない試合」だけを追加収集する。集計結果(scaling.json)は
    毎回 state 全体から作り直すので、バケット境界(BUCKET_EARLY_MAX等)を
    後で変更しても、過去に集めた試合は再集計時に新しい境界で正しく
    再分類される（stateには生の試合時間を保持し、バケット名は保持しない）。
    古い試合はパッチが変わって傾向が古くなるため、--max-age-days
    より前の試合は毎回の実行時にstateから間引く。

実行方法:
    RIOT_API_KEY=xxx python3 scripts/fetch_scaling_data.py \
        --platforms jp1,kr --state-file scripts/data/scaling_state.json \
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
BUCKET_EARLY_MAX = 20 * 60
BUCKET_MID_MAX = 35 * 60

# Match-V5 の championName が DDragon の alias と食い違う稀なケース
CHAMPION_NAME_FIXES = {
    "FiddleSticks": "FiddleSticks",  # 参考: 現行APIは既にDDragon表記と一致
}

# 早期投了・リマッチ等、実プレイと言えない試合を除外する下限（秒）
MIN_VALID_DURATION = 5 * 60

# 古い試合をstateから間引く基準（日）。LoLのパッチ間隔(約2週間)の
# 2〜3サイクル分を目安に、傾向が古くなりすぎない範囲で貯める
DEFAULT_MAX_AGE_DAYS = 35


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


# ── state（生の試合データ）の永続化 ────────────────────
#
# 1レコード = 1試合。バケット名ではなく生の試合時間(duration)を持つため、
# BUCKET_EARLY_MAX/BUCKET_MID_MAXを後から変更しても再集計時に追従する。

def load_state(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_state(path: str, records: list[dict]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))


def prune_state(records: list[dict], max_age_days: int) -> list[dict]:
    cutoff_ms = (time.time() - max_age_days * 86400) * 1000
    return [r for r in records if r.get("gameCreation", 0) >= cutoff_ms]


def collect_matches(
    platforms: list[str], api_key: str, limiter: RateLimiter,
    per_bracket: int, matches_per_player: int, known_match_ids: set[str],
) -> list[dict]:
    """まだ known_match_ids に無い試合だけを取得し、生レコードのリストで返す。
    レコード: {matchId, platform, gameCreation(ms), duration(sec), participants:[{champion, win}]}"""
    new_records: list[dict] = []
    seen_this_run: set[str] = set()

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
                if match_id in known_match_ids or match_id in seen_this_run:
                    continue
                seen_this_run.add(match_id)

                match = api_get(f"{regional_base}/lol/match/v5/matches/{match_id}", api_key, limiter)
                if not match:
                    continue
                info = match.get("info", {})
                if os.environ.get("DEBUG_DUMP_CHALLENGES") and not getattr(collect_matches, "_dumped", False):
                    collect_matches._dumped = True
                    sample = (info.get("participants") or [{}])[0]
                    print("=== DEBUG: participant top-level keys ===", file=sys.stderr)
                    print(sorted(sample.keys()), file=sys.stderr)
                    print("=== DEBUG: challenges keys ===", file=sys.stderr)
                    print(sorted((sample.get("challenges") or {}).keys()), file=sys.stderr)
                    print("=== DEBUG: challenges (full) ===", file=sys.stderr)
                    print(json.dumps(sample.get("challenges", {}), indent=1, ensure_ascii=False), file=sys.stderr)
                    print("=== DEBUG: teamPosition/duration for this sample ===", file=sys.stderr)
                    print(sample.get("teamPosition"), info.get("gameDuration"), file=sys.stderr)
                duration = info.get("gameDuration", 0)
                # 極端に短い試合（早期投了・リマッチ）は実プレイを反映しないため除外
                if duration < MIN_VALID_DURATION:
                    continue
                participants = []
                for p in info.get("participants", []):
                    champ = normalize_champion_name(p.get("championName", ""))
                    if not champ:
                        continue
                    participants.append({"champion": champ, "win": bool(p.get("win"))})
                if not participants:
                    continue
                new_records.append({
                    "matchId": match_id,
                    "platform": platform,
                    "gameCreation": info.get("gameCreation", 0),
                    "duration": duration,
                    "participants": participants,
                })

            if (i + 1) % 20 == 0:
                print(f"  [{platform}] {i + 1}/{len(puuids)} summoners処理済み "
                      f"(新規試合数 {len(new_records)})", file=sys.stderr)

    return new_records


# ── 集計・出力整形 ────────────────────────────────────

def records_to_stats(records: list[dict]) -> dict:
    """state全体からチャンピオン別バケット集計を作る。
    バケット境界は集計のたびに現在のBUCKET_EARLY_MAX/BUCKET_MID_MAXで
    再判定するため、古いレコードも境界変更に追従する。"""
    stats: dict[str, dict[str, dict[str, int]]] = {}

    def add(champion: str, bucket: str, win: bool):
        c = stats.setdefault(champion, {
            "early": {"games": 0, "wins": 0},
            "mid": {"games": 0, "wins": 0},
            "late": {"games": 0, "wins": 0},
        })
        c[bucket]["games"] += 1
        if win:
            c[bucket]["wins"] += 1

    for r in records:
        bucket = bucket_of(r["duration"])
        for p in r["participants"]:
            add(p["champion"], bucket, p["win"])

    return stats


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
    parser.add_argument("--state-file", default="scripts/data/scaling_state.json",
                         help="積み上げ式収集の生データ保存先。次回実行時はここに無い試合だけを追加取得する")
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS,
                         help="この日数より古い試合はstateから間引く")
    parser.add_argument("--out", default="frontend/public/tooltips/scaling.json")
    parser.add_argument("--api-key", default=os.environ.get("RIOT_API_KEY"))
    args = parser.parse_args()

    if not args.api_key:
        print("エラー: RIOT_API_KEY が未設定です（環境変数 or --api-key）", file=sys.stderr)
        sys.exit(1)

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    limiter = RateLimiter()

    existing = load_state(args.state_file)
    kept = prune_state(existing, args.max_age_days)
    print(f"state: 既存 {len(existing)} 件 → {args.max_age_days}日以内 {len(kept)} 件を保持"
          f"（{len(existing) - len(kept)} 件を間引き）", file=sys.stderr)

    known_ids = {r["matchId"] for r in kept}
    new_records = collect_matches(
        platforms, args.api_key, limiter, args.per_bracket, args.matches_per_player, known_ids,
    )
    print(f"新規取得: {len(new_records)} 件", file=sys.stderr)

    combined = kept + new_records
    save_state(args.state_file, combined)

    stats = records_to_stats(combined)
    output = build_output(stats, len(combined), QUEUE, patch="live")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1)

    print(f"完了: {len(output['champions'])} チャンピオン分, "
          f"サンプル試合数 {output['sampledMatches']}（累計state {len(combined)}件）→ {args.out}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
