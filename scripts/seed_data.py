"""
サンプルデータ投入スクリプト

data/ フォルダの JSON ファイルからデータを読み込んでデータベースに保存します。

実行方法:
    python scripts/seed_data.py
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_session
from database.models import Champion, Item


def load_json(filename):
    """data/ フォルダの JSON ファイルを読み込む"""
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", filename)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def seed():
    session = get_session()

    try:
        # すでにデータがあれば何もしない
        if session.query(Champion).count() > 0:
            print("データはすでに存在します。スキップします。")
            return

        # チャンピオンデータの投入
        print("チャンピオンデータを投入中...")
        champions_data = load_json("champions.json")
        for data in champions_data:
            champion = Champion(**data)
            session.add(champion)
        print(f"  {len(champions_data)} 件のチャンピオンを追加しました。")

        # アイテムデータの投入
        print("アイテムデータを投入中...")
        items_data = load_json("items.json")
        for data in items_data:
            item = Item(**data)
            session.add(item)
        print(f"  {len(items_data)} 件のアイテムを追加しました。")

        session.commit()
        print("\n完了！次は query_examples.py を実行してデータを確認してください。")
        print("    python scripts/query_examples.py")

    except Exception as e:
        session.rollback()
        print(f"エラーが発生しました: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
