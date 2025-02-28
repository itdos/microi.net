# Where条件用法

## Where条件用法

- _Where在接口引擎、前端 `V8` 代码、服务器端V8代码中的 `javascript` 写法没有任何区别。
- _Where用法为面向对象模式传参，每个参数值最终均以参数化形式通过 `ORM` 在数据库中执行，无 `sql` 注入风险，支持 `MySql、Oracle、SqlServer` 数据库（仍可扩展更多数据库）
- 而由于低代码平台的特性，`XSS` 无需防范，允许传入脚本，特殊情况可采用服务器端口 `V8` 进行脚本过滤。
- 备注：后期可能会新增 `_LambdaWhere` 参数直接传入 `lambda` 表达式【例如 `_LambdaWhere: " Account = ‘admin’ OR (Accounr <> ‘microi’ AND Pwd is null) "`】，还在考虑其中利弊以及不同数据库种类可能存在的问题。
 

## V8引擎用法

```csharp
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

## 关键词说明

```bash
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

> 🎯值得注意的是，如果是服务器端 `.net` 二次开发，则使用 `c#` 语法 ，ps:非 `V8 javascript` 语法：

``` csharp
var _formEngine = new FormEngine();
var result = await _formEngine.GetTableDataAsync('Sys_User', new {
    _Where = new List<DiyWhere>(){ 
                new DiyWhere(){ Name = 'Account', Value = 'ccc', Type = 'Like'},
                new DiyWhere(){ AndOr = 'OR', GroupStart = true, Name = 'Account', Value = 'ad', Type = 'Like' },
                new DiyWhere(){ AndOr = 'AND', Name = 'Account', Value = 'min1', Type = 'Like', GroupEnd = true }
             }
});

```
