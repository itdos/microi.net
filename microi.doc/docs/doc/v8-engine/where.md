
# _Where条件用法
## 介绍
>* _Where在接口引擎、前端V8代码、服务器端V8代码中的JavaScript写法没有任何区别
>* _Where每个参数值最终均以参数化形式通过ORM在数据库中执行，无sql注入风险，支持MySql、Oracle、SqlServer数据库（可扩展更多数据库）
>* __<font color=red>注意：旧的接口引擎V8代码如果解析了前端传入的旧版_Where条件格式，此时需要使用V8.Method.ParseWhere()将新版_Where转换成旧版</font>__
```js
var _oldWhere = V8.Method.ParseWhere(V8.Param._Where);//新版前端传入的_Where参数为新版格式
```

## V8引擎用法
```js
// 对应sql：WHERE Account = 'cccc' AND Account LIKE '%VK%'
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['Account', '=', 'cccc'],
        ['Account', 'Like', 'VK']//默认AND条件
    ]
});

// 对应sql：WHERE Account = 'cccc' OR Account LIKE '%VK%'
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['Account', '=', 'cccc'],
        ['OR', 'Account', 'Like', 'VK']//OR条件
    ]
});
// 对应sql：WHERE Xingming LIKE '%张%' AND ( Age > 18 OR Status = 'active' OR Status IS NOT NULL OR Test In (1,2,3))
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['Xingming', 'Like', '张'],
        ['AND', '(', 'Age', '>', 18],//此处AND也可不写，默认AND条件
        ['OR', 'Status', '=', 'active']
        ['OR', 'Status', '<>', null]
        ['OR', 'Test', 'In', [1, 2, 3], ')']
    ]
});
//如果日期字段是yyyy-MM-dd HH:mm:ss格式
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['CreateTime', '>', DateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss')]
    ]
})
//如果日期字段是yyyy-MM-dd格式
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['JiaoyiDate', '>', DateFormat(item.日期字段, 'yyyy-MM-dd')]
    ]
})
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
>* Value值可直接赋值null，如：[['Account', '=', null ]] 对应 sql：where Account is null
```csharp
//Type参数支持用法：
Equal、=、==    //均为等于
NotEqual、<>、!=    //均为不等于
>、>=、<、<=    //大于小于相关判断
In、NotIn    //注意此时Value需要传入数组，如：['id1', 'id2']
Like、NotLike    //%值%
StartLike、NotStartLike    //值%
EndLike、NotEndLike    //%值
```



## （旧版写法，仍兼容）V8引擎用法
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
return result;
```

## （旧版写法，仍兼容）值得注意的是，如果是服务器端.net二次开发，则使用c#语法（非V8 javascript语法）
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

