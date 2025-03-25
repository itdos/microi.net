# FormEngineの使い方
## フロントエンドとフロントエンドのv 8文法は一致していますが、少し違います。
>* この文書は前後のv 8共有文書で、すべてJavascript文法で、使用法は基本的に一致しているが、少し違う
>* サーバー側【V8.FormEngine】テーブルに対するすべての操作は、2番目のパラメータがV8.DbTransデータベーストランザクションオブジェクトに渡されることをサポートしています
>* インタフェース・エンジンでデータベース・トランザクション・オブジェクトを使用すると、V8.DbTrans.Commit() コミットまたはV8.DbTrans.Rollback() ロールバックを実行する必要がありますV 8イベントには必要ありません (V8.Resultがfalseかどうかに基づいてコミットまたはロールバックを実行します)
>* V8.FormEngineのすべての関数は単一テーブル操作 (Batch一括操作を除く) です。複数テーブルの関連付けクエリが必要な場合は、V8.ModuleEngineの使用方法を確認してください

## フロントエンドv 8非同期、同期使用法
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
## バックエンドv 8非同期、同期使用法
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
## バックエンド. NET二次開発C # 使い方
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
## _ Whereの使い方
> 記事を参照:[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
# GetFormData: データを取得します
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
## GetTableData: データリストの取得
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
## GetTableDataAnonymous:匿名取得データリスト
>* 使用法は上記のGetTableDataと一致しています
>* 注意フロントエンドv 8で使用する場合は、フォームのプロパティで「匿名読み取りを許可する」をオンにする必要があります

## GetTableDataCount: データ件数のみ取得
>* 使用法は上記のGetTableDataと一致しています

## GetTableDataTree: ツリーデータのリストを取得します
>* 使用法は上記のGetTableDataと一致しています
>* 注意フォーム属性では「ツリー構造」設定をオンにする必要があります

## GetFieldData: フィールド構成のデータソースを取得します

## Add formdata: データを追加します
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
## Add formdatabatch: データの一括追加
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



## Add field: フィールドを追加します
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
## AddTable: テーブルを追加します
// 一時的にサーバ側v 8のみをサポートします。テーブルを追加します


## UptFormData: データを変更します
```javascript
V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
});
```
## UptFormDataBatch: データの一括修正
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

## UptFormDataByWhere: where条件に基づいてデータを一括修正します
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
## DelFormData: データを削除します
```javascript
V8.FormEngine.DelFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
});
```
## DelFormDataBatch: データを一括削除し、トランザクションを持っています
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
## DelFormDataByWhere: where条件に基づいてデータを一括削除します
```javascript
//谨慎操作。如果未传入条件，则返回错误
//对应sql：DELETE FROM diy_content WHERE ContentKey LIKE '%test%'
var result = V8.FormEngine.DelFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [{ Name : 'ContentKey', Value : 'test', Type : 'Like' }],
});
```
