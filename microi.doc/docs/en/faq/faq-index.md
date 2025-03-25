# 常见问题


::: details 接口引擎如何发送邮件方法? 【刘诚-2025-02-21】

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

::: details 系统设置修改了不生效的问题? 【刘诚-2025-02-21】

系统设置--表单设计
服务器端表单提交后V8事件 改为 V8.Cache.Remove(`Microi:${V8.OsClient}:SysConfig`);

:::


::: details 复制表结构代码? 【姜涛-2025-02-17】

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

::: details OpenAnyTable用户示例?【刘诚-2025-02-06】

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
>这里的 `ModeuleEngineKey`要注意不是表名

![v8代码](/faq/faq1.jpg)

![v8代码](/faq/faq2.jpg)

:::



::: details sql接口/方便不想使用FormEngine喜欢sql的 【姜涛-2025-01-23】

内容

接口引擎名称为：`sql_work`，

调用方式有两种，

第一种：

```js
V8.ApiEngine.Run('sql_work', {
   Sql: 'select * from diy_test where IsDeleted = 0'
});
```

第二种

```js
V8.ApiEngine.Run({
   ApiEngineKey : 'sql_work',
   Sql : 'select * from diy_test where IsDeleted = 0'
});
```

**接口代码如下**：

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




::: details 富文本编辑器上传图片失效?【刘诚-2025-01-09】

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


![图片失效](/faq/faq3.png)

:::


::: details 审批流程被绝后，发起人继续走流程的接口?【刘诚-2025-01-06】

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

::: details 固资app连接报错 证书过期问题，rfid 插件初始化失败问题?【崔思敏-2025-01-02】

1. PDA 扫码枪 `app` 调用接口返回证书过期报错提示，使用其他方式打开是正常的，需要看一下PDA扫码枪改一下日期和时间设置

2. `rfid` 插件初始化失败问题：把键盘助手中启用开关 关闭。

![v8代码](/faq/faq05.png)

:::

::: details 接口引擎连接其他数据库失败的解决方法（多数据库管理）?【刘诚-2024-12-26】

1. 在数据库管理，加了一个数据库，能正常连接到数据，但是接口引擎用 `V8.Dbs.jdoracle.FromSql`  报错

2. 确认数据库字符串是否正常，正常的话，再测试，可以测试 `V8.Result = V8.Dbs.jdoracle`，打印出来看是否为空值，解决方案如下

3. 加数据库并不能直接生效，需要在服务器控制面板，容器管理，重启对应的 `api`

:::

::: details 系统日志不显示的处理办法?【刘诚-2024-12-25】

1. 先去 `https://os.nbweixin.cn` 查询，`saas` 开库里面的 `DbMongoConnection` 拿到数据，去验证一下改连接是否正常。
![图片失效](/faq/faq07.png)

2. 然后到 `1panel` 面板去查看该 `mongdb` 端口是否开放。
![图片失效](/faq/faq08.png)

3. 确保改 `mongdb` 是正常的，在 `os.nbweixin.cn` 修改正常后，再重启 `api` 容器。
![图片失效](/faq/faq09.png)

:::

::: details 修改了自定义接口，提示:接口自定义地址缓存更新失败:登录身份已过期？【姜涛-2024-12-22】
报错图片
![图片失效](/faq/faq10.png)

进入接口引擎模块设计，注释掉 前端离开表单后V8事件
![图片失效](/faq/faq11.png)

:::


::: details uniapp上传文件bug-参数bug，布尔型应该字符串类型传值?【姜涛-2024-12-21】

![图片失效](/faq/faq12.png)

:::

::: details 报表引擎表名不跟着报表key走，跟着报表名称走?【姜涛-2024-12-14】
`Rpt_Report` 表的 服务器端表单提交前V8事件，圈中这句代码改成我的就好了
![图片失效](/faq/faq13.png)


:::

::: details 模块设计where条件乱码，自定义按钮保存不上?【刘诚-2024-12-11】

需要在表单引擎找到 `sys_menu`，表单设计，服务器表单提交前V8事件，写上如下代码

```js
var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];

base64ToStringArr.forEach(item => {

 if(V8.Form[item]){

   V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);

 }

})
```

:::

::: details 下拉复选，初始值不显示的问题?【刘诚-2024-12-09】

![图片失效](/faq/faq14.png)

>需要把下拉复选存储对应字段写上。

:::

::: details 腾讯支付退款问题?【姜涛-2024-12-06】

1. 在测试通过接口里面再去调用腾讯的退款接口，提示 `Object reference not set to an instance of an object` 

2. 这个报错信息是因为微信加密参数那句有问题，但直接调该接口就又是ok的

3. 所以就把退款接口复制到操作接口里面，生成一个 `function` 以后去执行，就ok了

:::

::: details AppVisible、AppDisplay问题?【崔思敏-2024-12-05】

1. 【必须】手动去数据库管理工具给【diy_field】表新增字段：【AppVisible、bit、可为空】。

然后去【表单引擎】—>【diy_field】表—>【异常字段 选择 AppVisible 修复】。

执行SQL：

```sql
update diy_field set AppVisible=1 where Visible=1
```

2. 【必须】手动去数据库管理工具给【sys_menu】新增字段：【AppDisplay、bit、可为空】。

然后去【表单引擎】—>【sys_menu】表—>【异常字段 选择 AppDisplay 修复】。

执行 SQL：

```sql
update sys_menu set AppDisplay=1 where Display=1
```

:::

::: details 表单设计清理缓存的办法？【刘诚-2024-11-21】

1. 表单设计（Sys_Config）服务器端表单提交后V8事件必须添加以下V8代码（可参考标准库）：

```js
V8.Cache.Remove(`SysConfig:${V8.OsClient}`);
```

2. 表单设计（Sys_ApiEngine）服务器端表单提交后V8事件必须添加以下V8代码（可参考标准库）：

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

::: details 保存模块后，去角色管理可能会报错的解决方案（加密解密过程）？【刘诚-2024-11-21】

>凡是正在开发中的系统，只要使用了最新的 `v1.9.5.7` 这个测试环境的 `api` 接口系统版本的话：

必须要在 表单设计 --> 搜索sys_menu --> 在【服务器端数据处理V8事件】和【服务器端表单提交前V8事件】中添加以下相同的V8代码（否则保存模块后再去角色管理可能会报错）（我也没有办法，因为模块引擎目前仍然是定制开发的，强制增加了加密传输功能，如果没有以下V8代码去解密，那么就会出问题）：

```js
var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];

base64ToStringArr.forEach(item => {

 if(V8.Form[item]){

   V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);

 }

})
```

:::

::: details 移动端显示字段AppVisible批量处理方法？ 【刘诚-2024-11-21】
1. 【必须]手动去数据库管理工具给diyfield表新增字段:【AppVisible、bit、可为空]。然后执行sql:

```sql
update diy_field set AppVisible=1
```

然后去【表单引擎]->【diy_field]表->【异常字段选择AppVisible 修复]

2. 表单引擎->【sys_menu]表一>新增开关控件:AppDisplay(移动端显示)。如果想默认都显示，可以

```sql
update sys_menu set AppDisplay=1 where Display=1
```

:::

::: details 接口生成二维码图片的方法（BASE64格式）？【刘诚-2024-11-21】

https://api.nbweixin.cn/api/os/CreateQRCode?qrCodeContent=http://baidu.com

:::

::: details 复制表单和模块到其它数据库？【刘诚-2024-11-21】

在A数据库配置好的两个模块，如何复制到B数据库？

有两种方式

第1种：通过Microi应用商城

A项目上传数据库包到应用商城，B项目到应用商城下载并安装应用

此方法目前暂不推荐，一是上传审核问题，二是应用商城系统目前还不够完善

第2种：通过Navicat提取相关sql语句

获取 `diy_table` 表数据

```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```

然后通过如图提取 `insert` 语句（选中所有数据，鼠标右键复制为–>Insert语句）

![图片失效](/faq/faq13.jpeg)

将拿到的 `sql` 语句放到 `B` 数据库执行即可（注意要去掉 `INSERT INTO` 后的数据库名称.）

以上3个步骤，通过下面的 `sql` 获取到数据后再做两次即可，方法同理

```sql
//获取上面两张表的所有字段数据

select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
```

```sql
//获取模块引擎数据（用于复制模块）

select * from sys_menu where `Name` In('多语言管理', '项目管理')

```

最近记得去角色管理处给帐号设置好【多语言管理】和【项目管理】对应的菜单模块权限。          

原文链接：https://blog.csdn.net/qq973702/article/details/143950112

:::

::: details 搜索栏无法同时使用多个搜索项目的问题？【胡佳瑶-2024-11-20】

在【模块引擎】-【可搜索列】里，将需要同时搜索的字段，选择相同的呈现方式，比如：都选择【默认】或【外部】。

如果需要搜索的多个字段，分别选择了【默认】和【外部】，将不能同时使用。

:::

::: details 接口引擎需要保存两次才生效的bug手动解决方案？【崔思敏-2024-11-20】

表单设计-【Sys_ApiEngine】,将【服务器端表单提交后V8事件】


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

::: details 保存表单字段就退出登录问题?【崔思敏-2024-11-20】

需要把 `diy_table、diy_field` 这两个表中的 `OsClient` 改为空，参考 `sql` 写法：

```js
var res = V8.Db.FromSql("update diy_table set OsClient=''").ExecuteNonQuery()
```

:::

::: details 普通账号登录，刷新页面，新增等按钮丢失? 【刘诚-2024-11-26】


需要在表单引擎里面，选择非 `diy` 表，并加载 `sys_rolelimit` 表

:::



