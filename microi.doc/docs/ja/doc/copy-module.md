Aデータベースで構成された2つのモジュールをBデータベースにコピーする方法二つの方法があります第1種: Microi応用商店街を通じてAプロジェクトはデータベースパッケージを応用商店街にアップロードし、Bプロジェクトは応用商店街にダウンロードしてインストールする
この方法は現在推奨されていません。1つは審査問題をアップロードすること、2つは商店街システムを応用することがまだ十分ではありません第2種: Navicatによる関連sql文の抽出2.1.diy_tableテーブルデータの取得```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```

2.2.その後、図のようにinsert文を抽出します (すべてのデータを選択し、右クリックして -->Insert文にコピーします)

![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/7e89e2e0ce2443a5bde99e7d5a612761.jpeg#pic_center)2.3.取得したsql文をBデータベースで実行すればよい (insertinto後のデータベース名を削除することに注意してください)。

以上の3つのステップは、次のsqlでデータを取得してから2回行うと同じです

```sql
//获取上面两张表的所有字段数据
select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
//获取模块引擎数据（用于复制模块）
select * from sys_menu where `Name` In('多语言管理', '项目管理')
```


最近、役割管理所に行ってアカウントに「多言語管理」と「プロジェクト管理」に対応するメニューモジュール権限を設定したことを覚えています。