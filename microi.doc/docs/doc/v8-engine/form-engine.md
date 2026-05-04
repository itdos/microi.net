# 📝 FormEngine 用法

> **前后端 V8 共享文档，均为 JavaScript 语法，用法基本一致，略有差别**

---

## 📌 前后端 V8 语法差异

| 端 | 说明 |
| :--: | ---- |
| 服务器端 | `V8.FormEngine` 对表的所有操作均支持第二个参数传入 `V8.DbTrans` 数据库事务对象 |
| 服务器端 | `V8.FormEngine` 操作**不会触发**表单属性的任何事件（除非传入 `_InvokeType:'Client'`） |
| 前端 | `V8.FormEngine` 操作**会触发**表单属性事件 |
| 前端 | 直接调用 FormEngine 对应的接口地址也会触发服务器端 V8 事件 |

::: tip 提示
`V8.FormEngine` 下所有函数均为单表操作（除 Batch 批量操作外），多表关联查询请查看 `V8.ModuleEngine` 用法。
:::
>* __<font color="red">注意：从Microi.net.dll v3.0.2开始，在删除、修改数据时若数据库受影响行数为0，仍然返回Code=1成功，并且会额外返回DataCount值为实际受影响行数（之前版本是返回Code=1006）</font>__

## 🌐 HTTP 直接调用（重要）

> 移动端/外部系统不通过 V8 引擎调用 FormEngine 时，必须使用以下 RESTful 路由。**不要拼出 `/formengine/{表名}/gettabledata` 这种地址，那是错误写法，会得到 404。**

平台路由由 `Microi.net.Api/Handler/DynamicApiEngine.cs` 的 `FormEngineRoutes` 字典决定，所有 FormEngine HTTP 接口共有两种调用形式：

### 形式一：标准 Controller 路由（推荐，FormEngineKey 放 Body）

| Method | URL | Body |
| --- | --- | --- |
| POST | `/api/formengine/GetFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...] }` |
| POST | `/api/formengine/GetTableData`    | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...], "_PageIndex":1, "_PageSize":20 }` |
| POST | `/api/formengine/AddFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", ...字段 }` |
| POST | `/api/formengine/UptFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "Id":"...", ...字段 }` |
| POST | `/api/formengine/UptFormDataByWhere` | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...], ...字段 }` |
| POST | `/api/formengine/DelFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "Id":"..." }` 或 `{ "Ids":[...] }` |
| POST | `/api/formengine/DelFormDataByWhere` | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...] }` |

匿名版本（无需 Token，需在 `diy_table.IsAnonymous` 中允许）：
| POST | `/api/formengine/GetFormDataAnonymous`     | 同上 |
| POST | `/api/formengine/GetTableDataAnonymous`    | 同上 |
| POST | `/api/formengine/AddFormDataAnonymous`     | 同上 |

### 形式二：动态短路由别名（FormEngineKey 写在 URL 里）

`DynamicApiEngine` 维护以下前缀映射，效果与形式一完全一致：

```
POST /api/formengine/getformdata-{表名}        → GetFormData
POST /api/formengine/get-formdata-{表名}       → GetFormData
POST /api/formengine/gettabledata-{表名}       → GetTableData
POST /api/formengine/get-tabledata-{表名}      → GetTableData
POST /api/formengine/addformdata-{表名}        → AddFormData
POST /api/formengine/add-formdata-{表名}       → AddFormData
POST /api/formengine/uptformdata-{表名}        → UptFormData
POST /api/formengine/upt-formdata-{表名}       → UptFormData
POST /api/formengine/delformdata-{表名}        → DelFormData
POST /api/formengine/del-formdata-{表名}       → DelFormData
```

URL 中的表名建议小写。Body 仍可传 `FormEngineKey` 用于校验，多余时以 URL 为准。

### 必传 Header

| Header | 说明 |
| --- | --- |
| `Content-Type` | `application/json`（推荐）或 `application/x-www-form-urlencoded` |
| `OsClient` | 当前租户标识；也可作为 querystring `?OsClient=xxx` 或 body 字段传入 |
| `Token` | 登录后获得的 Token；匿名接口可省略 |

### 常见错误对照

| 错误现象 | 原因 |
| --- | --- |
| 404 Not Found | URL 写成 `/formengine/{表名}/gettabledata`、缺少 `/api/` 前缀、或表名与动作之间写成 `/` 而非 `-` |
| `Code:1001 登录身份已过期` | 未带 Token、Token 过期、或 Redis 缓存被清空 |
| `Code:1002 身份验证失败` | OsClient 与 Token 不匹配 |
| `Code:0 表不存在` | `FormEngineKey` 大小写或拼写错误（实际不区分大小写，但表必须存在于 `diy_table`） |

### 移动端 uni-app 调用示例

```javascript
const BASE = 'https://api.itdos.com';
const OS_CLIENT = 'lsg';
function formEngineGet(table, where = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE}/api/formengine/gettabledata-${table}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'OsClient': OS_CLIENT,
        'Token': uni.getStorageSync('token') || ''
      },
      data: { OsClient: OS_CLIENT, FormEngineKey: table, ...where },
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}
// 使用
const r = await formEngineGet('mall_product', {
  _Where: [['Status','=','OnSale']],
  _OrderBy: 'SoldCount',
  _OrderByType: 'DESC',
  _PageSize: 20
});
```

---

## 前端V8异步、同步用法
```javascript
//前端同步执行：
var result = await V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : []
});
if(result.Code != 1){
	V8.Tips(`获取数据出现错误：${result.Msg}`, false); return;
}
var dataList = result.Data;

//前端异步执行：
V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : []
}, function(result){//异步回调函数
	if(result.Code != 1){
		V8.Tips(`获取数据出现错误：${result.Msg}`, false); return;
	}
    var dataList = result.Data;
});
```

## 后端V8异步、同步用法
```javascript
//后端同步执行，第3个参数均支持传入V8.DbTrans数据库事务对象
var result = V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : [],
}, V8.DbTrans);

//后端异步执行，支持await转为同步
V8.FormEngine.GetTableDataAsync('表名或表Id，不区分大小写', {
    _Where : [],
});
```

## 后端.NET二次开发C#用法
```csharp
var _formEngine = new FormEngine();
var result = await _formEngine.GetTableDataAsync('表名或表Id，不区分大小写', new {
    _Where = new List<DiyWhere>(){ 
        new DiyWhere(){
            Name = "Xingming", Value = '张三', Type = "Like"
        }
     }
});
var dataList = result.Data;
```

## _Where条件
>* 见平台文档：[Where条件](https://microi.net/doc/v8-engine/where.html)

## 获取一条数据 GetFormData
```javascript
//必须传入Id或_Where
var result = await V8.FormEngine.GetFormData('表名或表Id，不区分大小写', {
    Id : 'a',//可选，与_Where必选其一，等同于_Where : [['Id', '=', 'a']]
    _Where : [
        [ 'Id', '=', 'a' ]
    ],//可选，与Id必选其一
    _SelectFields : ['Id', 'Name'],//可选，指定查询哪些字段
});
//当查询到的数据不存在时，返回的result为： { Code : 2, Data : null, Msg : '不存在的数据！' }
if(result.Code != 1){
	//错误信息：result.Msg
    return result;
}
var data = result.Data;//格式：{}
```

## 获取数据列表 GetTableData
::: details 展开查看 JavaScript 代码（22 行）
```javascript
var result = V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    Ids : [1, 2, 3],//可选，等同于：_Where : [['Id', 'In', JSON.stringify([1,2,3])]]
    _Where : [
        ['Age', '>', '10']
    ],
    _PageSize : 15,//每页多少条数据。可选，默认最大值1000
    _PageIndex: 1,//第几页数据，从1开始索引。
    _OrderBy : 'Name',//可选。传入排序字段名称。默认值CrateTime、Id
    _OrderByType : 'ASC',//可选。值：DESC、ASC（不区分大小写）。默认值ASC
    _OrderBys: { //或者使用多字段排序 order by Account asc, Phone desc
		'Account' : 'asc', 
		'Phone' : 'desc' 
	},
    _SelectFields : ['Id', 'Name'],//可选，指定查询哪些字段
});
//返回 { Code : 1/0, Data : [], DataCount : 数量总数用于计算分页, Msg : '错误信息' }
//当查询到的数据不存在时，返回的result为： { Code : 1, Data : [] }
if(result.Code != 1){
	//错误信息：result.Msg
    return result;
}
var data = result.Data;//格式：[]
```
:::

### 匿名获取数据列表 GetTableDataAnonymous
>* 用法和以上GetTableData一致
>* 注意如果是在前端V8中使用，必须要在表单属性中开启【允许匿名读取】

### 仅获取数据条数 GetTableDataCount
>* 用法和以上GetTableData一致
```js
var dataCount = result.DataCount;
```

### 获取树形数据列表 GetTableDataTree
>* 用法和以上GetTableData一致
>* 注意表单属性中必须开启【树形结构】配置


## 新增一条数据 AddFormData
```javascript
var result = V8.FormEngine.AddFormData('表名或表Id，不区分大小写', {
    Id : '',//可选，若不传则由服务器端自动生成guid值
    Sex : '男',
    Age : 18,
});
//其它可选参数
_InvokeType : 'Client',//若是在服务器端V8代码中传入此参数值，则也会触发表单属性服务器端V8事件（反之不会触发表单属性服务器端V8事件）。其它方法同理。

//返回 { Code : 1/0, Data : {新增后的数据对象，包含Id、CreateTime、UserId等默认字段}, Msg : '错误信息！' }
//值得注意的是：当表单属性中开启了【允许匿名新增数据】，那么则可以不传入token使用V8.FormEngine.AddFormDataAnonymous()新增数据
//参数与上面一致，但需要新增一个OsClient的参数。
```

## 批量新增数据 AddTableData
>* 等于老版的`AddFormDataBatch`
```javascript
//自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var addList = [];
addList.push({
    FormEngineKey : '表名或表Id，不区分大小写',
    Id : '',//可选
    Age : 18,
    Sex : '女'
});
var addResult = V8.FormEngine.AddTableData(addList);
```

## 修改一条数据 UptFormData
>* __<font color="red">注意：仅支持传入Id进行单条数据的修改，若要根据其它条件修改，考虑到安全性（防止批量误操作更新），请使用【UptFormDataByWhere】</font>__

```javascript
V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传。 注意：如果想根据_Where条件进行修改，请使用【UptFormDataByWhere】
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
});
//其它可选参数：
//有时候传入的对象中包含的字段数量过多，可传入此参数忽略部分字段的修改
_NotSaveField : ['字段名1', '字段名2', '字段名3']
//当要修改的数据不存在时，则执行数据插入动作。默认值false（UptFormDataBatch、UptFormDataByWhere 同理）
_NoLineForAdd : true
//如果是【自动编号】字段，默认不支持修改，若要强制修改自动编号字段，请额外传入参数
_ForceUpt : true //UptFormDataBatch、UptFormDataByWhere 同理
```

## 根据where条件批量修改数据 UptFormDataByWhere
```javascript
//，谨慎操作。如果未传入条件，则返回错误
//对应sql：update diy_content set Name='xxx' where ContentKey like '%test%'
var result = V8.FormEngine.UptFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like'， 'test']
    ],
    Name : 'xxx'
});
//支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```

## 批量修改数据 UptTableData
>* 等于老版的`UptFormDataBatch`
```javascript
//批量修改，自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var uptList = [];
uptList.push({
    FormEngineKey : '表名或表Id，不区分大小写',
    Id : '',//必传
    Age : 20,
    Sex : '女'
});
var uptResult = V8.FormEngine.UptTableData(uptList);
//支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```

## 删除一条数据 DelFormData
```javascript
V8.FormEngine.DelFormData('表名或表Id，不区分大小写', {
    Id : '',//可选，与Ids必传其一
    Ids : [1, 2, 3],//可选，与Id必传其一，等同于：_Where : [['Id', 'In', JSON.stringify([1,2,3])]]
    //注意：为了防止用户误传错误的_Where批量删除了业务数据，因此此处不支持传入_Where，根据_Where条件进行批量删除请使用 DelFormDataByWhere
});
```

## 批量删除数据 DelTableData
>* 等于老版的`DelFormDataBatch`
```javascript
//也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var delList = [];
delList.push({
    FormEngineKey : '',
    Id : '',//必传
});
var delResult = V8.FormEngine.DelTableData(delList);
```

## 根据where条件批量删除数据 DelFormDataByWhere
```javascript
//谨慎操作。如果未传入条件，则返回错误
//对应sql：DELETE FROM diy_content WHERE ContentKey LIKE '%test%'
var result = V8.FormEngine.DelFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like', 'test']
    ],
});
```

## 多表联合查询
>* 多表关联查询可以使用[V8.ModuleEngine]，用法与[V8.FormEngine]一致，不同的是会让模块引擎的配置（如关联表查询配置）生效
```js
var sql = `SELECT A.*, B.Id as BID, B.Name AS BName 
            FROM tableA A 
            LEFT JOIN tableB B on A.BID = B.ID
            WHERE A.ClassType = 'TEST'`;
var result = V8.Db.FromSql(sql).ToArray();
// .ToArray(); //返回数组数据，一般用于select查询多条数据语句
// .ExecuteNonQuery(); //返回受影响行数，一般用于update、delete、insert语句
// .First(); //返回单条数据，一般用于select查询单条数据语句
// .ToScalar(); //返回单条数据的单个字段值，一般用于select单条数据查询、聚合函数、单个字段，如：select sum(Money) from table、select Name from table
```

## 新增一个字段 AddField
```javascript
//暂时仅支持服务器端V8。新增一个字段
var addField = V8.FormEngine.AddField({
    TableName : 'Diy_Test',//表名
    Name : 'Age',//字段名
    Type : 'int',//字段类型
    Label : '年龄',//字段显示名称,
    Component : 'NumberText',//控件类型
    TableWidth : '100',//表格宽度
    Visible : 1 //是否显示
});
```
## 新增一张表 AddTable
>* 暂时仅支持服务器端V8。新增一张表


## 获取某个字段配置的数据源 GetFieldData

## 在事务中执行增删改查、调用其它接口引擎
::: details 展开查看 JavaScript 代码（37 行）
```js
//业务逻辑1：查询数据
var selectResult = V8.FormEngine.GetTableData('tableName', {
    _Where: [
        ['Id', 'In', '(1, 2, 3)']
    ]
}, V8.DbTrans);
if(selectResult.Code != 1){
    return selectResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//业务逻辑2：修改数据
var uptResult = V8.FormEngine.UptFormData('tableName', {
    Id : 1,
    Name : '修改后的值',
    Sex : '女'
}, V8.DbTrans);
if(uptResult.Code != 1){
    return uptResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//业务逻辑3：删除数据
var delResult = V8.FormEngine.DelFormData('tableName', {
    Id : 1,
}, V8.DbTrans);
if(delResult.Code != 1){
    return delResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//业务逻辑4：调用其它接口引擎
var apiEngineResult = V8.ApiEngine.Run('apiEngineKey', {
    Id : 1,
}, V8.DbTrans);
//防止某些接口引擎未返回数据，而是返回的null导致apiEngineResult.Code报错，所以这里的判断是【apiEngineResult && apiEngineResult.Code != 1】
if(apiEngineResult && apiEngineResult.Code != 1){
    return apiEngineResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//当Code=1时平台会自动提交事务，无需手动执行V8.DbTrans.Commit();
//注意：当返回值未指定Code的值时，平台默认自动提交事务，而不是回滚
//注意：只要指定了Code的值，并且不等于1，则平台会自动回滚事务
return { Code : 1, Msg : '操作成功！' };
```
:::