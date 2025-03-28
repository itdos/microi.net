# Aデータベースで構成された2つのモジュールをBデータベースにコピーする方法
> 二つの方法があります
## 第1種: Microi応用商店街を通じて
> Aプロジェクトはデータベースをアプリケーションショップにアップロードし、Bプロジェクトはアプリケーションショップにダウンロードしてインストールします
> この方法は現在推奨されていません。1つはアップロード審査問題、2つは応用商店街システムがまだ完備していないことです
## 第2種: Navicatによる関連sql文の抽出
> 2.1、diy_tableテーブルデータの取得
```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```
> 2.2、その後、図のようにinsert文を抽出します (すべてのデータを選択し、右クリックして -->Insert文にコピーします)

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/7e89e2e0ce2443a5bde99e7d5a612761.jpeg#pic_center)
> 2.3、取得したsql文をBデータベースで実行すればよい (insertinto後のデータベース名を削除することに注意)

> 以上の3つのステップは、次のsqlでデータを取得してから2回行うと同じです

```sql
//获取上面两张表的所有字段数据
select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
//获取模块引擎数据（用于复制模块）
select * from sys_menu where `Name` In('多语言管理', '项目管理')
```

> 最近、役割管理所に行ってアカウントに「多言語管理」と「プロジェクト管理」に対応するメニューモジュール権限を設定したことを覚えています。