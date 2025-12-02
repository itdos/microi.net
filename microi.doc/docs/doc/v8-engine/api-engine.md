# 接口引擎
## 简介
>* 接口引擎作为平台的最大亮点之一，主要解决复杂的业务逻辑，统一管理定制接口
>* 接口引擎由表单引擎驱动
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/QQ20250311-213524@2x.png)


## 支持所有后端V8函数
>见平台文档：[V8函数-后端](/doc/v8-engine/v8-server.html)

## 支持Get、Post请求
>无论您是通过get还是post，均能成功请求接口引擎

## 支持form-data、payload-json请求
>无论您的请求是form-data还是payload-json，均支持

## V8.Param能接收form-data、payload/json、url三种参数类型
```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
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
### 名称、Key、自定义接口地址、启用
>4个基础配置，名称随意，key随意，自定义接口地址建议统一使用/apiengine/开头，当然您要自定义为【/api111/b2222/c333/d444】也可以，【启用】一定要勾选

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
    _Where: [{ Name : 'field1', Value : '1', Type : '=' }]
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
