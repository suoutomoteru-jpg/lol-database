# LoL データベース

League of Legends のチャンピオンとアイテムを管理するデータベースプロジェクトです。

## プロジェクト構成

```
lol-database/
├── README.md               # このファイル
├── requirements.txt        # 必要なライブラリ
├── app.py                  # メインアプリ（検索・表示）
├── database/
│   ├── connection.py       # DB接続設定
│   └── models.py           # テーブル定義
├── data/
│   ├── champions.json      # チャンピオンデータ
│   └── items.json          # アイテムデータ
└── scripts/
    ├── setup_db.py         # DB初期化（最初に1回実行）
    ├── seed_data.py        # サンプルデータ投入
    └── query_examples.py   # クエリ例（学習用）
```

## セットアップ手順

### 1. ライブラリをインストール

```bash
pip install -r requirements.txt
```

### 2. データベースを初期化

```bash
python scripts/setup_db.py
```

### 3. サンプルデータを投入

```bash
python scripts/seed_data.py
```

### 4. データを確認

```bash
python scripts/query_examples.py
```

## アプリの使い方

```bash
# チャンピオン一覧
python app.py champion list

# 名前で検索
python app.py champion search Ahri

# ロールで絞り込む（Top / Jungle / Mid / ADC / Support）
python app.py champion role Mid

# アイテム一覧
python app.py item list

# アイテムを名前で検索
python app.py item search Infinity
```

## データベース構造

### champions（チャンピオンテーブル）

| カラム名 | 型 | 説明 |
|---|---|---|
| id | INTEGER | 一意な識別番号 |
| name | TEXT | チャンピオン名 |
| title | TEXT | 称号 |
| role | TEXT | ロール（Top/Jungle/Mid/ADC/Support）|
| difficulty | TEXT | 難易度（Easy/Medium/Hard）|
| hp | INTEGER | 基本体力 |
| mana | INTEGER | 基本マナ |
| attack_damage | INTEGER | 基本攻撃力 |
| armor | INTEGER | 基本鎧 |
| magic_resist | INTEGER | 基本魔法耐性 |
| description | TEXT | 説明 |

### items（アイテムテーブル）

| カラム名 | 型 | 説明 |
|---|---|---|
| id | INTEGER | 一意な識別番号 |
| name | TEXT | アイテム名 |
| cost | INTEGER | 購入コスト（ゴールド）|
| category | TEXT | カテゴリ（Attack/Magic/Defense/Support）|
| attack_damage | INTEGER | 攻撃力ボーナス |
| ability_power | INTEGER | アビリティパワーボーナス |
| armor | INTEGER | 鎧ボーナス |
| magic_resist | INTEGER | 魔法耐性ボーナス |
| health | INTEGER | 体力ボーナス |
| description | TEXT | 説明 |
