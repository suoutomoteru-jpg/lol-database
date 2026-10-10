#!/usr/bin/env python3
"""調査プローブ: Riot公式パッチノート記事から、チャンピオンごとの変更点テキスト
（数値だけでなく「意図」の文章）を抽出できるか技術検証する。

要件（ユーザー原文の例）: K'Sante の変更点を開いたら
「連携の取れたプレイにおいて...弱体化しました。エリート帯でより影響が
大きくなるはずです。」のような、デザイナーの意図を含む文章が出てほしい。

確認したいこと:
1. パッチノート記事ページの実際のHTML/データ構造
   （Gatsby/Next.js的な埋め込みJSONがあるか、素のHTMLか）
2. チャンピオン単位でテキストを安定して切り出せる構造になっているか
   （例: チャンピオンアイコン・名前の後に変更点の段落が続く、等）
3. K'Sante（カサンテ）の実例が見つかるか
"""
import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (probe/1.0)"}


def get(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace"), dict(r.headers)


def section(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


# ── 1. 最新パッチノート記事のURLを見つける ──────────────────────
section("1. パッチノート一覧ページ")
INDEX_URL = "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/"
uniq_links = []
try:
    html, headers = get(INDEX_URL)
    print(f"index page: {len(html)} 文字, content-type={headers.get('content-type')}")

    # 厳密パターンがダメだった場合に備え、まず緩く"patch"を含むhrefを全部拾って
    # 実際のURL形式を確認する
    all_hrefs = re.findall(r'href="([^"]+)"', html)
    print(f"href属性の総数: {len(all_hrefs)}")
    patch_hrefs = [h for h in all_hrefs if "patch" in h.lower()]
    uniq_patch_hrefs = list(dict.fromkeys(patch_hrefs))
    print(f"'patch'を含むhref: {len(uniq_patch_hrefs)}件（サンプル10件）")
    for h in uniq_patch_hrefs[:10]:
        print(f"  {h}")

    # JSON埋め込み（Next.js等）の中にリンクが隠れているケースにも備える
    json_patch_refs = re.findall(r'"(/[^"]*patch[^"]*notes[^"]*)"', html, re.I)
    uniq_json_refs = list(dict.fromkeys(json_patch_refs))
    print(f"\nJSON文字列中の 'patch...notes' っぽいパス: {len(uniq_json_refs)}件（サンプル10件）")
    for h in uniq_json_refs[:10]:
        print(f"  {h}")

    # 元の厳密パターンも一応試す
    strict_links = re.findall(r'href="(/en-us/news/game-updates/patch-[0-9a-z\-]+/)"', html)
    uniq_links = list(dict.fromkeys(strict_links)) or uniq_json_refs or uniq_patch_hrefs
    print(f"\n採用した候補リンク数: {len(uniq_links)}")
except Exception as e:
    print(f"取得失敗: {e}")
    html = ""

# ── 2. 最新記事ページの構造を調査 ────────────────────────────────
section("2. 最新パッチノート記事の構造")
article_url = None
if uniq_links:
    link0 = uniq_links[0]
    article_url = link0 if link0.startswith("http") else "https://www.leagueoflegends.com" + link0

else:
    print("記事リンクが見つからなかったため、記事ページの取得はスキップする")

if article_url:
    print(f"対象記事: {article_url}")
    try:
        html, headers = get(article_url)
        print(f"記事ページ: {len(html)} 文字")

        # Gatsby/Next.js系の埋め込みJSONを探す
        next_data = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        print(f"__NEXT_DATA__ 埋め込みJSON: {'あり (' + str(len(next_data.group(1))) + '文字)' if next_data else 'なし'}")

        apollo_state = re.search(r'window\.__APOLLO_STATE__\s*=\s*({.*?});', html, re.S)
        print(f"__APOLLO_STATE__: {'あり (' + str(len(apollo_state.group(1))) + '文字)' if apollo_state else 'なし'}")

        # page-data.json (Gatsby) の参照
        page_data_ref = re.search(r'["\'](/page-data/[^"\']+page-data\.json)["\']', html)
        print(f"page-data.json参照: {page_data_ref.group(1) if page_data_ref else 'なし'}")

        # Champion系のテキストがそれらしく含まれるか
        print(f"'champion' という語の出現回数(大小無視): {len(re.findall('champion', html, re.I))}")

    except Exception as e:
        print(f"取得失敗: {e}")
        html = ""
else:
    html = ""


# ── 3. K'Sante の記述を探す ──────────────────────────────────────
section("3. K'Sante の実例を探す")
if html:
    idx = html.find("K'Sante")
    if idx == -1:
        idx = html.find("KSante")
    if idx == -1:
        idx = html.lower().find("ksante")
    if idx >= 0:
        snippet = html[max(0, idx - 200):idx + 1500]
        snippet_plain = re.sub(r"<[^>]+>", " ", snippet)
        snippet_plain = re.sub(r"\s+", " ", snippet_plain).strip()
        print(f"K'Sante 検出位置: {idx}")
        print(f"周辺テキスト（タグ除去後）:\n{snippet_plain[:1200]}")
    else:
        print("この記事にK'Santeの記述は見つからず（別パッチの可能性）")

# ── 4. page-data.json が見つかった場合は中身も見る ────────────────
if html:
    page_data_ref = re.search(r'["\'](/page-data/[^"\']+page-data\.json)["\']', html)
    if page_data_ref:
        section("4. page-data.json の中身")
        pd_url = "https://www.leagueoflegends.com" + page_data_ref.group(1)
        try:
            pd_text, _ = get(pd_url)
            print(f"page-data.json: {len(pd_text)} 文字")
            data = json.loads(pd_text)
            print("top-level keys:", list(data.keys())[:10])
        except Exception as e:
            print(f"page-data.json取得/parse失敗: {e}")
