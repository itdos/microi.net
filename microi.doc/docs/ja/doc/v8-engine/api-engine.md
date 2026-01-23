# インターフェースエンジン

## プロフィール
> *`写一个获取数据的接口只要1分钟`、インタフェースエンジンはプラットフォームの最大のハイライトの一つとして、主に複雑なビジネスロジックを解決し、カスタムインタフェースを統一的に管理する
> * オンラインでJavaScriptを使用してapiインタフェースを作成します。`AI代写V8引擎代码`](https://microi.net/doc/v8-engine/ai-apiengine.html)** 、サポート`[Get、Post]`リクエスト、サポートリターン`[JSON、字符串、文件、HTML]`など、サポート`[自定义接口地址、分布式锁、权限、自定义扩展函数]`など
> * 任意の複雑な業務シーンを実現できます。`极致的性能（V8代码预编译、多级缓存）`と`开发效率`、不要`本地编译发布`、保存が有効になります
> * 8年以上の成功事例の検証を経て、一部のプロジェクトは500個以上のインターフェースに達した。 [FormEngineの使い方](/doc/v8-engine/form-engine) [Where条件の使い方](/doc/v8-engine/where)

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/Microi20260122.png)

```js
//获取一个数据列表
var result = V8.FormEngine.GetTableData('tableName', {
  _Where : [ // WHERE GuanLianID = 1 OR GuanLianID IS NULL
    ['GuanLianID', '=', '1'],
    ['OR', 'GuanLianID', '=', null]
  ],
  _PageIndex : 1,
  _PageSize : 15,
});
return result;
```

## 強力なv 8デバッグ機能
> * サポート`本地`、`在线`2つの方法でv 8インターフェースエンジンを作成します。`双向增量同步`オンライン、ローカルのv 8コード
> * サポート`本地调试V8事件代码`、`接口引擎代码`を選択します。`平台插件源码`関連デバッグ
>* **整个接口请求全路径支持`断点调试`**：
> 1.`前端`フォームがv 8イベントに入る`[支持调试]`
> 2.`前端`フォーム送信前のv 8イベント`[支持调试]`
> 3.`后端`フォーム送信前のv 8イベント`[支持调试]`
> 4. **'バックエンド' v 8イヴォントコール <font color = "red"> インターフェースエンジェン </font>**`[支持调试]`
> 5. **'バックエンド' インターフェースエンジェン呼出 'v 8.Cache' なバカのバックエクステンションのソースコード**`[支持调试]`
> 6.`后端`フォーム送信後のv 8イベント`[支持调试]`
> 7.`前端`フォーム送信後のv 8イベント`[支持调试]`

## すべてのバックエンドV8関数をサポート
> * プラットフォームドキュメントを参照: [v 8関数-バックエンド](/doc/v8-engine/v8-server.html)

## 'Get' 、 'Post' リクエストをサポート
> * あなたが通過しても`get`それとも`post`を選択します。

## 'Form' 、 'json 'リクエストをサポート
> * あなたの要求が`form-data`それとも`payload-json`を選択します

## V8.Param
> * は受信とアクセスができます。`form`、`json`、`url`3つのパラメータ
```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
```

## 非同期実行コード
> * 新しいスレッドがv 8コードを非同期で実行します。Systemより多くの方法: [v 8関数リスト-バックエンド-System](/doc/v8-engine/v8-server.html # system)
```js
//方法1（推荐）
var timer1 = setTimeout(function() {
    V8.FormEngine.UptFormData('diy_test1', {
      Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
      Text45 : '2222',
    });
}, 1000);
//可在timer1开始执行前随时手动提前终止定时执行
clearTimeout(timer1);

//方法2
System.Threading.Tasks.Task.Run(function(){
  //实现setTimeout(function, 1000)的效果，不加则是setTimeout(function, 0)的异步效果
  System.Threading.Thread.Sleep(1000);
  V8.FormEngine.UptFormData('diy_test1', {
    Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
    Text45 : '2222',
  });
});
```

## 拡張インターフェースエンジン
> * 詳細は [`Microi.V8Engine`](https://gitee.com/ITdos/microi.net/tree/master/Microi. Server/Microi.V8Engine) クラスライブラリは、 [`V8EngineExtend`](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.V8Engine/V8EngineExtend.cs) クラスで拡張
```js
using System;
using Dos.Common;
using Microi.Model.Aliyun;
namespace Microi.net
{
    public partial class V8EngineExtend
    {
        /// <summary>
        /// 这种方式支持。测试扩展V8.TestV8Extend3('test')方法
        /// </summary>
        /// <returns></returns>
        public string TestV8Extend3(string testParam)
        {
            return "TestV8Extend3：" + testParam;
        }
        /// <summary>
        /// 新增V8.Alipay对象。
        /// 这种方式支持V8.Alipay.Test22('test')，也支持V8.Alipay.CreatePay({ AppId : '11' })
        /// </summary>
        public Alipay Alipay
        {
            get { return new Alipay(); }
        }
        /// <summary>
        /// 新增V8.WeChat对象。
        /// </summary>
        public WeChat WeChat
        {
            get { return new WeChat(); }
        }
        public AlipayV3 AlipayV3
        {
            get { return new AlipayV3(); }
        }
        public Alidns Alidns
        {
            get { return new Alidns(); }
        }
    }
}
```

## 戻りデータ
> * フロントエンドにデータを返すには、JSON、文字列、Html、ファイルなど
```javascript
//当指定了Code值为1时，平台会自动提交事务，无需手动执行V8.DbTrans.Commit()
return { Code : 1, Data : [1, 2, 3], Msg : '事务已提交！' };

//若代码出现return，并且未指定Code的值、或Code值不等于1时，则会自动回滚事务，无需手动执行V8.DbTrans.Rollback()
return { Code : 0, Msg : '错误信息，事务已回滚！' };

//若代码出现return，并且未指定Code的值，则会自动回滚事务，无需手动执行V8.DbTrans.Rollback()
V8.DbTrans.Commit();//除非在此手动执行[V8.DbTrans.Commit();]提交事务，此时平台才不会自动回滚事务
return { A : 111, B : 222 };

//支持返回JSON
return [{ Id : 1, Name : '张三' }];

return '支持返回字符串';

//支持返回HTML
return `<html>
          <body>
            <h1>支持返回HTML</h1>
          </body>
        </html>`;

//支持直接响应文件，如：图片、Office文档等等
var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
V8.Result = {
  Code : 1,
  Data : {
    FileName : '接口引擎直接返回响应文件.png',
    ContentType : 'image/png',
    FileByteBase64 : System.Convert.ToBase64String(imgByte)
  }
};

//旧版返回方式（仍然支持，但建议弃用这种方式）
//V8.Result = { Code : 1, Data : [] }
```

## インターフェース設定
### 基本構成
> * 名前 (`ApiName`) のようにカスタマイズします。[モバイル端末] 商品リストを取得します。
> * Key (`ApiEngineKey`) Get-product-listなどのカスタム
> * 外部呼び出し禁止 (`StopHttp`) をオンにすると、インタフェースエンジンv 8コードまたはサーバー側v 8イベントからのみこのインタフェース (関数) を呼び出すことができ、カスタムインタフェースのアドレスは無効になります

### カスタムインターフェースアドレス
> * カスタムインターフェースアドレス (`ApiAddress`) を一括して使用することを推奨します`/apiengine/`冒頭、例:`/apiengine/get-product-list`。もちろん、`/api111/b2222/c333/d444`いいです。`ApiBase + ApiAddress`アクセスインターフェース

### 分散ロック
> * 一部のシーンのインターフェイスでは、注文の出荷承認後に在庫を差し引いて、在庫がマイナスにならないようにするなど、分散ロックを使用する必要があります。 (もちろんメッセージキューを使ってもいいです。この方式は他の文章で説明します。)
> * 分散ロックをオンにすると、分散ロックKeyを設定することができます。例えば、商品Aに在庫の増減をする場合、分散ロックKeyは商品AのIdに設定でき、この場合、異なる商品は異なる分散ロックKey、列が異なる同時処理スループットを大幅に向上させます。
> * 分散ロックKeyを設定しないと、1000人が同時にこのインタフェースを呼び出すと、キューに入れなければならない

### 匿名呼び出しを許可する
> * インタフェースエンジンはデフォルトでtokenをインポートしなければ呼び出されません。
> * 匿名呼び出しの許可をオンにすると、tokenをインポートする必要はありませんが、v 8エンジンで **V8.current user** にアクセスすることに注意してください。

### 応答ファイル
> テストアクセスインターフェースのアドレスは直接画像をダウンロードします。[ https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos](https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos )
```javascript
var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
return {
  Code : 1,
  Data : {
    FileName : '测试响应文件.png',
    ContentType : 'image/png',
    FileByteBase64 : System.Convert.ToBase64String(imgByte)
  }
};
```
## インターフェーステスト
> インターフェイスエンジンフォームは、テストを実行するためのインターフェースの機能を提供します (フォームエンジンによって駆動されます)

## インターフェースデバッグ
> * 1、フロントエンドへのログ内容の出力が必要かどうかを定義します: 【var isDebugLog = true;】
> * 2、フロントエンドへ出力する必要があるログの内容を定义する: 【var debugLog = }}; 】
> * 3、ログを記録します。【V8.Method.AddSysLog】を使用してMongoDBログを書き込み、システム設定-> システムログで表示することもできます
> * 4、フロントエンドにログを出力するかどうかを判断します
```js
//【第一步】定义是否需要向前端输出日志内容，需要调试时为true，不需要调试时为false
var isDebugLog = true;//也可以使用系统设置全局变量：var isDebugLog = V8.SysConfig.V8EngineDebugLog;
//【第二步】定义需要向前端输出的日志内容
var debugLog = {};
//获取业务数据
var list1Result = V8.FormEngineGetTableData({
    FormEngineKey: 'test1',
    _Where: [
      ['field1', '=', '1']
    ]
});
//【记录日志】测试记录日志1
debugLog.Log1 = list1Result;
//【记录日志】【写MongoDB日志】
if(isDebugLog){
  V8.Method.AddSysLog({
    Type : '日志类型',
    Title : '日志标题',
    Content: `日志内容：${JSON.stringify(list1Result)}`
  });
}
if(list1Result.Code != 1){
  return list1Result;
}
//处理业务数据
debugLog.Log2 = [];
for(var i = 0; i < list1Result.Data.length; i++){
    var item = list1Result.Data[i];
    if(item.Number < 10){
        item.Number = '0' + item.Number;
        //【记录日志】测试记录日志2
        debugLog.Log2.push(item.Id);
    }
}
return {
    Code : 1, 
    Data : null, 
    DataAppend : {
        DebugLog : isDebugLog ? debugLog : null // 【第三步】判断是否向前端输出日志
    }
};
```

## インターフェースコード異常のキャッチ
```js
try{
  //你的接口引擎代码
}catch (error) {
    debugLog.errorDetails = {
        message: error.message || '',
        toString: error.toString ? error.toString() : '',
        stack: error.stack || '',
        lineNumber: error.lineNumber || '',
        columnNumber: error.columnNumber || '',
        fileName: error.fileName || '',
        name: error.name || '',
        description: error.description || ''
    };
    
    var errorMsg = '接口引擎的V8代码执行发生异常：' + (error.message || error.toString());
    if (error.lineNumber) {
        errorMsg += ' (行号: ' + error.lineNumber + ')';
    }
    if (error.stack) {
        errorMsg += '\n堆栈: ' + error.stack;
    }
    return {
        Code: 0,
        Msg: errorMsg,
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
}
```

## インターフェースエンジンの実戦
> * ここでは、大量のインタフェースエンジンが複雑な機能を実現する実戦を発表します: [インタフェースエンジン実戦](/apiengine/apiengine-index.html)

## 注意事項
> * フロントエンドから渡されたパラメータが配列である場合、インタフェースエンジンのv8.varがパラメータを受信したときも配列であり、配列のすべての特性を使用できますが、使用できません`Array.isArray(V8.Param.ArrayParamName)`真と判断します
```js
var arrayValue = V8.Param.ArrayParamName;
var isArray = Array.isArray(arrayValue);  //值为 false
var isObject = typeof(arrayValue) == 'object';  //值为 true
var id1 = arrayValue[0].Id;  //可以正常使用
var hasValue = arrayValue.length > 0;  //可以正常使用
```