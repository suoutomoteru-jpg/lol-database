"""
クエリ例スクリプト

データベースへの様々な問い合わせ（クエリ）の例を示します。
初心者向けに、よく使うパターンをコメント付きで解説しています。

実行方法:
    python scripts/query_examples.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_session
from database.models import Champion, Item


def run_examples():
    session = get_session()

    try:
        print("=" * 50)
        print("  LoL データベース クエリ例")
        print("=" * 50)

        # ---- 1. 全チャンピオンを取得 ----
        print("\n【1】全チャンピオン一覧")
        champions = session.query(Champion).all()
        for c in champions:
            print(f"  {c.name:10} | ロール: {c.role:8} | 難易度: {c.difficulty}")

        # ---- 2. ロールで絞り込む ----
        print("\n【2】ミッドレーナーだけを取得")
        mid_laners = session.query(Champion).filter(Champion.role == "Mid").all()
        for c in mid_laners:
            print(f"  {c.name} - {c.title}")

        # ---- 3. 難易度が Easy のチャンピオンを取得 ----
        print("\n【3】初心者向けチャンピオン（難易度: Easy）")
        easy_champs = (
            session.query(Champion)
            .filter(Champion.difficulty == "Easy")
            .all()
        )
        for c in easy_champs:
            print(f"  {c.name}: {c.description[:30]}...")

        # ---- 4. 体力でソート ----
        print("\n【4】体力が高い順にチャンピオンを表示（上位3件）")
        tanky = (
            session.query(Champion)
            .order_by(Champion.hp.desc())
            .limit(3)
            .all()
        )
        for c in tanky:
            print(f"  {c.name:10} | HP: {c.hp}")

        # ---- 5. 全アイテムを取得 ----
        print("\n【5】全アイテム一覧")
        items = session.query(Item).all()
        for item in items:
            print(f"  {item.name:25} | コスト: {item.cost:4}G | カテゴリ: {item.category}")

        # ---- 6. カテゴリで絞り込む ----
        print("\n【6】魔法アイテム（カテゴリ: Magic）")
        magic_items = session.query(Item).filter(Item.category == "Magic").all()
        for item in magic_items:
            print(f"  {item.name:25} | AP: {item.ability_power}")

        # ---- 7. コストが安い順に並べる ----
        print("\n【7】安いアイテムトップ3")
        cheap_items = (
            session.query(Item)
            .order_by(Item.cost.asc())
            .limit(3)
            .all()
        )
        for item in cheap_items:
            print(f"  {item.name:25} | {item.cost}G")

        # ---- 8. 件数を数える ----
        print("\n【8】データ件数")
        print(f"  チャンピオン数: {session.query(Champion).count()} 件")
        print(f"  アイテム数:     {session.query(Item).count()} 件")

        print("\n" + "=" * 50)

    finally:
        session.close()


if __name__ == "__main__":
    run_examples()
