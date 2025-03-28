# FormEngine Usage
## The front and back V8 syntax is consistent, but slightly different
> * This document is a V8 shared document on the front and back ends, both with Javascript syntax and basically the same usage, but with slight differences.
> * The second parameter is passed into the V8.DbTrans database transaction object for all table operations performed by the server [V8.FormEngine]
> * Once the database transaction object is used in the interface engine, V8.DbTrans.Commit() commit or V8.DbTrans.Rollback() rollback must be performed, but not in V8 events (commit or rollback will be performed according to whether V8.Result is false)
> * All functions in V8.FormEngine are single-table operations (except batch operations). For multi-table association queries, see V8.ModuleEngine Usage

## Front-end V8 asynchronous, synchronous usage
```javascript
//第一种，同步执行：
var result = await V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : []
});
if(result.Code != 1){
	V8.Tips(`获取数据出现错误：${result.Msg}`, false); return;
}
var dataList = result.Data;

//第二种，异步执行：
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
//同步执行
//后端V8第二个参数均支持传入V8.DbTrans数据库事务对象
//注意一旦使用了V8.DbTrans对象，就必须执行V8.DbTrans.Commit()提交或V8.DbTrans.Rollback()回滚
var result = V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : [],
}, V8.DbTrans);

//异步执行（目前后端V8异步执行暂不支持回调函数和获取结果，也不支持数据库事务）
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
## Usage of_Where
> See article:[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
# GetFormData: Get a piece of data
```javascript
//必须传入Id或_Where
var result = await V8.FormEngine.GetFormData('表名或表Id，不区分大小写', {
    Id : '',
    _Where : [{ Name : 'Id', Value : '', Type : '=' }]
});
if(modelResult.Code != 1){
	//错误信息：modelResult.Msg
}
```
## GetTableData: Get a list of data
```javascript
V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : [{ Name : 'Age', Value : '10', Type : '>' }],
    _PageSize : 15,//每页多少条数据
    _PageIndex: 1,//第几页数据，从1开始索引
    _OrderBy : 'Name',//可选。传入排序字段名称
    _OrderByType : 'ASC',//可选。值：DESC、ASC（不区分大小写）
    _OrderBys: { //或者使用多字段排序 order by Account asc, Phone desc
		'Account' : 'asc', 
		'Phone' : 'desc' 
	}
});
//返回 { Code : 1/0, Data : [], DataCount : 数量总数用于计算分页, Msg : '错误信息' }
```
## GetTableDataAnonymous: Get a list of data anonymously
> * Usage consistent with the above GetTableData
> * note that if it is used in front-end V8, [allow anonymous reading] must be turned on in the form properties]

## GetTableDataCount: Get only the number of pieces of data
> * Usage consistent with the above GetTableData

## GetTableDataTree: Get a list of tree data
> * Usage consistent with the above GetTableData
> * note that the [tree structure] configuration must be enabled in the form properties

## GetFieldData: Get the data source of a field configuration.

## AddFormData: Add a new piece of data
```javascript
V8.FormEngine.AddFormData('表名或表Id，不区分大小写', {
    Id : '',//可选，若不传则由服务器端自动生成guid值
    Sex : '男',
    Age : 18
});
//返回 { Code : 1/0, Data : {新增后的数据对象，包含Id、CreateTime、UserId等默认字段}, Msg : '错误信息！' }
//值得注意的是：当表单属性中开启了【允许匿名新增数据】，那么则可以不传入token使用V8.FormEngine.AddFormDataAnonymous()新增数据
//参数与上面一致，但需要新增一个OsClient的参数。
```
## AddFormDataBatch: Batch Add Data
```javascript
//自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var addList = [];
addList.push({
    FormEngineKey : '',
    Id : '',//可选
    _RowModel: {
    	Age : 18,
    	Sex : '女'
    }
});
var addResult = V8.FormEngine.AddFormDataBatch(addList);
```



## AddField: Add a new field
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
## AddTable: Add a new table
// Only server-side V8 is supported for the time being. Add a new table


## UptFormData: modify a piece of data
```javascript
V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
});
```
## UptFormDataBatch: Batch Modify Data
```javascript
//批量修改，自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var uptList = [];
uptList.push({
    FormEngineKey : '',
    Id : '',//必传
    _RowModel: {
    
    }
});
var uptResult = V8.FormEngine.UptFormDataBatch(uptList);
```

## UptFormDataByWhere: Batch data modification based on where conditions
```javascript
//，谨慎操作。如果未传入条件，则返回错误
//对应sql：update diy_content set Name='xxx' where ContentKey like '%test%'
var result = V8.FormEngine.UptFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [{ Name : 'ContentKey', Value : 'test', Type : 'Like' }],
    _RowModel : {
        Name : 'xxx'
    }
});
```
## DelFormData: Delete a piece of data
```javascript
V8.FormEngine.DelFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
});
```
## DelFormDataBatch: batch delete data, own transaction
```javascript
//也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var delList = [];
delList.push({
    FormEngineKey : '',
    Id : '',//必传
});
var delResult = V8.FormEngine.DelFormDataBatch(delList);
```
## DelFormDataByWhere: delete data in batches based on where conditions
```javascript
//谨慎操作。如果未传入条件，则返回错误
//对应sql：DELETE FROM diy_content WHERE ContentKey LIKE '%test%'
var result = V8.FormEngine.DelFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [{ Name : 'ContentKey', Value : 'test', Type : 'Like' }],
});
```
