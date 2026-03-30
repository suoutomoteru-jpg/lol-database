"""
データベース接続の設定ファイル

SQLite を使用しているため、サーバーのインストール不要です。
lol.db というファイルにデータが保存されます。
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# データベースファイルのパス（プロジェクトルートに作成されます）
DATABASE_URL = "sqlite:///lol.db"

# エンジン：データベースへの接続を管理するオブジェクト
engine = create_engine(
    DATABASE_URL,
    echo=False,  # True にすると実行されるSQLが表示されます（デバッグ用）
)

# セッション：データベース操作の単位（取得・追加・削除など）
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    """全テーブル定義の基底クラス"""
    pass


def get_session():
    """データベースセッションを取得する関数"""
    return SessionLocal()
