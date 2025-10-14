
# _Where条件用法
## 介绍
* _Where在接口引擎、前端V8代码、服务器端V8代码中的javascript写法没有任何区别。
* _Where用法为面向对象模式传参，每个参数值最终均以参数化形式通过ORM在数据库中执行，无sql注入风险，支持MySql、Oracle、SqlServer数据库（仍可扩展更多数据库）

## V8引擎用法
```js
// 简单条件
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['Account', '=', 'cccc'],
        ['OR', 'Account', 'Like', 'VK']
    ]
});

// 带括号的复杂条件
var result2 = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['(', 'Account', '=', 'cccc'],
        ['OR', 'Account', 'Like', 'VK', ')']
    ]
});

// 混合条件
var result3 = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['Xingming', 'Like', '张'],
        ['AND', '(', 'Age', '>', '18'],
        ['OR', 'Status', '=', 'active', ')']
    ]
});
```

## 值得注意的是，如果是服务器端.net二次开发，则使用c#语法（非V8 javascript语法）
```csharp
var _formEngine = new FormEngine();
var result = await _formEngine.GetTableDataAsync('Sys_User', new {
    _Where = new List<List<string>>() {
        new List<string> { "Account", "=", "cccc" },
        new List<string> { "OR", "Account", "Like", "VK" }
    }
});
```

## 条件符号说明
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

## （旧版v1）V8引擎用法
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

## （旧版v1）值得注意的是，如果是服务器端.net二次开发，则使用c#语法（非V8 javascript语法）
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

