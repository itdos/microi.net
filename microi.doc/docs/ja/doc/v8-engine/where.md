
# _ Where条件の使用法
## 紹介
* _ Whereは、インタフェースエンジン、フロントエンドv 8コード、サーバー側v 8コードのjavascriptの書き方に違いはない。
* _ Whereの使用法はオブジェクト指向のパラメータで、各パラメータ値は最終的にパラメータ化された形式でORMを介してデータベースで実行され、sql注入リスクはありませんmySql、Oracle、SqlServerデータベースをサポート (より多くのデータベースを拡張可能)
* 低コードプラットフォームの特性のため、XSSは防止する必要がなく、スクリプトのインポートを許可し、特殊な場合はサーバポートv 8でスクリプトフィルタを行うことができる。
* 備考: 後で追加される可能性があります _ lambdawhereパラメータは、lambda式に直接渡されますその長所と短所とデータベースの種類によって存在する可能性のある問題も考慮されています

## V 8エンジンの使い方
```javascript
//虽然用法看上去比较繁琐，但需要考虑到前端参数在ORM中的参数化（防止Sql注入），暂时没想到比较好的方法
//不过有考虑将写法改成：_Where: [{ 'Xingming', '张三', '=' }]//对应Sql：where Xingming='张三'
//Sys_User为表名或表Id，不区分大小写
var result = V8.FormEngine.GetTableData('Sys_User', {
    //以下对应sql语句： Account LIKE '%ad%' OR Acount LIKE '%VK%'。AndOR可不传，默认为And
    _Where : [{ Name : 'Account', Value : 'ad', Type : 'Like' },
              { AndOr : 'OR', Name : 'Account', Value : 'VK', Type : 'Like' }]
    
    //以下对应sql语句：Account LIKE '%cccc%' OR ( Account LIKE '%ad%' AND Account LIKE '%min%' )
    //注：GroupStart表示左括号，GroupEnd表示右括号
    _Where : [
                { Name : 'Account', Value : 'cccc', Type : 'Like'},
                { AndOr : 'OR', GroupStart : true, Name : 'Account', Value : 'ad', Type : 'Like' },
                { AndOr : 'AND', Name : 'Account', Value : 'min1', Type : 'Like', GroupEnd : true }
             ]
    //备注：后期也有可能会提供以下新写法，严格按照参数顺序传入：Name、Type、Value、AndOr、GroupStart、GroupEnd。【目前暂未开始实现，因为_Where已经满足绝大部分需求】
    //_WhereList : [ { 'Account', '=', 'cccc' }, { 'Account', 'Like', 'VK', 'OR' } ]
});
V8.Result = result;
```
## 説明
```csharp
//Type参数支持用法：
Equal、=、==    //均为等于
NotEqual、<>、!=    //均为不等于
>、>=、<、<=    //大于小于相关判断
In、NotIn    //注意此时Value需要传入序列化后的数组字符串，如：["id1", "id2"]
Like、NotLike    //%值%
StartLike、NotStartLike    //值%
EndLike、NotEndLike    //%值
//注：Value值可直接赋值null，如：{ Name : 'Account', Value : null, Type : '=' }对应sql：where Account is null
```

## 注目すべき点は、サーバー側の.net二次開発では、c # 文法 (v 8 javascript文法ではない) を使用することです
```csharp
var _formEngine = new FormEngine();
var result = await _formEngine.GetTableDataAsync('Sys_User', new {
    _Where = new List<DiyWhere>(){ 
                new DiyWhere(){ Name = 'Account', Value = 'ccc', Type = 'Like'},
                new DiyWhere(){ AndOr = 'OR', GroupStart = true, Name = 'Account', Value = 'ad', Type = 'Like' },
                new DiyWhere(){ AndOr = 'AND', Name = 'Account', Value = 'min1', Type = 'Like', GroupEnd = true }
             }
});
```

