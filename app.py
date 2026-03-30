"""
LoL データベース メインアプリケーション

コマンドラインから簡単にデータを検索・表示できます。

使い方:
    python app.py                          # メニューを表示
    python app.py champion list            # チャンピオン一覧
    python app.py champion search Ahri     # チャンピオンを名前で検索
    python app.py champion role Mid        # ロールで絞り込む
    python app.py item list                # アイテム一覧
    python app.py item search Infinity     # アイテムを名前で検索
"""

import sys
from database.connection import get_session
from database.models import Champion, Item


def print_champion(c):
    print(f"\n  名前:     {c.name} ({c.title})")
    print(f"  ロール:   {c.role}")
    print(f"  難易度:   {c.difficulty}")
    print(f"  体力:     {c.hp}  マナ: {c.mana}")
    print(f"  攻撃力:   {c.attack_damage}  鎧: {c.armor}  魔法耐性: {c.magic_resist}")
    print(f"  説明:     {c.description}")


def print_item(item):
    print(f"\n  名前:         {item.name}")
    print(f"  コスト:       {item.cost}G")
    print(f"  カテゴリ:     {item.category}")
    print(f"  攻撃力 +{item.attack_damage}  AP +{item.ability_power}  体力 +{item.health}")
    print(f"  鎧 +{item.armor}  魔法耐性 +{item.magic_resist}")
    print(f"  説明:         {item.description}")


def champion_commands(args, session):
    if not args or args[0] == "list":
        champions = session.query(Champion).order_by(Champion.role).all()
        print(f"\n-- チャンピオン一覧 ({len(champions)} 件) --")
        for c in champions:
            print(f"  {c.name:10} | {c.role:8} | {c.difficulty}")

    elif args[0] == "search" and len(args) > 1:
        keyword = args[1]
        results = session.query(Champion).filter(Champion.name.ilike(f"%{keyword}%")).all()
        if results:
            for c in results:
                print_champion(c)
        else:
            print(f"'{keyword}' に一致するチャンピオンは見つかりませんでした。")

    elif args[0] == "role" and len(args) > 1:
        role = args[1]
        results = session.query(Champion).filter(Champion.role == role).all()
        if results:
            print(f"\n-- {role} のチャンピオン ({len(results)} 件) --")
            for c in results:
                print_champion(c)
        else:
            print(f"ロール '{role}' のチャンピオンは見つかりませんでした。")
            print("有効なロール: Top, Jungle, Mid, ADC, Support")

    else:
        print("使い方: python app.py champion [list|search <名前>|role <ロール>]")


def item_commands(args, session):
    if not args or args[0] == "list":
        items = session.query(Item).order_by(Item.category, Item.cost).all()
        print(f"\n-- アイテム一覧 ({len(items)} 件) --")
        for item in items:
            print(f"  {item.name:25} | {item.cost:4}G | {item.category}")

    elif args[0] == "search" and len(args) > 1:
        keyword = args[1]
        results = session.query(Item).filter(Item.name.ilike(f"%{keyword}%")).all()
        if results:
            for item in results:
                print_item(item)
        else:
            print(f"'{keyword}' に一致するアイテムは見つかりませんでした。")

    else:
        print("使い方: python app.py item [list|search <名前>]")


def show_menu():
    print("""
LoL データベース - 使い方
==========================
チャンピオン:
  python app.py champion list              # 全チャンピオン一覧
  python app.py champion search <名前>     # 名前で検索
  python app.py champion role <ロール>     # ロールで絞り込む
                                           # ロール: Top Jungle Mid ADC Support

アイテム:
  python app.py item list                  # 全アイテム一覧
  python app.py item search <名前>         # 名前で検索
""")


def main():
    args = sys.argv[1:]
    if not args:
        show_menu()
        return

    session = get_session()
    try:
        command = args[0]
        sub_args = args[1:]

        if command == "champion":
            champion_commands(sub_args, session)
        elif command == "item":
            item_commands(sub_args, session)
        else:
            print(f"不明なコマンド: {command}")
            show_menu()
    finally:
        session.close()


if __name__ == "__main__":
    main()
