# よくある質問


::: Detailsインターフェースエンジンはどうやってメールを送りますか?【劉誠-2025-02-21】

```js
return V8.Office.SendEmail({
    SmtpServer :'smtp.qq.com'
    SmtpPort :587,
    EnableSSL : true,
    SystemEmail :'xxxx@xxxx.com',
    SystemEmailPwd :'xxxxxxx',
    EmailSubject:'测试接口引擎发邮件标题',
    EmailBody :'<b>测试接口引擎发邮件内容，支持html</b>',
    Receiver :['xxx@qq.com'，'xxxx@qq.com']
});
```
 

:::

::: 詳細システムの設定は有効でない問題を修正しましたか?【劉誠-2025-02-21】

システム設定 -- フォーム設計
サーバー側フォームが送信された後、v 8イベントはV8.Cache.Removeに変更されました。

:::


::: Detailsコピー表構造コード?【姜涛-2025-02-17】

```js
var TableId = V8.Param.TableId;
var TableName = V8.Param.TableName;
if(!TableId || !TableName){
  V8.Result = { Code : 0, Msg : '参数错误！' };
  return;
}
//判断是否未改过表名字，重复
var res = V8.FormEngine.GetTableData({
  FormEngineKey : 'Diy_Table',
  _Where: [{Name: 'Name', Value: TableName, Type: '='}]
});
if(res.Code && res.DataCount>0){
  TableName = TableName + Date.now();
}
//取原表
var oldTableModelResult = V8.FormEngine.GetFormData({
  FormEngineKey : 'Diy_Table',
  Id : TableId
});
if(oldTableModelResult.Code != 1){
  V8.Result = oldTableModelResult;
  return;
}
var oldTableModel = oldTableModelResult.Data;
var res = V8.Db.FromSql(`CREATE TABLE ${TableName} LIKE ${oldTableModel.Name}`).ExecuteNonQuery()

var tableInfo = V8.Db.FromSql(`select * from diy_table WHERE Name IN ('${oldTableModel.Name}') AND IsDeleted=0
`).ToArray()
var newTableInfo = {}
tableInfo.forEach(item=>{
  var { Id, ...row } = item;
  row.Name = TableName

  newTableInfo = V8.FormEngine.AddFormData({ 
    FormEngineKey : 'Diy_Table',//必传 
    Id : '',//可选，若不传则由服务器端自动生成guid值 
    _RowModel : row
  });
})


var fieldList = V8.Db.FromSql(`select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE Name IN ('${oldTableModel.Name}') AND IsDeleted=0) AND IsDeleted=0`).ToArray()

fieldList.forEach(item=>{
  var { Id, ...row } = item;
  row.TableId = newTableInfo.Data.Id

  V8.FormEngine.AddFormData({ 
    FormEngineKey : 'diy_field',//必传 
    Id : '',//可选，若不传则由服务器端自动生成guid值 
    _RowModel : row
  });
})

V8.Result = {Code:1,Msg:'OK'}
return

```

:::

::: Details OpenAnyTableユーザー例?【劉誠-2025-02-06】

```js
V8.OpenAnyTable({ 
  ModuleEngineKey: "diy_ShebeiDangAn", //必传。打开哪张表。 
  MultipleSelect: true, // 是否多选 
  SubmitEvent : function(selectData,callback){//提交事件
    V8.ApiEngine.Run('sbdj_AddSB_Plan',{//点击提交调用接口引擎
      Id:V8.ParentV8.Form.Id,
      selectData :selectData
    },function(result){
      if(result.Code == 1){
      V8.Tips("操作成功!",true);
      callback();//关闭弹出框
      V8.RefreshTable({ PageIndex :1 });//刷新表格
      }else{
        V8.Tips(result.Msg, false);
      }
    })
    
  }
})
```
> こちらの 'ModeuleEngineKey' はテーブル名ではないことに注意しておきましょう

![V 8コード](/faq/faq1. 0)

![V 8コード](/faq/faq2.jpg)

:::



::: Details sqlインタフェース/FormEngineを使いたくないsqlの【姜涛-2025-01-23】

コンテンツ

インタフェースエンジン名は「sql _ work」で

呼び出し方式は二つあります。

1つ目は

```js
V8.ApiEngine.Run('sql_work', {
   Sql: 'select * from diy_test where IsDeleted = 0'
});
```

第二種

```js
V8.ApiEngine.Run({
   ApiEngineKey : 'sql_work',
   Sql : 'select * from diy_test where IsDeleted = 0'
});
```

** インターフェースコードは以下の通り **:

```js
var sql = V8.Param.Sql;
if(!sql){
  V8.Result = {Code:0,Msg:'参数错误'}
  return
}
var Fname = V8.Param.Fname || 'ToArray';
var functionList = ['ToArray','ExecuteNonQuery','First','ToScalar']
if( functionList.indexOf(Fname) == -1){
  V8.Result = {Code:0,Msg:'方法不存在'}
  return
}
var result = V8.Db.FromSql(sql)[Fname]();
if(Fname == 'ToArray'){
  var DataCount = result.length 
}else{
  var DataCount = 1
}
var DataCount = 
V8.Result = {
  Code : 1,
  Data : result,
  Sql : sql,
  DataCount : DataCount
};
return;
```

:::




::: Details富テキストエディタアップロード画像が無効ですか?【劉誠-2025-01-09】

```js
var filesByteBase64 = V8.FilesByteBase64;

if(!filesByteBase64){

 V8.Result = {

   "errno": 1, // 只要不等于 0 就行

   "message": "未发现文件！"

 }; return;

}

if(Object.values(filesByteBase64).length == 0){

 V8.Result = {

   "errno": 1, // 只要不等于 0 就行

   "message": "未发现文件！"

 }; return;

}

var result = V8.Method.Upload({

 FilesByteBase64 : filesByteBase64,

 //Multiple : true,//editor上传多张图片这个接口会调用多次，每次都是单图

 OsClient : V8.OsClient

});

if(result.Code != 1){

 V8.Result = {

   "errno": 1, // 只要不等于 0 就行

   "message": result.Msg

 }; return;

}

var tupian = result.Data.Path;

if(tupian){

 tupian = tupian.replace('//20', '/20');

}

var editorResult = {

 "errno": 0, // 注意：值是数字，不能是字符串

 "data": {

     "url": V8.SysConfig.FileServer + tupian, // 图片 src ，必须

     "alt": result.Data.Name, // 图片描述文字，非必须

     "href": "" // 图片的链接，非必须

 }

};

editorResult['Debug'] = {};

V8.Result = editorResult;
```


![画像の失効](/faq/faq3.png)

:::


::: 詳細承認プロセスが終了した後、発起人はプロセスのインタフェースを続けますか?【劉誠-2025-01-06】

```js
V8.Post('/api/WorkFlow/sendWork', {

WorkId: "",//wf_work的Id

FlowId: "",//Wf_flow的Id

FormData: {},//表单字符串

ApprovalType: "Agree",//流程状态同意

ApprovalIdea: "",//审核意见

NoticeFields: []//节点字段名

});
```

:::

::: Details固資app接続エラー証明書の有効期限が切れた問題、rfidプラグインの初期化失敗問題?【崔思敏-2025-01-02】

1. PDAコードガン 'app' 呼び出しインターフェイスが証明書の有効期限のエラーメッセージを返し、他の方法で開くのは正常で、PDAコードガンを見て日付と時刻の設定を変更する必要がある

2. 'rfid' プラグインの初期化に失敗した問題: キーボードアシスタントの有効スイッチをオフにする。

![V 8コード](/faq/faq05.Png)

:::

::: Detailsインタフェースエンジンが他のデータベースへの接続に失敗した解決策 (マルチデータベース管理)?【劉誠-2024-12-26】

1.データベース管理にデータベースを追加して、データに正常に接続できますが、インタフェースエンジンは「v 8.Dbs.jdoracle.Fromsql」でエラーが発生します

2.データベース文字列が正常かどうかを確認し、正常であれば、再テストして、「v 8.Result = V8.Dbs.Jd oracle」をテストして、空の値かどうかを印刷して、解決策は次の通りです

3.データベースを追加することは直接有効ではなく、サーバのコントロールパネル、コンテナ管理、対応する「api」を再起動する必要がある

:::

::: Detailsシステムログが表示されない処理方法?【劉誠-2024-12-25】

1.まず「https:// os.Nbweixin」クエリに行って、「saas」がライブラリ内の「dbmongoconnect」を開いてデータを入手し、接続が正常かどうかを検証する。
![画像の失効](/faq/faq07.png)

2.それから「1パネール」パネルに行って、この「mongdb」ポートが開放されているかどうかを確認します。
![画像失効](/faq/faq08.png)

3.「mongdb」の変更が正常であることを確認し、「os.Nbweixin」が正常に変更された後、「api」容器を再起動する。
![画像の失効](/faq/faq09.png)

:::

::: Detailsはカスタムインタフェースを修正しました。ヒント: インタフェースのカスタムアドレスキャッシュの更新に失敗しました: ログインidが期限切れになりましたか?【姜涛-2024-12-22】
エラー画像
![画像失効](/faq/faq10.png)

インターフェイスエンジンモジュール設計に入り、フロントエンドがフォームを離れた後のv 8イベントをコメントアウトします。
![画像失効](/faq/faq11.png)

:::


::: Details uniappアップロードファイルバグ-パラメータバグ、ブール型は文字列タイプが値を伝えるべきですか?【姜涛-2024-12-21】

![画像失効](/faq/faq12.png)

:::

::: 詳細レポートエンジンのテーブル名はレポートkeyに付いて行かず、レポート名に付いて行くのか?【姜涛-2024-12-14】
「Rpt _ 関税」表のサーバー側フォームが前v 8イベントを提出し、サークルの中のこのコードを私のものに変更すればいいです。
![画像失効](/faq/faq13.png)


:::

::: Detailsモジュール設計where条件が文字化けし、カスタムボタンが保存できないのか?【劉誠-2024-12-11】

フォームエンジンで「sys _ menu」、フォームデザイン、サーバーフォーム提出前のv 8イベントを見つけて、次のコードを書く必要があります

```js
var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];

base64ToStringArr.forEach(item => {

 if(V8.Form[item]){

   V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);

 }

})
```

:::

::: Detailsドロップダウンチェック、初期値が表示されない問題?【劉誠-2024-12-09】

![画像の失効](/faq/faq14.png)

> ドロップダウンチェックを対応するフィールドに格納するように書く必要があります。

:::

::: 詳細テンセントは返金問題を支払いますか?【姜涛-2024-12-06】

1.テスト通過インターフェイスで腾讯の返金インターフェイスを呼び出し、「object reference t set to an instance of an object」を提示する

2.このエラーメッセージは、マイクロレターの暗号化パラメータの文に問題があるからですが、このインタフェースを直接呼び出すとokです

3.だから、返金インタフェースを操作インタフェースにコピーして、「function」を生成してから実行すればokです

:::

::: かもしれませんアプリビジブル、アプリディスプレイ问题?【崔思敏-2024-12-05】

1. 【必須】データベース管理ツールに手動で行って【diy_field】テーブルにフィールドを追加する: 【AppVisible、bit、空白可】。

そして「フォームエンジン」-> 「diy_field」テーブル-> 「異常フィールド選択AppVisible修復」に行く。

SQLの実行:

```sql
update diy_field set AppVisible=1 where Visible=1
```

2. 【必須】データベース管理ツールに手動で「sys_menu」にフィールドを追加します。

そして「フォームエンジン」-> 「sys_menu」テーブル-> 「異常フィールド選択AppDisplay修復」に行く。

SQLの実行:

```sql
update sys_menu set AppDisplay=1 where Display=1
```

:::

::: 詳細フォームのデザインキャッシュを整理する方法は?【劉誠-2024-11-21】

1.フォーム設計 (Sys_Config) サーバー側フォームが送信された後、v 8イベントは次のv 8コードを追加する必要があります (標準ライブラリを参照)

```js
V8.Cache.Remove(`SysConfig:${V8.OsClient}`);
```

2.フォーム設計 (Sys_ApiEngine) サーバー側フォーム送信後のv 8イベントには、次のv 8コードを追加する必要があります (標準ライブラリを参照)

```js
var cacheKey = `FormData:${V8.OsClient}:sys_apiengine:${V8.Form.ApiEngineKey.toLowerCase()}`;

V8.Cache.Remove(cacheKey);

if(V8.Form.ApiAddress){

 var id2 = V8.Form.ApiAddress.replace(/\//g, '___').toLowerCase();

 var cacheKey2 = `FormData:${V8.OsClient}:sys_apiengine:${id2}`;

 V8.Cache.Remove(cacheKey2);

}
```

:::

::: 詳細はモジュールを保存した後、役割管理に行くとエラーになる可能性がある解決策 (暗号化復号プロセス)?【劉誠-2024-11-21】

> 开発中のシステムは、最新の 'v1.9.5.7 'というテスト环境の 'api' インターフェースシステムバージョンを使用していれば:

フォームデザイン --> 検索sys_menu --> 「サーバー側データ処理v 8イベント」と「サーバー側フォーム送信前v 8イベント」に同じv 8コードを追加する必要があります。その後、ロール管理に行くとエラーになる可能性があります) (私にも仕方がありませんモジュールエンジンは現在もカスタム開発されているため、暗号化転送機能が強制的に追加され、次のv 8コードが復号化されていないと問題が発生します。

```js
var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];

base64ToStringArr.forEach(item => {

 if(V8.Form[item]){

   V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);

 }

})
```

:::

::: Detailsモバイル端末表示フィールドAppVisible一括処理方法? 【劉誠-2024-11-21】
1. 【必須】データベース管理ツールに手動で行って、diyfieldテーブルにフィールドを追加します。Sqlを実行します

```sql
update diy_field set AppVisible=1
```

そして「フォームエンジン」-> 「diy_field」テーブル-> 「異常フィールド選択AppVisible修復」に行きます。

2.フォームエンジン->【sys_menu】表1> スイッチコントロールを追加: AppDisplay (モバイル端末表示)。デフォルトで表示したいなら

```sql
update sys_menu set AppDisplay=1 where Display=1
```

:::

::: Detailsインターフェイスで二次元コード画像を生成する方法(BASE64形式)?【劉誠-2024-11-21】

https:// ヘッダー

:::

::: Detailsフォームとモジュールを他のデータベースにコピーしますか?【劉誠-2024-11-21】

Aデータベースで構成された2つのモジュールは、どのようにBデータベースにコピーされますか?

二つの方法があります

第1種: Microi応用商店街を通じて

Aプロジェクトはデータベースパッケージを応用商店街にアップロードし、Bプロジェクトは応用商店街にダウンロードしてインストールする

この方法は現在推奨されていません。1つは審査問題をアップロードすること、2つは商店街システムを応用することがまだ十分ではありません

第2種: Navicatによる関連sql文の抽出

「Diy _ table」テーブルデータを取得します

```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```

次に、図のように 'insert' 文を抽出します (すべてのデータを選択し、右クリックして-> insert' 文にコピーします)

![画像失効](/faq/faq13.jpeg)

取得した「sql」文を「b」データベースに入れて実行すればよい (「insert into」後のデータベース名を削除することに注意してください)

以上の3つのステップは、次の「sql」でデータを取得してから2回行うと同じです

```sql
//获取上面两张表的所有字段数据

select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
```

```sql
//获取模块引擎数据（用于复制模块）

select * from sys_menu where `Name` In('多语言管理', '项目管理')

```

最近、役割管理所に行ってアカウントに「多言語管理」と「プロジェクト管理」に対応するメニューモジュール権限を設定したことを覚えています。

原文リンク: https://blog.csdn.net/qq973702/article/details/143950112

:::

::: Details検索欄が複数の検索項目を同時に使用できない問題は?【胡佳瑶-2024-11-20】

「モジュールエンジン」-「検索可能な列」では、同時に検索する必要があるフィールドを選択し、同じ表現方法を選択します。例えば、「デフォルト」または「外部」を選択します。

検索が必要な複数のフィールドが、それぞれ「デフォルト」と「外部」を選択している場合は、同時に使用することはできません。

:::

::: Detailsインタフェースエンジンが有効になるバグ手動ソリューションを2回保存する必要がありますか?【崔思敏-2024-11-20】

フォームデザイン-【Sys_ApiEngine】、【サーバー側フォーム送信後v 8イベント】


```js
var cacheKey = `FormData:${V8.OsClient}:sys_apiengine:${V8.Form.ApiEngineKey.toLowerCase()}`;

//2024-11-01：注意在此处是无法获取到此条数据的最新版，因为此时事务还未提交

/*

var formModel = V8.FormEngine.GetFormData({

 FormEngineKey:'sys_apiengine',

 Id : V8.Form.Id,

 OsClient: V8.OsClient

}).Data;

*/

//所以使用V8.Form，而不是formModel

var formModel = JSON.stringify(V8.Form);

V8.Cache.Set(cacheKey, formModel);

if(V8.OldForm.ApiEngineKey && V8.OldForm.ApiEngineKey != V8.Form.ApiEngineKey){

 V8.Cache.Remove(`FormData:${V8.OsClient}:sys_apiengine:${V8.OldForm.ApiEngineKey.toLowerCase()}`);

}

if(V8.Form.ApiAddress){

 var apiPath = V8.Form.ApiAddress.toLowerCase();//.replace(/\//g, '___')

 var cacheKey2 = `FormData:${V8.OsClient}:sys_apiengine:${apiPath}`;

 V8.Cache.Set(cacheKey2, formModel);

 if(V8.OldForm.ApiAddress && V8.OldForm.ApiAddress != V8.Form.ApiAddress){

   V8.Cache.Remove(`FormData:${V8.OsClient}:sys_apiengine:${V8.OldForm.ApiAddress.toLowerCase()}`);

 }

}
```

:::

::: Detailsフォームフィールドを保存するとログイン問題を終了しますか?【崔思敏-2024-11-20】

「Diy _ table」、「diy _ field」の2つのテーブルの「オスカー」を空に変更し、「sql」の書き方を参照する必要があります

```js
var res = V8.Db.FromSql("update diy_table set OsClient=''").ExecuteNonQuery()
```

:::

::: 詳細通常アカウント登録、ページ更新、新規追加などのボタンがなくなりましたか?【劉誠-2024-11-26】


フォームエンジンの中で、非 'diy' テーブルを選択し、 'sys _ 積極的に 'テーブルをロードする必要があります。

:::



