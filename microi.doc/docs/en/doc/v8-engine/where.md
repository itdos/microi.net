
# _Where Conditional Usage
## Introduction
* There is no difference in the javascript of_Where in the interface engine, front-end V8 code, and server-side V8 code.
* _Where is used in object-oriented mode to pass parameters. Each parameter value is finally executed in the database through ORM in parameterized form. There is no risk of SQL injection. MySql, Oracle and SqlServer databases are supported (more databases can still be expanded)
* However, due to the characteristics of low-code platforms, XSS does not need to prevent and allows incoming scripts. In special cases, server port V8 can be used for script filtering.
* Note: the_LambdaWhere parameter may be added later to directly pass in the lambda expression [for example,_LambdaWhere: "Account = 'admin' OR (Accounr <> 'microi' AND Pwd is null) "], and the advantages and disadvantages as well as the possible problems of different database types are still being considered.

## V8 Engine Usage
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
## Description
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

## It is worth noting that if it is a server-side. net secondary development, use c# syntax (not V8 javascript syntax):
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

