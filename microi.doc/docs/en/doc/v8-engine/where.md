
# _Where Conditional Usage
## Introduction
> *_There is no difference in the JavaScript writing of where in the interface engine, front-end V8 code, and server-side V8 code
> * _Where each parameter value is finally parameterized and executed in the database through ORM, without SQL injection risk, and supports MySql, Oracle and SqlServer databases (more databases can be expanded)
> *_<font color = red> Note: If the old interface engine V8 code parses the old version of_Where conditional format passed in by the front end, you need to use V8.Method.ParseWhere() to convert the new version of_Where to the old version </font>__
```js
var _oldWhere = V8.Method.ParseWhere(V8.Param._Where);//新版前端传入的_Where参数为新版格式
```

## V8 Engine Usage
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

## It is worth noting that if it is a server-side. net secondary development, use c# syntax (not V8 javascript syntax)
```csharp
var _formEngine = new FormEngine();
var result = await _formEngine.GetTableDataAsync('Sys_User', new {
    _Where = new List<List<object>>() {
        new List<object> { "Account", "=", "cccc" },
        new List<object> { "OR", "Account", "Like", "VK" }
    }
});
```

## Condition Symbol Description
> * Value value can be directly assigned null, for example:[['Account', '=', null ]] corresponding to SQL: where Account is null
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



## (Old version, still compatible) V8 engine usage
```javascript
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
});
return result;
```

## (Old version, still compatible) It is worth noting that if it is server-side. net secondary development, use c# syntax (non-V8 javascript syntax)
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

