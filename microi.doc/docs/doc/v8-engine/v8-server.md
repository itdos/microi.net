# V8函数列表-后端
## 介绍
>* 服务器端V8引擎代码与前端V8的编程语言均为Javascript语法
>* 服务器端V8引擎支持ES6语法
>* 服务器端V8引擎集成了后端一些对象、方法，可以使用js调用后端方法（非http）
>* 服务器端V8引擎代码在服务器端执行

## V8.ApiEngine
>服务器端V8事件可以直接调用接口引擎（非http）
```javascript
//调用方式：
var result = V8.ApiEngine.Run('ApiEngineKey', { 
    Param1 : '1',
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
* 验证码缓存Key命名规则：
`Microi:${OsClient值}:{分类key值}:{Key}`
示例：
`Microi:iTdos:Captcha:aaaa-bbbb-cccc`
* 平台的redis只总有4级：
>* 第一级用于区分其它第三方系统共用同一个redis实例时，区分哪个redis文件夹是吾码平台在用的
>* 第二级用于区分saas租户
>* 第三级用于区分redis分类，比如说验证码一类
>* 第四级就是最终要用的key

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
//等待1000毫秒
System.Threading.Thread.Sleep(1000);
//调用服务器端全局V8函数，获取yyyy-MM-dd HH:mm:ss格式的当前时间字符串。若获取日期格式，可使用new Date();
V8.Action.GetDateTimeNow()
//如果在服务器端全局V8函数是通过function DateNow(){}这样定义的，则可以直接使用DateNow()
var nowDate = DateNow('yyyy_mm-dd HH:mm:ss');
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
//返回{ Code : 1/0, Data : '临时访问地址'/['临时访问地址'], Msg : '错误信息' }

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
>* 访问多数据库（扩展库）的对象，扩展库管理见：[https://demo.microi.net/#/database](https://demo.microi.net/#/database)
>* 注意：老的数据库版本上面的表缺少【DbKey】字段，需要更新数据库、或手动添加、或等待应用商城上线【数据库管理】应用安装。
### 访问oracle扩展库
>* DbKey的值为OracleDB1，其中V8.Dbs.OracleDB1对象就等同于V8.Db对象。
```js
var dataList = V8.Dbs.OracleDB1.FromSql('').ToArray();
```
>* 已知问题：在平台中添加扩展库后，需要重启api的docker容器才会生效

## V8.MongoDb
### 前言
>* 本篇介绍如何在接口引擎、后端V8事件中对MongoDB进行相关操作
>* 对MongoDB的新增操作会自动生成对应数据库名和表名，因此可自定义分库、分表规则

### 往MongoDB系统日志中插入数据
```javascript
V8.Method.AddSysLog({
	Type : '', //日志类型，自定义文字，如：接口日志、性能日志、登录日志等
	Title : '', //日志标题，如：张三登录了系统
	Content: '', //日志内容，如：张三在2024-12-12 20:13通过扫码登录了系统 
	OtherInfo : '', //其它信息，如：{ Append : 'test' }
	Remark : '', //日志备注
	Level : 1,//日志等级
});
```

### 新增数据（自定义数据库名、表名）
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
### 修改数据
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
#### 删除数据
```javascript
V8.MongoDb.DelFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

### 查询数据列表
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

### 查询单条数据
```javascript
V8.MongoDb.GetFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

## V8.Http
>对RestSharp的封装，注意前端V8的post是V8.Post()，目前暂时并没有封装V8.Http，暂时写法不一致，后期会统一。
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
var pwd = V8.EncryptHelper.DESDecode('JdZe5gWKjZo=');//DES加密
var pwd = V8.EncryptHelper.DESEncode('123456');//DES解密
var pwd = V8.EncryptHelper.SHA1('123456');
var pwd = V8.EncryptHelper.SHA256('123456');
var pwd = V8.EncryptHelper.SHA512('123456');
var pwd = V8.EncryptHelper.MD5Encrypt('123456');//MD加密
var pwd = V8.EncryptHelper.Sha256Hex('123456');
```

## V8.Office

### V8.Office.SendEmail：发送邮件
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

## V8.SysConfig
>* 访问系统设置信息

## V8.OsClientModel
>* 访问当前SaaS引擎敏感配置数据
>* 第三方系统敏感配置也均应该放到SaaS引擎的配置中，如第三方系统key、secret等
```js
//获取redis host
var redisHost = V8.OsClientModel.RedisHost;
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

## V8.DbTrans
* 数据库事务对象，可以像V8.Db一样使用，如：
```js
var array = V8.DbTrans.FromSql('...').ToArray();
```
* 事务对象在接口引擎中必须执行【V8.DbTrans.Commit()】或【V8.DbTrans.Rollback()】。--从2025-11-20 Microi.net.dll v2.7.0开始可以忽略不写，平台会自动根据返回的Code是否等于1进行提交事务，否则进行回滚事务
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
  V8.DbTrans.Commit();//提交事务。--从2025-11-20 Microi.net.dll v2.7.0开始可以忽略不写，平台会自动根据返回的Code是否等于1进行提交事务，否则进行回滚事务
  return { Code : 1 }
}else{//如果第二张表操作失败
  V8.DbTrans.Rollback();//回滚事务。--从2025-11-20 Microi.net.dll v2.7.0开始可以忽略不写，平台会自动根据返回的Code是否等于1进行提交事务，否则进行回滚事务
  return { Code : 0, Msg : result.Msg }
}
```

## V8.Param
>用于访问前端传入的参数，能访问到url参数、form-data参数、payload-json参数

## V8.Action
>用于访问在全局服务器V8代码处自定义的方法

## V8.Result
>用于返回值