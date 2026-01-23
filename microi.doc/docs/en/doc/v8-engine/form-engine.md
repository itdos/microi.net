# FormEngine Usage

## The front and back V8 syntax is consistent, but slightly different
> * This document is a V8 shared document on the front and back ends, both with Javascript syntax and basically the same usage, but with slight differences.
> * The second parameter is passed into the V8.DbTrans database transaction object for all table operations performed by the server [V8.FormEngine]
> * All operations of the server [V8.FormEngine] on the table will not trigger any event of the form attribute (unless_InvokeType:'Client' is passed in), and the front end [V8.FormEngine] will trigger
> * the front-end directly calling the interface address corresponding to V8.FormEngine (such as https:// ***/api/formEngine/addFormData) will also trigger the form attribute server-side V8 event
> * All functions in V8.FormEngine are single-table operations (except batch operations). For multi-table association queries, see V8.ModuleEngine Usage
> *_<font color = "red"> note: starting from Microi.net.dll v3.0.2, if the number of affected rows in the database is 0 when deleting and modifying data, Code = 1 is still returned successfully, and the additional DataCount value is the actual number of affected rows (Code = 1006 was returned in previous versions)</font>__

## Front-end V8 asynchronous, synchronous usage
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

## Backend V8 asynchronous, synchronous usage
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

## Back end. NET secondary development C# usage
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

## _Where condition
> * See platform documentation:[Where condition](/doc/v8-engine/where.html)

## Get a data GetFormData
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

## Get Data List GetTableData
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

### Anonymously Get Data List GetTableDataAnonymous
> * Usage consistent with the above GetTableData
> * note that if it is used in front-end V8, [allow anonymous reading] must be turned on in the form properties]

### Get only the number of data GetTableDataCount
> * Usage consistent with the above GetTableData
```js
var dataCount = result.DataCount;
```

### Get tree data list GetTableDataTree
> * Usage consistent with the above GetTableData
> * note that the [tree structure] configuration must be enabled in the form properties


## Add a new data AddFormData
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

## Batch Add Data AddTableData
> * is equal to the old version`AddFormDataBatch`
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

## Modify a data UptFormData
> *_<font color = "red"> Note: Only the incoming Id can be modified for a single piece of data. To modify it according to other conditions, please use [UptFormDataByWhere] in consideration of safety (to prevent batch misoperation and update). </font>__

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

## Batch modify data UptFormDataByWhere based on where conditions
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

## Batch Modify Data UptTableData
> * is equal to the old version`UptFormDataBatch`
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

## Delete a data DelFormData
```javascript
V8.FormEngine.DelFormData('表名或表Id，不区分大小写', {
    Id : '',//可选，与Ids必传其一
    Ids : [1, 2, 3],//可选，与Id必传其一，等同于：_Where : [['Id', 'In', JSON.stringify([1,2,3])]]
    //注意：为了防止用户误传错误的_Where批量删除了业务数据，因此此处不支持传入_Where，根据_Where条件进行批量删除请使用 DelFormDataByWhere
});
```

## Bulk Delete Data DelTableData
> * is equal to the old version`DelFormDataBatch`
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

## Batch delete data DelFormDataByWhere based on where conditions
```javascript
//谨慎操作。如果未传入条件，则返回错误
//对应sql：DELETE FROM diy_content WHERE ContentKey LIKE '%test%'
var result = V8.FormEngine.DelFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like', 'test']
    ],
});
```

## multi-table union query
> * Multi-table association query can use [V8.ModuleEngine], the usage is the same as [V8.FormEngine], the difference is that the configuration of the module engine (such as the associated table query configuration) will take effect
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

## Add a new field AddField
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
## Add a table AddTable
> * Only server-side V8 is supported for the time being. Add a new table


## Gets the data source GetFieldData for a field configuration

## In the transaction, add, delete, modify, and call other interface engines.
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