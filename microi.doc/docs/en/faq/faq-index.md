# FAQ


::: How does the details interface engine send mail? [Liu Cheng -2025-02-21]]

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

::: details the problem that the system settings are modified and not effective? [Liu Cheng -2025-02-21]]

System Setup-Form Design
After the server-side form is submitted, the V8 event is changed to V8.Cache.Remove (`Microi:${V8.OsClient}:SysConfig`);

:::


::: details Copy Table Structure Code? [Jiang Tao -2025-02-17]]

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

::: details OpenAnyTable User Example? [Liu Cheng -2025-02-06]]

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
>> Here`ModeuleEngineKey`Note that it is not a table name

![v8代码](/faq/faq1.jpg)

![v8代码](/faq/faq2.jpg)

:::



::: details SQL Interface/Convenient Don't Want to Use FormEngine Like SQL [Jiang Tao -2025-01-23]]

Content

The interface engine name is:`sql_work`,

There are two ways to call,

The first:

```js
V8.ApiEngine.Run('sql_work', {
   Sql: 'select * from diy_test where IsDeleted = 0'
});
```

Second Kind

```js
V8.ApiEngine.Run({
   ApiEngineKey : 'sql_work',
   Sql : 'select * from diy_test where IsDeleted = 0'
});
```

**The interface code is as follows**:

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




::: details Rich Text Editor Fails to Upload Pictures? [Liu Cheng -2025-01-09]]

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


::: After the details approval process is abandoned, does the initiator continue to go through the process interface? [Liu Cheng -2025-01-06]]

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

::: details Fixed Capital app Connection Error Certificate Expiration Problem, rfid Plug-in Initialization Failure Problem? [Cui Simin -2025-01-02]]

1. PDA scanning gun`app`Call the interface to return the certificate expiration error prompt. It is normal to open it by other methods. You need to look at the PDA scanning gun to change the date and time settings.

2.`rfid`Plug-in initialization failure: Turn off the enable switch in the keyboard assistant.

![v8代码](/faq/faq05.png)

:::

::: How to solve the failure of details interface engine to connect to other databases (multi-database management)? [Liu Cheng -2024-12-26]]

1. In the database management, a database is added, which can be connected to the data normally, but the interface engine is used`V8.Dbs.jdoracle.FromSql`Error reporting

2. Confirm whether the database string is normal. If it is normal, test it again and you can test it.`V8.Result = V8.Dbs.jdoracle`, print it out to see if it is null, the solution is as follows

3. The addition of the database cannot take effect directly. It needs to be managed in the server control panel, container management and restart the corresponding`api`

:::

::: How to deal with the non-display of the details system log? [Liu Cheng -2024-12-25]]

1. Go first.`https://os.nbweixin.cn`query,`saas`Open the inside of the library`DbMongoConnection`Get the data and verify whether the connection is normal.
![图片失效](/faq/faq07.png)

2. Then`1panel`Panel to view`mongdb`Whether the port is open.
![图片失效](/faq/faq08.png)

3. Make sure to change`mongdb`is normal, in`os.nbweixin.cn`After the modification is normal, restart again`api`Containers.
![图片失效](/faq/faq09.png)

:::

::: details modified the custom interface, prompt: interface custom address cache update failed: login identity has expired? [Jiang Tao -2024-12-22]]
Wrong picture
![图片失效](/faq/faq10.png)

Enter the interface engine module design and comment out the V8 event after the front end leaves the form.
![图片失效](/faq/faq11.png)

:::


::: details uniapp Upload File bug-Parameter bug, Boolean Type Should String Type Pass Value? [Jiang Tao -2024-12-21]]

![图片失效](/faq/faq12.png)

:::

::: details report engine table name does not follow the report key, follow the report name? [Jiang Tao -2024-12-14]]
`Rpt_Report`Before the server-side form of the table submits the V8 event, the code in the circle should be changed to mine.
![图片失效](/faq/faq13.png)


:::

::: details module design where condition is garbled, can't custom buttons be saved? [Liu Cheng -2024-12-11]]

Need to be found in the form engine`sys_menu`, form design, V8 event before server form submission, write the following code

```js
var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];

base64ToStringArr.forEach(item => {

 if(V8.Form[item]){

   V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);

 }

})
```

:::

::: details drop-down check, the problem that the initial value is not displayed? [Liu Cheng -2024-12-09]]

![图片失效](/faq/faq14.png)

> Need to write the corresponding field of the drop-down check storage.

:::

::: details Tencent Payment Refund Problem? [Jiang Tao -2024-12-06]]

1. Call Tencent's refund interface in the test pass interface, prompting`Object reference not set to an instance of an object` 

2. This error message is due to the problem with WeChat encryption parameter, but it is OK to directly adjust the interface.

3. So copy the refund interface to the operation interface to generate one`function`After the implementation, OK

:::

::: details AppVisible, AppDisplay problems? [Cui Simin -2024-12-05]]

1. [Must] Manually go to the database management tool to add fields to the [diy_field] table: [AppVisible, bit, Nullable]].

Then go to [form engine]-> [diy_field] table-> [abnormal field selection AppVisible repair]].

Execute SQL:

```sql
update diy_field set AppVisible=1 where Visible=1
```

2. [Must] Manually go to the database management tool to add fields to [sys_menu]: [AppDisplay, bit, Nullable]].

Then go to [form engine]-> [sys_menu] table-> [abnormal field selection AppDisplay repair]].

Execute SQL:

```sql
update sys_menu set AppDisplay=1 where Display=1
```

:::

::: How to clean up the cache details form design? [Liu Cheng -2024-11-21]]

1. Form Design (Sys_Config) The following V8 code must be added to the V8 event after the form is submitted on the server side (refer to the standard library):

```js
V8.Cache.Remove(`SysConfig:${V8.OsClient}`);
```

2. Form Design (Sys_ApiEngine) The following V8 code must be added to the V8 event after the form is submitted on the server side (refer to the standard library):

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

::: After details the save module, go to the solution (encryption and decryption process) that role management may report errors? [Liu Cheng -2024-11-21]]

> Any system under development, as long as the latest`v1.9.5.7`This test environment`api`interface system version of the words:

The following same V8 codes must be added to [server-side data processing V8 event] and [V8 event before server-side form submission] in form design-> search sys_menu-> (otherwise, an error may be reported in role management after saving the module) (I have no choice either, because the module engine is still custom-developed at present, and the encrypted transmission function is forced. if there is no following V8 code to decrypt, then there will be problems):

```js
var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];

base64ToStringArr.forEach(item => {

 if(V8.Form[item]){

   V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);

 }

})
```

:::

::: details AppVisible batch processing method for mobile display fields? [Liu Cheng -2024-11-21]]
1. [Must] Manually go to the database management tool to add fields to the diyfield table: [AppVisible, bit, NULL]. Then execute SQL:

```sql
update diy_field set AppVisible=1
```

Then go to [form engine]-> [diy_field] table-> [abnormal field selection AppVisible repair]

2. form engine-> [sys_menu] table 1> new switch control: AppDisplay (mobile display). If you want to display all by default, you can

```sql
update sys_menu set AppDisplay=1 where Display=1
```

:::

::: How to generate two-dimensional code pictures details interface (BASE64 format)? [Liu Cheng -2024-11-21]]

https://api.nbweixin.cn/api/ OS /CreateQRCode?qrCodeContent=http://baidu.com

:::

::: details to copy forms and modules to other databases? [Liu Cheng -2024-11-21]]

How do I copy the two modules configured in database A to database B?

There are two ways

The first: through the Microi application store

Project A uploads the database package to the application mall, and Project B downloads and installs the application in the application mall.

This method is not recommend for the time being. One is the upload audit problem, and the other is that the application mall system is not perfect yet.

type 2: extract relevant SQL statements by Navicat

Get`diy_table`Table Data

```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```

Then extract through the figure`insert`Statement (all data is selected and the right mouse button is copied as->Insert statement)

![图片失效](/faq/faq13.jpeg)

will get`sql`Statement`B`The database can be executed (note to remove`INSERT INTO`after the database name.)

The above 3 steps, through the following`sql`After obtaining the data, do it twice. The method is the same.

```sql
//获取上面两张表的所有字段数据

select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
```

```sql
//获取模块引擎数据（用于复制模块）

select * from sys_menu where `Name` In('多语言管理', '项目管理')

```

Recently, I remember to go to the role management office to set up the menu module permissions corresponding to [multi-language management] and [project management] for the account.

Original link: https://blog.csdn.net/qq973702/article/details/143950112

:::

::: details the problem that the search bar cannot use multiple search items at the same time? [Hu Jiayao -2024-11-20]]

In [Module Engine]-[Searchable Column], select the same presentation method for the fields to be searched at the same time, for example, select [Default] or [External]].

If multiple fields to be searched are selected [Default] and [External] respectively, they cannot be used at the same time.

:::

::: details interface engine need to save two manual bug solutions to take effect? [Cui Simin -2024-11-20]]

Form Design-[Sys_ApiEngine], V8 Event after Server-Side Form Submission]]


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

::: Quit Login details Save Form Fields? [Cui Simin -2024-11-20]]

need to put`diy_table、diy_field`In these two tables`OsClient`Change to null, reference`sql`Writing:

```js
var res = V8.Db.FromSql("update diy_table set OsClient=''").ExecuteNonQuery()
```

:::

::: details ordinary account login, refresh page, add and other buttons lost? [Liu Cheng -2024-11-26]]


You need to select non-in the form engine.`diy`table, and load`sys_rolelimit`Table

:::



