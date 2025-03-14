# V8函数列表-后端
## 介绍
>* 服务器端V8引擎代码与前端V8的编程语言均为Javascript语法
>* 服务器端V8引擎支持ES6语法
>* 服务器端V8引擎集成了后端一些对象、方法，可以使用js调用后端方法（非http）
>* 服务器端V8引擎代码在服务器端执行

## V8.ApiEngine
>服务器端V8事件可以直接调用接口引擎（非http）
```javascript
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

## V8.Cache
>缓存操作类
```javascript
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

## System
>服务器端V8代码能直接使用.net下的System命名空间
```csharp
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

## V8.Method
>集成了一些常用函数
```javascript
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

## V8.Base64
>Base64转换，与System.Convert.Convert.ToBase64String(bytes)不同的是V8.Base64若遇异常会直接返回源字符串
```javascript
var result = V8.Base64.StringToBase64('123456');
var result = V8.Base64.Base64ToString('MTIzNDU2');
```

## V8.CurrentUser
>当前登陆用户信息，包含用户所属角色、组织机构等，包含使用表单引擎对sys_user表新增字段的信息。

## V8.Db
>数据库访问Dos.ORM对象
```csharp
用例：
var list = V8.Db.FromSql("select * from table")
                .ToArray() //返回数组数据，一般用于select语句
                .ExecuteNonQuery() //返回受影响行数，一般用于update、delete、insert语句
                .First() //返回单条数据，一般用于select语句
                .ToScalar() //返回单个值，一般用于select 聚合函数、单个字段
```

## V8.DbRead
>数据库只读对象，用法和V8.Db一样，当数据库未部署读写分离时，此对象与V8.Db对象值一致。

## V8.Dbs.DbKey
>多数据库使用，如V8.Dbs.OracleDB1.FromSql('')（V8.Dbs.OracleDB1同V8.Db）

## V8.MongoDb
>见相关文章：[Microi吾码-接口引擎实战：MongoDB相关操作](https://microi.blog.csdn.net/article/details/144434527)
## V8.Http
>对RestSharp的封装
```javascript
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

## V8.Header、V8.Param
>目前两者均只支持在接口引擎中使用，用于获取客户端http post请求接口引擎地址发送的报文和Request Payload参数。

## V8.EncryptHelper
>Dos.Common加密帮助类
```javascript
//DES加密
var pwd = V8.EncryptHelper.DESDecode('JdZe5gWKjZo=');
//DES解密
var pwd2 = V8.EncryptHelper.DESEncode('123456');
V8.SysConfig
访问系统设置信息
```

## V8.Form
>表单提交事件中可访问表单数据，接口引擎中此对象为空。

## V8.FormSubmitAction
>表单提交类型：Insert/Delete/Update（string类型）
注意服务器端V8事件里面没有FormOutAction、FormOutAfterAction，只有FormSubmitAction

## V8.EventName
>前端V8事件名称，在全局V8引擎代码中比较好用，可能的值：
FormSubmitBefore：表单提交前V8事件
FormSubmitAfter：表单提交后V8事件
DataFilter：数据处理V8事件
WFNodeLine：流程节点条件判断V8事件
WFNodeEnd：流程节点结束V8事件
WFNodeStart：流程节点开始V8事件

## 事件
>* 服务器端数据处理V8引擎代码
该事件会在获取列表数据后每一行执行、获取表单数据后执行。
已封装对象：
a）V8.RowIndex：列表数据的行索引，0开始
b）V8.Form：列表数据每行对象、表单数据对象
c）V8.NotSaveField：指定哪些字段在编辑时不保存
d）V8.CacheData：用于缓存数据
可以实现某些字段脱敏，如：V8.Form.价格 = "***";此时一定要设置：V8.NotSaveField = ["价格"];否则在修改数据时会将***写到数据库。
写法：
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

## 服务器端表单提交前V8事件
>可通过V8.Result = { Code : 0, Msg : '错误信息' };阻止表单继续提交。
注意：只要给V8.Result赋值了{}对象，就会阻止表单提交、回滚事务，无论Code值是什么。

## 服务器端表单提交后V8事件
>可通过V8.DbTrans.Rollback()和V8.Result = { Code : 0, Msg  '错误信息' };回滚表单的提交。
注意：只要给V8.Result赋值了{}对象，就会回滚事务，无论Code值是什么。

## 服务器端V8代码调试方案
```javascript
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

## V8.DbTrans
* 数据库事务对象，可以像V8.Db一样使用，如：
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

## V8.Param
>用于访问前端传入的参数，能访问到url参数、form-data参数、payload-json参数

## V8.Action
>用于访问在全局服务器V8代码处自定义的方法

## V8.Result
>用于返回值