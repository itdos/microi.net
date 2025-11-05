# FormEngine用法
## 前后端V8语法一致，但略有差别
>* 此文档为前后端V8共享文档，均为Javascript语法，用法基本一致，但略有差别
>* 服务器端【V8.FormEngine】对表的所有操作，均支持第二个参数传入V8.DbTrans数据库事务对象
>* 在接口引擎中一旦使用了数据库事务对象，必须执行V8.DbTrans.Commit()提交或V8.DbTrans.Rollback()回滚，而V8事件中不需要（会根据V8.Result是否为false来执行提交或回滚）
>* V8.FormEngine下所有函数均为单表操作（除Batch批量操作外），如需多表关联查询请查看V8.ModuleEngine用法

## 前端V8异步、同步用法
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
## 后端V8异步、同步用法
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

## _Where的用法
> 见文章：[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)

## GetFormData：获取一条数据
```javascript
//必须传入Id或_Where
var result = await V8.FormEngine.GetFormData('表名或表Id，不区分大小写', {
    Id : '',
    _Where : [{ Name : 'Id', Value : '', Type : '=' }],
    _SelectFields : ['Id', 'Name'],//可选，指定查询哪些字段
});
if(modelResult.Code != 1){
	//错误信息：modelResult.Msg
}
```
## GetTableData：获取数据列表
```javascript
V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
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
    Ids : [1,2,3],//可选，等同于：_Where : [['Id', 'In', JSON.stringify([1,2,3])]]
});
//返回 { Code : 1/0, Data : [], DataCount : 数量总数用于计算分页, Msg : '错误信息' }
```
## GetTableDataAnonymous：匿名获取数据列表
>* 用法和以上GetTableData一致
>* 注意如果是在前端V8中使用，必须要在表单属性中开启【允许匿名读取】

## GetTableDataCount：仅获取数据条数
>* 用法和以上GetTableData一致

## GetTableDataTree：获取树形数据列表
>* 用法和以上GetTableData一致
>* 注意表单属性中必须开启【树形结构】配置

## GetFieldData：获取某个字段配置的数据源

## AddFormData：新增一条数据
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
## AddFormDataBatch：批量新增数据
```javascript
//自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var addList = [];
addList.push({
    FormEngineKey : '',
    Id : '',//可选
    Age : 18,
    Sex : '女'
});
var addResult = V8.FormEngine.AddFormDataBatch(addList);
```



## AddField：新增一个字段
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
## AddTable：新增一张表
//暂时仅支持服务器端V8。新增一张表


## UptFormData：修改一条数据
>* 支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```javascript
V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
});
```
## UptFormDataBatch：批量修改数据
>* 支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```javascript
//批量修改，自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var uptList = [];
uptList.push({
    FormEngineKey : '',
    Id : '',//必传
    Age : 20,
    Sex : '女'
});
var uptResult = V8.FormEngine.UptFormDataBatch(uptList);
```

## UptFormDataByWhere：根据where条件批量修改数据
>* 支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```javascript
//，谨慎操作。如果未传入条件，则返回错误
//对应sql：update diy_content set Name='xxx' where ContentKey like '%test%'
var result = V8.FormEngine.UptFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like'， 'test']
    ],
    Name : 'xxx'
});
```
## DelFormData：删除一条数据
```javascript
V8.FormEngine.DelFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
});
```
## DelFormDataBatch：批量删除数据，自带事务
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
## DelFormDataByWhere：根据where条件批量删除数据
```javascript
//谨慎操作。如果未传入条件，则返回错误
//对应sql：DELETE FROM diy_content WHERE ContentKey LIKE '%test%'
var result = V8.FormEngine.DelFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like', 'test']
    ],
});
```
