# 拡張データベース

## 紹介
> * プラットフォームは`数据库管理`にデータベース接続文字列を追加します
> *`表单引擎`テーブルを作成するときに、どのテーブルを作成するかを選択できます`数据库`
> *`接口引擎`で使用できます`V8.Dbs.DbKey`指定されたアクセス`数据库`

## 拡張データベースオブジェクトV8.Dbs.DbKey
> * マルチデータベース (拡張ライブラリ) のオブジェクトにアクセスし、拡張ライブラリ管理は [ https://web.microi.net/#/database](https://web.microi.net/#/database ) を参照してください
> * 注意: 古いデータベースバージョンの上のテーブルには「DbKey」フィールドがありません。データベースを更新するか、手動で追加するか、アプリケーションショップのオンライン「データベース管理」アプリケーションのインストールを待つ必要があります。
> * 例: oracle拡張ライブラリにアクセスすると、DbKeyの値はoracle db1で、V8.Dbs.oracle db1オブジェクトはV8.Dbオブジェクトと同じです。
```js
var dataList = V8.Dbs.OracleDB1.FromSql('').ToArray();

//扩展数据库的事务用法
var emptyExTrans = V8.Dbs.EmptyEx.BeginTransaction();
var count = emptyExTrans.FromSql("delete from diy_extend_test where Id='49ec484d-a2cf-47fe-b498-6efb2bf9f99d'").ExecuteNonQuery();
//emptyExTrans.Commit();//提交事务
emptyExTrans.Rollback();//回滚事务
emptyExTrans.Close();//释放事务对象
return { Code : 1, Data : count };
```
> * 既知の問題: プラットフォームに拡張ライブラリを追加した後、apiのdockerコンテナを再起動する必要があります