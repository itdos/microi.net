# V 8関数リスト-バックエンド
## 紹介
> * サーバー側v 8エンジンコードとフロントエンドv 8のプログラミング言語はJavascript文法です。
> * サーバー側v 8エンジンはES6文法をサポートしています。
> * サーバー側v 8エンジンはバックエンドのオブジェクト、メソッドを統合し、jsを使用してバックエンド・メソッド (http以外) を呼び出すことができます
> * サーバー側v 8エンジンコードはサーバー側で実行されます。
> * サーバー側v 8関数は、主にフォーム属性のサーバー側v 8イベント、インタフェースエンジン、データソースエンジンなどに使用されます

## インターフェースエンジンV8.ApiEngine
> * [インターフェースエンジン詳細紹介](/doc/v8-engine/api-engine)
> * サーバー側v 8イベントは、インタフェースエンジン (http以外) を直接呼び出すことができ、インタフェースエンジンはインタフェースエンジンを呼び出すこともできます
> * V8イベントまたはインタフェースエンジンは、別のインタフェースエンジンが呼び出されたときに、イベントオブジェクトを渡すことができ、同じトランザクションであることを保証します
```javascript
//调用方式：
var result = V8.ApiEngine.Run('ApiEngineKey', { 
    Param1 : '1',
});
//同一事务
var resul2 = V8.ApiEngine.Run('ApiEngineKey', { 
    Param2 : '1',
}， V8.DbTrans);
```

## フォームエンジンV8.FormEngine
> * プラットフォームドキュメントを参照:[FormEngineの使い方](/doc/v8-engine/form-engine.html)

## キャッシュ操作V8.Cache
> * 分散キャッシュ操作クラス、使用法V8.Cache('key' 、 'value' 、 '0.00:10:00');
> * 注意: 有効期限のフォーマットは必ず`d.HH:mm:ss`のように`0.12:00:00`0日12時間`1.10:10:00`一日10時間10分、有効期限パラメータを渡さなくても、永久になる。
> * 推奨するキャッシュKey命名規則は次のとおりです`Microi:${V8.OsClient}:{分类key值}:{Key}`、これはプラットフォームのキャッシュKey命名規則と一致し、見やすく、SaaSテナントを区別し、キャッシュの混乱を防ぐ
```javascript
var cacheKey = `Microi:${V8.OsClient}:FormData:baoming`;
var cacheValue = JSON.stringify(formData);
//写缓存
var result1 = V8.Cache.Set(cacheKey, cacheValue, '0.00:00:59');//返回bool类型
//获取缓存
var result2 = V8.Cache.Get(cacheKey);//返回string类型，无缓存返回null
//删除缓存。注：若在Set时设置了有效期，到期会自动删除。
var result3 = V8.Cache.Remove(cacheKey);//返回bool类型
```
* 認証コードキャッシュKey命名規則:
```
`Microi:${OsClient值}:{分类key值}:{Key}`
示例：
`Microi:iTdos:Captcha:aaaa-bbbb-cccc`
```
* プラットフォームのredis keyプレフィックスは、常にレベル4しかありません
> * 第一級は、他のサードパーティのシステムが同じredisインスタンスを共有している場合、どのredisフォルダがコードプラットフォームで使用されているかを区別するために使用されます
> * Saasテナントを区別するための第2レベル
> * 第三級はredis分類を区別するために使用されます。例えば、認証コードの種類です。
> * 第4級は最終的に使うkeyです

## C # システムクラスSystem
> * サーバー側v 8コードは、.net下のSystem名前空間をそのまま使用できます
```csharp
//生成一个服务器端GUID值
System.Guid.NewGuid()

//将字符串转为base64字符串，建议使用后封装的V8.Base64
var bytes = System.Text.Encoding.UTF8.GetBytes(originalString);  
var base64String = System.Convert.ToBase64String(bytes);

//解密base64，，建议使用后封装的V8.Base64
var bytes = System.Text.Encoding.UTF8.GetBytes(originalString);  
var base64String = System.Convert.ToBase64String(bytes);

//等待1000毫秒
System.Threading.Thread.Sleep(1000);

//调用服务器端全局V8函数，获取yyyy-MM-dd HH:mm:ss格式的当前时间字符串。若获取日期格式，可使用new Date();
V8.Action.GetDateTimeNow()

//如果在服务器端全局V8函数是通过function DateNow(){}这样定义的，则可以直接使用DateNow()
var nowDate = DateNow('yyyy_mm-dd HH:mm:ss');

//异步执行V8代码，方法1（推荐）
var timer1 = setTimeout(function() {
    V8.FormEngine.UptFormData('diy_test1', {
      Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
      Text45 : '2222',
    });
}, 1000);
//可在timer1开始执行前随时手动提前终止定时执行
clearTimeout(timer1);

//异步执行V8代码，方法2
System.Threading.Tasks.Task.Run(function(){
  //实现setTimeout(function, 1000)的效果，不加则是setTimeout(function, 0)的异步效果
  System.Threading.Thread.Sleep(1000);
  V8.FormEngine.UptFormData('diy_test1', {
    Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
    Text45 : '2222',
  });
});
```

## よく使う関数V8.Method
> * いくつかのよく使われる関数を統合して、拡張をカスタマイズできます
```javascript
//从redis中获取当前登陆用户的token和身份信息
//token：可选，是否包含Bearer均支持
//osClient：可选
var currentTokenObj = V8.Method.GetCurrentToken(token, osClient)
//返回：{ OsClient : '', CurrentUser : {}, Token : '不包含 Bearer ' } 或 null

//刷新用户的登陆身份redis缓存信息，必传userId、osClient
V8.Method.RefreshLoginUser(userId, osClient)

//获取私有文件的临时访问地址，可传入FilePathName、或FilePathNames
V8.Method.GetPrivateFileUrl()
var result = V8.Method.GetPrivateFileUrl({
    FilePathName : '/microi/file/2023-08-06/xxx.doc',
    //FilePathNameS : ['/microi/file/2023-08-06/xxx.doc']
});
//返回{ Code : 1/0, Data : '临时访问地址'/['临时访问地址'], Msg : '错误信息' }

//添加系统日志
V8.Method.AddSysLog({
	Type : '', //日志类型，自定义文字，如：接口日志、性能日志、登录日志等
	Title : '', //日志标题，如：张三登录了系统
	Content: '', //日志内容，如：张三在2024-12-12 20:13通过扫码登录了系统 
	OtherInfo : '', //其它信息，如：{ Append : 'test' }
	Remark : '', //日志备注
	Level : 1,//日志等级
});
```

## V8.Base64
> * Base64変換は、System.Convert.ToBase64String(bytes) とは異なり、V8.Base64に異常があるとソース文字列に直接戻ります
```javascript
var result = V8.Base64.StringToBase64('123456');
var result = V8.Base64.Base64ToString('MTIzNDU2');
```

## 現在のユーザーv8.current user
> * 現在ログインしているユーザー情報には、ユーザーが所属するロール、組織などが含まれ、フォームエンジンを使用してsys_userテーブルにフィールドを追加する情報が含まれています。
> * ログインしていないときにアクセスした値が {}
```js
var userName = V8.CurrentUser.Name;
```

## データベースオブジェクトV8.Db
> * データベース・アクセス・オブジェクト、Dos.ORM、SqlSugarの切り替えをサポート
```csharp
//用例：
var list = V8.Db.FromSql("select * from table")//也可以使用V8.DbTrans.FromSql()
                .ToArray(); //返回数组数据，一般用于select查询多条数据语句
                //返回受影响行数，一般用于update、delete、insert语句
                .ExecuteNonQuery(); 
                //返回单条数据，一般用于select查询单条数据语句
                .First(); 
                //返回单条数据的单个字段值，一般用于select单条数据查询、聚合函数、单个字段，如：select sum(Money) from table、select Name from table
                .ToScalar(); 
```

## データベース読み取り専用オブジェクトV8.DbRead
> * データベース読み取り専用オブジェクトです。使用法はV8.Dbと同じです。データベースに読み書き分離が配備されていない場合、このオブジェクトはV8.Dbオブジェクトの値と一致します。

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

## データベーストランザクションV8.DbTrans
> * データベーストランザクションオブジェクトは、次のようにV8.Dbのように使用できます
```js
var array = V8.DbTrans.FromSql('...').ToArray();
```
* インタフェースエンジンでtry catchを使用して異常をキャッチした後に【V8.DbTrans.Roll back()】を実行すると、インタフェースエンジンの外部が異常を認識して【V8.DbTrans.Roll back()】を実行することは考慮しないでください
* インターフェースエンジンの例
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
  return { Code : 1 };//平台会自动提交事务，因为返回的Code=1
}else{//如果第二张表操作失败
  return { Code : 0, Msg : result.Msg };//平台会自动回滚事务，因为返回的Code=0
}
```

## V8.MongoDb
### 紹介
> * この記事では、インタフェースエンジン、バックエンドv 8イベントでMongoDBを操作する方法について説明します
> * MongoDBへの新規追加操作は、対応するデータベース名とテーブル名を自動的に生成するため、ライブラリ、テーブル分割ルールをカスタマイズできます

### データadd formdataの追加
> * カスタムデータベース名、テーブル名ですが、存在しない場合は自動的に作成されます
```javascript
//可以指定固定的Id值
var newId = V8.MongoDb.NewId();
V8.MongoDb.AddFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : newId, //也可以不指定，会自动生成
	_FormData : {
		Name : '张三',
		Sex : '男',
		Age : 18
	}
});
```
### データの修正DelFormData
```javascript
V8.MongoDb.UptFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
	_FormData : {
		Name : '张三',
		Sex : '男',
		Age : 18
	}
});
```
### データを削除する
```javascript
V8.MongoDb.DelFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

### クエリデータリストGetTableData
```javascript
V8.MongoDb.GetTableData({
	DbName : '', //数据库名称，如：sys_log_itdos
	TableName: '', //表名名称，如：log_202412
  _Where : [
    ['Type', '=', '访问菜单'], 
    ['OR', 'Type', '=', '点击V8按钮']
  ]
});
```

### 単一のデータを照会するGetFormData
```javascript
V8.MongoDb.GetFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

## V8.Http
> * Restシャープのカプセル化については、フロントエンドv 8のpostはV8.Post() であることに注意してください。現在、一時的にV8.Httpをカプセル化していないので、一時的な書き方が一致せず、後期に統一されます。
```javascript
//post请求，返回string，对应的也有V8.Http.Get，参数名称则为GetParam
var loginResult = V8.Http.Post({
  Url : 'http://192.168.0.173:1052/api/SysUser/login', //必传
  PostParam : { Account : 'admin', Pwd : '****', OsClient : 'veken' },
  //注意目前PostParam暂不支持多级属性，如：{ User: { Account : 'admin' }, OsClient : 'veken' }，此时则需要传入序列化后的字符串，如：
  PostParamString : JSON.stringify({ User: { Account : 'admin' }, OsClient : 'veken' }),
  ParamType : 'json', //请求类型，默认form
  Timeout : 5, //请求超时时间，单位秒，默认5秒
  Headers : { token : '', did : ''  }, //请求报文，参数名也可以是Header，平台均支持
  FilesByteBase64 : {}, //上传文件，后期补充用法
  FilesByteString : {}, //上传文件，后期补充用法
});

//post请求，返回Response对象，目前里面暂时只包含Headers、Content。，对应的也有V8.Http.GetResponse，参数数名称则为GetParam
var loginResult2 = V8.Http.PostResponse({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  PostParam : { Account : 'admin', Pwd : '******', OsClient : 'veken' }
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
  return {
    Code : 0, Msg : '获取身份信息成功：' + getCurrentUser
  };
}else{
  //未获取到token
  return {
    Code : 0,  Msg : '获取header失败：' + loginResult2
  }
}

//发起xml请求
var result = V8.Http.Post({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  ParamType : 'xml',
  PostParamString : '<xml><text>1</text></xml>'
});
```

## V8.Header、V8.Param
> * 現在、両方ともインタフェースエンジンでの使用をサポートしており、クライアントhttp post要求インタフェースエンジンのアドレスで送信されたメッセージとRequest Payloadパラメータを取得しています。

## 暗号化クラスV8.EncryptHelper
> * Dos.Common暗号化ヘルプクラス
```javascript
var pwd = V8.EncryptHelper.DESEncode('123456');//DES加密
var pwd = V8.EncryptHelper.DESDecode('JdZe5gWKjZo=');//DES解密
var pwd = V8.EncryptHelper.SHA1('123456');
var pwd = V8.EncryptHelper.SHA256('123456');
var pwd = V8.EncryptHelper.SHA512('123456');
var pwd = V8.EncryptHelper.MD5Encrypt('123456');//MD5加密
var pwd = V8.EncryptHelper.Sha256Hex('123456');
```

## V8.Office

### メールを送信SendEmail
> * ソースコードは [/Microi.Server/Microi.Office/MicroiOffice.cs](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.Office/MicroiOffice.cs) に実装されています
```js
return V8.Office.SendEmail({
  SmtpServer : 'smtp.qq.com',
  SmtpPort : 587,
  EnableSSL : true,
  SystemEmail : 'admin@itdos.com',
  SystemEmailPwd : 'uuzrnazvv*******',
  EmailSubject : '测试接口引擎发邮件标题',
  EmailBody : '<b>测试接口引擎发邮件内容，<span style="color:red;">支持html</span></b>',
  Receivers : ['123446172@qq.com', '973702@qq.com']
});
```

## システム設定V8.SysConfig
> * システム設定情報にアクセスし、システム設定にアクセスできます`sys_config`テーブルの任意のフィールド
```js
var sysTitle = V8.SysConfig.SysTitle;
```

## SaaSエンジン情報V8.OsClientModel
> * 現在のSaaSエンジンの機密構成データにアクセスします
> * サードパーティのシステムの機密構成も、サードパーティのシステムkey、secretなどのSaaSエンジンの構成に含める必要があります
```js
//获取redis host
var redisHost = V8.OsClientModel.RedisHost;
```

## フォームデータV8.Form
> * フォーム送信イベントではフォームデータにアクセスでき、インタフェースエンジンではこのオブジェクトが空白になります。

## V8.OldForm
> * データの修正時に、バックエンドv 8イベントはV8.OldFormの修正前のデータ値にアクセスします。

## V8.FormSubmitAction
> * フォーム送信タイプ: 可能な値:`Insert` `Delete` `Update`(String型)
> * サーバー側v 8イベントにはないことに注意してください`FormOutAction`、`FormOutAfterAction`、のみ`FormSubmitAction`

## V8.EventName
> * バックエンドv 8イベント名は、グローバルv 8エンジンコードで使いやすい、可能な値:
```js
FormSubmitBefore：表单提交前V8事件
FormSubmitAfter：表单提交后V8事件
DataFilter：数据处理V8事件
WFNodeLine：流程节点条件判断V8事件
WFNodeEnd：流程节点结束V8事件
WFNodeStart：流程节点开始V8事件
```


## V8.Param
> * フロントエンドから渡されたパラメータにアクセスするために、urlパラメータ、form-dataパラメータ、payload-jsonパラメータにアクセスできます

## V8.Action
> * グローバルサーバのv 8コードでカスタマイズされたメソッドにアクセスするために使用します

## V8.InvokeType
> * 現在の呼び出しタイプにアクセスします。可能な値:`Server`、`Client`、アクセスしたV8.InvokeTypeが空の場合は、デフォルトで`Server`
> *`Server`: インタフェースエンジンでインタフェースエンジンを呼び出す、バックエンドv 8イベントでインタフェースエンジンを呼び出すなど、サーバ側の呼び出し
> *`Client`: フロントエンド呼び出し、例えばフロントエンドv 8イベントでインタフェースエンジンを呼び出し、フロントエンドでフォームを送信します。

## V8.TableModel
> * バックエンドv 8イベントで、操作の現在にアクセスできます。`diy_table`テーブルの情報

## V8.OsClient
> * 現在のOsClient値にアクセスします

## コンソール
> * Microi.net.dllはv3.5.1からコンソールからサーバー側へのログ出力をサポートしています
```js
console.log('日志输出');
console.error('日志输出');
console.warn('日志输出');
console.info('日志输出');
//服务端查看日志
docker logs microi-api
```