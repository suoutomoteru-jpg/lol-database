"""
データベースのテーブル定義ファイル

各クラスが1つのテーブルに対応しています。
クラスの属性がテーブルの列（カラム）になります。
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
from database.connection import Base


# ---- 中間テーブル（チャンピオンとアイテムの多対多関係） ----
# 1人のチャンピオンが複数のアイテムを持ち、
# 1つのアイテムが複数のチャンピオンに使われるため、中間テーブルが必要です。
champion_items = Table(
    "champion_items",
    Base.metadata,
    Column("champion_id", Integer, ForeignKey("champions.id"), primary_key=True),
    Column("item_id", Integer, ForeignKey("items.id"), primary_key=True),
)


class Champion(Base):
    """
    チャンピオンテーブル

    LoL に登場するチャンピオンの情報を格納します。
    """
    __tablename__ = "champions"

    id = Column(Integer, primary_key=True)          # 一意な識別番号
    name = Column(String(100), nullable=False)       # チャンピオン名（例: Ahri）
    title = Column(String(200))                      # 称号（例: the Nine-Tailed Fox）
    role = Column(String(50))                        # ロール（Top / Jungle / Mid / ADC / Support）
    difficulty = Column(String(20))                  # 難易度（Easy / Medium / Hard）
    hp = Column(Integer)                             # 基本体力
    mana = Column(Integer)                           # 基本マナ
    attack_damage = Column(Integer)                  # 基本攻撃力
    armor = Column(Integer)                          # 基本鎧
    magic_resist = Column(Integer)                   # 基本魔法耐性
    description = Column(Text)                       # チャンピオンの説明

    def __repr__(self):
        return f"<Champion(name='{self.name}', role='{self.role}')>"


class Item(Base):
    """
    アイテムテーブル

    LoL に登場するアイテムの情報を格納します。
    """
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)           # 一意な識別番号
    name = Column(String(100), nullable=False)        # アイテム名（例: Infinity Edge）
    cost = Column(Integer)                            # 購入コスト（ゴールド）
    category = Column(String(50))                     # カテゴリ（Attack / Magic / Defense / Support）
    attack_damage = Column(Integer, default=0)        # 攻撃力ボーナス
    ability_power = Column(Integer, default=0)        # アビリティパワーボーナス
    armor = Column(Integer, default=0)                # 鎧ボーナス
    magic_resist = Column(Integer, default=0)         # 魔法耐性ボーナス
    health = Column(Integer, default=0)               # 体力ボーナス
    description = Column(Text)                        # アイテムの説明

    def __repr__(self):
        return f"<Item(name='{self.name}', cost={self.cost})>"
