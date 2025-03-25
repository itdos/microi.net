V 8関数リスト-バックエンド紹介* サーバー側v 8エンジンコードとフロントエンドv 8のプログラミング言語はJavascript文法です
* サーバー側v 8エンジンはES6文法をサポートしています。
* サーバー側v 8エンジンはバックエンドのオブジェクト、メソッドを統合し、jsを使用してバックエンド・メソッド (http以外) を呼び出すことができます
* サーバー側v 8エンジンコードはサーバー側で実行されます。

V8.ApiEngineサーバー側v 8イベントは、インタフェースエンジン (http以外) を直接呼び出すことができます```javascript
//调用方式有两种，第一种：
var result = V8.ApiEngine.Run('ApiEngineKey', { 
    Param1 : '1',
});
//第二种
V8.Result = V8.ApiEngine.Run({
  ApiEngineKey : 'ApiEngineKey',
  Param1 : '1'
});
```


V8.Cacheキャッシュ操作類```javascript
//设置缓存
//第一个参数为缓存key，支持多级缓存，如：'First'、'First:OsClient'、'First:OsClient:Third'
//通常缓存Key的命名规则为第一级自定义，第二级强烈建议使用OsClient值，在saas模式下更容易区分。
//第二个参数为缓存值，需要是string类型，若要存储对象，请使用JSON.stringify()序列化
//第三个参数为有效期，格式为【HH:mm:ss】、或【dd.HH:mm:ss】。不传则为永久。
//HH范围为0-23；mm、ss范围为0-59；dd范围为0-int最大值。用例：5分钟有效期'00:05:00'、5天有效期'5.00:00:00'
var result1 = V8.Cache.Set('Test:microi:userid', '0000-0000-0000', '00:00:59');//返回bool类型
//获取缓存
var result2 = V8.Cache.Get('Test:microi:userid');//返回string类型，无缓存返回null
//删除缓存。注：若在Set时设置了有效期，到期会自动删除。
var result3 = V8.Cache.Remove('Test:A');//返回bool类型
```


システムサーバー側v 8コードは、.netのSystem名前空間を直接使用できます```csharp
//生成一个服务器端GUID值
System.Guid.NewGuid()

//将字符串转为base64字符串，建议使用后封装的V8.Base64
var bytes = System.Text.Encoding.UTF8.GetBytes(originalString);  
var base64String = System.Convert.Convert.ToBase64String(bytes);
//解密base64，，建议使用后封装的V8.Base64
var bytes = System.Text.Encoding.UTF8.GetBytes(originalString);  
var base64String = System.Convert.Convert.ToBase64String(bytes);

V8.Action.GetDateTimeNow()
调用服务器端全局函数，获取yyyy-MM-dd HH:mm:ss格式的当前时间字符串。若获取日期格式，可使用new Date();
```


V8.Methodいくつかのよく使われる関数を統合しました。```javascript
V8.Method.GetCurrentToken(token, osClient)
从redis中获取当前登陆用户的token和身份信息，token, osClient为可选参数
返回：{ OsClient : '', CurrentUser : {}, Token : '' }

V8.Method.RefreshLoginUser(userId, osClient)
刷新用户的登陆身份redis缓存信息，必传userId、osClient

V8.Method.GetPrivateFileUrl()
获取私有文件的临时访问地址，可传入FilePathName、或FilePathNames
var result = V8.Method.GetPrivateFileUrl({
    FilePathName : '/microi/file/2023-08-06/xxx.doc',
    //FilePathNameS : ['/microi/file/2023-08-06/xxx.doc']
});
返回{ Code : 1/0, Data : '临时访问地址'/['临时访问地址'], Msg : '错误信息' }

```


V8.Base64Base64変換は、System.Convert.Convert.ToBase64String(bytes) とは異なり、V8.Base64に異常があるとソース文字列が直接返されます```javascript
var result = V8.Base64.StringToBase64('123456');
var result = V8.Base64.Base64ToString('MTIzNDU2');
```


V8.current user現在ログインしているユーザー情報には、ユーザーが所属する役割、組織などが含まれ、フォームエンジンを使用してsys_userテーブルにフィールドを追加する情報が含まれています。

V8.DbデータベースアクセスDos.ORMオブジェクト```csharp
用例：
var list = V8.Db.FromSql("select * from table")
                .ToArray() //返回数组数据，一般用于select语句
                .ExecuteNonQuery() //返回受影响行数，一般用于update、delete、insert语句
                .First() //返回单条数据，一般用于select语句
                .ToScalar() //返回单个值，一般用于select 聚合函数、单个字段
```


V8.DbReadデータベース読み取り専用オブジェクト。使用方法はV8.Dbと同様で、データベースに読み書き分離が導入されていない場合、このオブジェクトはV8.Dbオブジェクトの値と一致します。

V8.Dbs.DbKeyV8.Dbs.Oracle db1.fromsql ('')(V8.Dbs.Oracle db1とV8.Db) などの複数データベースを使用します

V8.MongoDb関連記事を参照:[Microi吾コード-インタフェースエンジン実戦: MongoDB関連操作](https://microi.blog.csdn.net/article/details/144434527)V8.HttpRestシャープへのカプセル化```javascript
//post请求，返回string，对应的也有V8.Http.Get，参数数名称则为GetParam
var loginResult = V8.Http.Post({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  PostParam : { Account : 'admin', Pwd : '****', OsClient : 'veken' }
});
//post请求，返回Response对象，目前里面暂时只包含Headers、Content。，对应的也有V8.Http.GetResponse，参数数名称则为GetParam
var loginResult2 = V8.Http.PostResponse({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  PostParam : { Account : 'admin', Pwd : '@kaifa123', OsClient : 'veken' }
});
//获取header中的Authorization值
var header = loginResult2.Headers.find(item => {
  return item.Name == 'Authorization' || item.Name == 'authorization';
})
if(header){
  //再获取当前登陆身份信息，测试传入header
  var token = header.Value;
  var getCurrentUser = V8.Http.Post({
    Url: 'http://192.168.0.173:1052/api/SysUser/getCurrentUser',
    Headers: { authorization : 'Bearer ' + token}
  });
  V8.Result = '获取身份信息成功：' + getCurrentUser;
}else{
  //未获取到token
  V8.Result = '获取header失败：' + loginResult2;
}

//发起xml请求
var result = V8.Http.Post({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  ParamType : 'xml',
  PostParamString : '<xml><text>1</text></xml>'
});
```


V8.Header、V8.Param現在、どちらもインタフェースエンジンでの使用をサポートしており、クライアントhttp post要求インタフェースエンジンのアドレスで送信されたメッセージとRequest Payloadパラメータを取得しています。

V8.EncryptHelperDos.Common暗号化ヘルプクラス```javascript
//DES加密
var pwd = V8.EncryptHelper.DESDecode('JdZe5gWKjZo=');
//DES解密
var pwd2 = V8.EncryptHelper.DESEncode('123456');
V8.SysConfig
访问系统设置信息
```


V8.Formフォーム送信イベントではフォームデータにアクセスでき、インタフェースエンジンではこのオブジェクトが空白です。

V8.FormSubmitActionフォーム送信タイプ: Insert/Delete/Update(string型)
注意サーバー側v 8イベントにはFormOutAction、FormOutAfterAction、FormSubmitActionのみがあります

V8.EventNameフロントエンドv 8イベント名は、グローバルv 8エンジンコードで使いやすい、可能な値:
FormSubmitBefore: フォーム送信前のv 8イベント
FormSubmitAfter: フォーム送信後のv 8イベント
データフィルタ: データ処理v 8イベント
Wfnode line: フローノード条件判断v 8イベント
Wfnodeエンド: フローノード終了v 8イベント
WFNodeStart: プロセスノードがv 8イベントを開始します。

イベント* サーバー側データ処理v 8エンジンコード
このイベントは、リストデータの取得後に各行、フォームデータの取得後に実行されます。
カプセル化されたオブジェクト:
A) V8.RowIndex: リストデータの行インデックス,0スタート
B) V8.Form: リストデータ各行オブジェクト、フォームデータオブジェクト
C) V8.NotSaveField: 編集時に保存しないフィールドを指定します
D) V8.CacheData: キャッシュデータ用
V8.Formなど、一部のフィールドの脱感作を実現できます. 価格 = "***"; このときは必ず設定してください。V8.NotSaveField = ["価格"]; そうしないと、データを修正するときに *** がデータベースに書き込まれます。
書き方:
```javascript
var listData = [];
//如果是第一行数据、或是表单数据，从数据库中获取数据
if(V8.RowIndex == 0 || V8.RowIndex == null){
    listData = V8.Db.FromSql("select * from table").ToDataTable();
    //将数据缓存起来，第二行还要用到，没必要再从数据库取一次。
    V8.CacheData = listData;
}else{
    listData = V8.CacheData;
}
//获取第一条数据的Id值
var id = listData.Rows[0]["Id"];
//获取总共多少条数据
var rowsCount = listData.Rows.Count;
全局服务器端V8引擎代码
在系统设置-->全局服务器端v8引擎代码中新增：
//增加一个自定义全局变量：TestParam1
V8.Param.TestParam1 = "abc";
//增加一个全局自定义方法：TestAction1
V8.Action.TestAction1 = function(){
        V8.Form["Price"] = "***";
        V8.NotSaveField = ["Price"];
}
在其它服务器端V8引擎代码事件中调用：
V8.Action.TestAction1();
V8.Form.Beizhu = V8.Param.TestParam1;
```


サーバー側フォーム送信前のv 8イベントV8.Result = { Code: 0、Msg: 'エラーメッセージ' }; フォームが送信されないようにします。
注意: V8.Resultに {} オブジェクトを割り当てると、Code値に関係なく、フォームの送信、ロールバックトランザクションがブロックされます。

サーバー側フォーム送信後のv 8イベントV8.DbTrans.Roll back() とV8.Result = { Code: 0、Msg 'エラーメッセージ' }; フォームの送信をロールバックします。
注意: V8.Resultに {} オブジェクトが割り当てられている限り、Code値に関係なく、トランザクションはロールバックされます。

サーバー側v 8コードデバッグ案```javascript
//【第一步】定义是否需要向前端输出日志内容，需要调试时为true，不需要调试时为false
var isDebugLog = true;//也可以使用系统设置全局变量：var isDebugLog = V8.SysConfig.V8EngineDebugLog;
//【第二步】定义需要向前端输出的日志内容
var debugLog = {};
//获取业务数据
var list1Result = V8.FormEngineGetTableData({
    FormEngineKey: 'test1',
    _Where: [{ Name : 'field1', Value : '1', Type : '=' }]
});
if(list1Result.Code != 1){
    V8.Result = list1Result; return;
}
//【记录日志】测试记录日志1
debugLog.Log1 = list1Result.Data;
//处理业务数据
debugLog.Log2 = [];
for(var i = 0; i < list1Result.Data.length){
    var item = list1Result.Data[i];
    if(item.Number < 10){
        item.Number = '0' + item.Number;
        //【记录日志】测试记录日志2
        debugLog.Log2.push(item.Id);
    }
}
V8.Result = { 
    Code : 1, 
    Data :  , 
    DataAppend : {
        DebugLog : isDebugLog ? debugLog : ''//【第三步】判断是否向前端输出日志
    }
};
```


V8.DbTrans* 数据库事务对象，可以像V8.Db一样使用，如：
```js
var array = V8.DbTrans.FromSql('...').ToArray();
```

* 事务对象在接口引擎中必须执行【V8.DbTrans.Commit()】或【V8.DbTrans.Rollback()】
* 不用考虑在接口引擎中使用try catch捕捉异常后执行【V8.DbTrans.Rollback()】，接口引擎外部会识别到异常并且执行【V8.DbTrans.Rollback()】
* 接口引擎示例
```javascript
//操作第一张表，带事务
var result1 = V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
}， V8.DbTrans);
//操作第二张表，带事务
var result2 = V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
}， V8.DbTrans);
//如果第二张表操作成功
if(result2.Code == 1){
  V8.DbTrans.Commit();//提交事务
  return { Code : 1 }
}else{//如果第二张表操作失败
  V8.DbTrans.Rollback();//回滚事务
  return { Code : 0, Msg : result.Msg }
}
```


V8.Paramフロントエンドから渡されたパラメータにアクセスするために、urlパラメータ、form-dataパラメータ、payload-jsonパラメータにアクセスできます

V8.Actionグローバルサーバのv 8コードでカスタマイズされたメソッドにアクセスするために使用します

V8.Result戻り値用