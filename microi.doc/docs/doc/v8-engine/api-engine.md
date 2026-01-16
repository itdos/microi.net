# 接口引擎

## 简介
>* `写一个获取数据的接口只要1分钟`，接口引擎作为平台的最大亮点之一，主要解决复杂的业务逻辑，统一管理定制接口
>* 在线使用JavaScript编写api接口，**[`AI代写V8引擎代码`](https://microi.net/doc/v8-engine/ai-apiengine.html)**，支持`[Get、Post]`请求，支持返回`[JSON、字符串、文件、HTML]`等，支持`[自定义接口地址、分布式锁、权限、自定义扩展函数]`等
>* 可实现任意复杂的业务场景，`极致的性能（V8代码预编译、多级缓存）`与`开发效率`，无需`本地编译发布`，保存即生效
>* 经过8年以上成功案例的验证，部分项目高达500个以上接口。[[FormEngine用法]](/doc/v8-engine/form-engine) [[Where条件用法]](/doc/v8-engine/where)
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
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/QQ20250311-213524@2x.png)

## 强大的V8调试功能
>* 支持`本地`、`在线`两种方式编写V8接口引擎，`双向增量同步`在线、本地V8代码
>* 支持`本地调试V8事件代码`、`接口引擎代码`，同时支持V8代码调用`平台插件源码`关联调试
>* **整个接口请求全路径支持`断点调试`**：
>1. `前端`表单进入V8事件      `[支持调试]`
>2. `前端`表单提交前V8事件      `[支持调试]`
>3. `后端`表单提交前V8事件      `[支持调试]`
>4. **`后端`V8事件调用<font color="red">接口引擎</font>**    `[支持调试]`
>5. **`后端`接口引擎调用`V8.Cache`等任何后端插件源码**    `[支持调试]`
>6. `后端`表单提交后V8事件      `[支持调试]`
>7. `前端`表单提交后V8事件      `[支持调试]`

## 支持所有后端V8函数
>* 见平台文档：[V8函数-后端](/doc/v8-engine/v8-server.html)

## 支持`Get`、`Post`请求
>* 无论您是通过`get`还是`post`，均能成功请求接口引擎

## 支持`Form`、`Json`请求
>* 无论您的请求是`form-data`还是`payload-json`，均支持

## V8.Param
>* 均能接收和访问到`form`、`json`、`url`三种参数
```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
```

## 异步执行代码
>* 新开一个线程异步执行V8代码。System更多用法见：[V8函数列表-后端-System](/doc/v8-engine/v8-server.html#system)
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

## 扩展接口引擎
>* 详见[`Microi.V8Engine`](https://gitee.com/ITdos/microi.net/tree/master/Microi.Server/Microi.V8Engine)类库，在[`V8EngineExtend`](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.V8Engine/V8EngineExtend.cs)类中扩展
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

## 返回数据
>* 将数据返回给前端，可以是JSON、字符串、Html、文件等
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

## 接口配置
### 基础配置
>* 名称（`ApiName`）自定义，如：[移动端]获取商品列表
>* Key（`ApiEngineKey`）自定义，如：get-product-list
>* 禁止外部调用（`StopHttp`），开启后只能通过接口引擎V8代码或服务器端V8事件调用此接口（函数），且自定义接口地址失效

### 自定义接口地址
>* 自定义接口地址（`ApiAddress`），建议统一使用`/apiengine/`开头，如：`/apiengine/get-product-list`。当然您要自定义为`/api111/b2222/c333/d444`也可以，使用`ApiBase + ApiAddress`访问接口

### 分布式锁
>* 某些场景的接口，必须使用分布式锁，如：订单发货审批通过后扣除库存，防止库存变为负数。（当然也可以使用消息队列，这种方式其它文章讲解）
>* 开启分布式锁可以设定分布式锁Key，这个大有用处。比如说当我们要给商品A进行库存增减时，分布式锁Key就可以设置为商品A的Id，此时不同的商品走不同的分布式锁Key、排不同的队，大大提高并发吞吐量。
>* 若不设置分布式锁Key，那么1000个人同时调用此接口，都得排队

### 允许匿名调用
>* 接口引擎默认必须传入token才能被调用，否则会报错1001未登录
>* 当开启允许匿名调用时，则无需传入token，但注意在V8引擎中访问**V8.CurrentUser**为{}

### 响应文件
>测试访问接口引擎地址会直接下载图片：[https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos](https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos)
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
## 接口测试
>接口引擎表单提供了接口运行测试的功能（由表单引擎驱动）

## 接口调试
>* 1、定义是否需要向前端输出日志内容：【var isDebugLog = true;】
>* 2、定义需要向前端输出的日志内容：【var debugLog = {};】
>* 3、记录日志：【debugLog.Log1 = list1Result;】。也可以使用【V8.Method.AddSysLog】写MongoDB日志，然后在系统设置 -> 系统日志中查看
>* 4、判断是否向前端输出日志：【DataAppend : { DebugLog : isDebugLog ? debugLog : null }】
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

## 捕获接口代码异常
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

## 接口引擎实战
>* 这里我们会发布大量的接口引擎实现复杂的功能实战：[接口引擎实战](/apiengine/apiengine-index.html)

## 注意事项
>* 若前端传入的某个参数是数组，接口引擎的V8.Param收到参数时，也是数组，能使用数组的所有特性，但唯独无法使用`Array.isArray(V8.Param.ArrayParamName)`来判断为真
```js
var arrayValue = V8.Param.ArrayParamName;
var isArray = Array.isArray(arrayValue);  //值为 false
var isObject = typeof(arrayValue) == 'object';  //值为 true
var id1 = arrayValue[0].Id;  //可以正常使用
var hasValue = arrayValue.length > 0;  //可以正常使用
```