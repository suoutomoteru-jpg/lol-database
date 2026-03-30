"""
データベース初期化スクリプト

このスクリプトを実行するとテーブルが作成されます。
初回セットアップ時に一度だけ実行してください。

実行方法:
    python scripts/setup_db.py
"""

import sys
import os

# プロジェクトルートをパスに追加（importが動くようにするため）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine, Base
from database.models import Champion, Item  # noqa: F401（テーブル定義を読み込むために必要）


def setup():
    print("データベースを初期化しています...")
    Base.metadata.create_all(engine)
    print("テーブルを作成しました:")
    print("  - champions（チャンピオンテーブル）")
    print("  - items（アイテムテーブル）")
    print("  - champion_items（チャンピオンとアイテムの関連テーブル）")
    print("\n完了！次は seed_data.py を実行してサンプルデータを投入してください。")
    print("    python scripts/seed_data.py")


if __name__ == "__main__":
    setup()
