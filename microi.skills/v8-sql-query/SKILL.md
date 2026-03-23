# Microi V8 安全 SQL 查询

你正在开发 Microi 吾码平台的 V8 引擎代码。数据库查询有两种方式：`V8.FormEngine`（推荐）和 `V8.Db`（原始 SQL）。必须遵守安全规范。

## 首选：V8.FormEngine + _Where（自动防注入）

`_Where` 是参数化查询语法，自动防 SQL 注入，**永远优先使用**。

```javascript
// ✅ 安全：_Where 自动参数化
var result = V8.FormEngine.GetTableData('SysUser', {
  _Where: [
    ['Account', '=', V8.Param.account],
    ['AND', 'Status', '=', 1]
  ],
  PageIndex: 1,
  PageSize: 20
});
```

### _Where 完整语法

```javascript
// 基本条件
[['Field', '操作符', value]]

// 操作符：=, ==, <>, !=, >, >=, <, <=, Like, NotLike, StartLike, EndLike, In, NotIn

// 多条件 AND
[['A', '=', 1], ['AND', 'B', '>', 10]]

// 多条件 OR
[['A', '=', 1], ['OR', 'B', '=', 2]]

// IN 查询
[['Id', 'In', ['id1', 'id2', 'id3']]]

// NULL 判断
[['Field', '=', null]]    // IS NULL
[['Field', '<>', null]]   // IS NOT NULL

// 分组（括号）：(Age > 18 OR Status = 1)
[['Name', 'Like', '张'], ['AND', '(', 'Age', '>', 18], ['OR', 'Status', '=', 1, ')']]

// 日期范围
[['CreateTime', '>=', '2024-01-01'], ['AND', 'CreateTime', '<', '2024-02-01']]
```

## 次选：V8.Db.FromSql（参数化占位符）

当 `_Where` 无法满足复杂查询（多表 JOIN、子查询、聚合统计）时使用 `V8.Db`。

```javascript
// ✅ 安全：使用 @p0, @p1 参数占位符
var list = V8.Db.FromSql(
  'SELECT a.Id, a.Name, b.OrderCount FROM Customer a LEFT JOIN (SELECT CustomerId, COUNT(*) OrderCount FROM OrderHeader GROUP BY CustomerId) b ON a.Id = b.CustomerId WHERE a.Status = @p0',
  1
).ToList();

// ✅ 安全：多个参数
var row = V8.Db.FromSql(
  'SELECT * FROM SysUser WHERE Account = @p0 AND DeptId = @p1',
  V8.Param.account,
  V8.Param.deptId
).ToModel();

// 统计
var count = V8.Db.FromSql(
  'SELECT COUNT(*) FROM OrderHeader WHERE Status = @p0 AND CreateTime >= @p1',
  1,
  V8.Param.startDate
).ExecuteScalar();

// 非查询（UPDATE / INSERT / DELETE）
V8.Db.FromSql(
  'UPDATE SysUser SET LastLoginTime = @p0 WHERE Id = @p1',
  DateNow('yyyy-MM-dd HH:mm:ss'),
  V8.CurrentUser.Id
).ExecuteNonQuery();
```

### V8.Db 方法速查

| 方法 | 返回 | 用途 |
|------|------|------|
| `.ToList()` | 数组 | 查询多条 |
| `.ToModel()` | 对象 \| null | 查询单条 |
| `.ExecuteScalar()` | 单值 | COUNT / MAX / SUM |
| `.ExecuteNonQuery()` | 影响行数 | UPDATE / DELETE / INSERT |

### 读写分离

```javascript
V8.Db.FromSql(...)      // 主库（读写）
V8.DbRead.FromSql(...)  // 从库（只读，适合报表和大量查询）
```

### 跨应用查询

```javascript
V8.Dbs['otherOsClient'].FromSql('SELECT * FROM Table WHERE Id = @p0', id).ToModel();
```

## 数据库事务

```javascript
// V8.Db 在同一引擎内自动开启事务
V8.Db.FromSql('UPDATE Account SET Balance = Balance - @p0 WHERE Id = @p1', 100, fromId).ExecuteNonQuery();
V8.Db.FromSql('UPDATE Account SET Balance = Balance + @p0 WHERE Id = @p1', 100, toId).ExecuteNonQuery();

// 手动提交（不提交则在引擎执行完毕后自动提交）
V8.DbTrans.Commit();

// 手动回滚
V8.DbTrans.Rollback();
```

## 绝对禁止

```javascript
// ❌ 绝对禁止：拼接 SQL 字符串
var sql = "SELECT * FROM SysUser WHERE Account = '" + V8.Param.account + "'";
V8.Db.FromSql(sql).ToList();  // SQL 注入漏洞！

// ❌ 禁止：动态拼接表名
var sql = "SELECT * FROM " + V8.Param.tableName + " WHERE Id = @p0";

// ✅ 正确做法：始终使用参数化
var list = V8.Db.FromSql(
  'SELECT * FROM SysUser WHERE Account = @p0',
  V8.Param.account
).ToList();
```

## 常见查询模式

### 分页查询

```javascript
var pageIndex = parseInt(V8.Param.pageIndex) || 1;
var pageSize = Math.min(parseInt(V8.Param.pageSize) || 20, 100); // 限制最大100

var result = V8.FormEngine.GetTableData('TableName', {
  _Where: [['Status', '=', 1]],
  _OrderBy: 'CreateTime',
  _OrderByType: 'DESC',
  PageIndex: pageIndex,
  PageSize: pageSize
});

return { Code: 1, Data: result.Data, Total: result.Total };
```

### 模糊搜索（多字段）

```javascript
var keyword = V8.Param.keyword;
var where = [['Status', '=', 1]];
if (keyword) {
  where.push(['AND', '(', 'Name', 'Like', keyword]);
  where.push(['OR', 'Code', 'Like', keyword]);
  where.push(['OR', 'Phone', 'Like', keyword, ')']);
}

var result = V8.FormEngine.GetTableData('Customer', {
  _Where: where,
  PageIndex: 1,
  PageSize: 20
});
```

### 关联查询（SQL JOIN）

```javascript
var list = V8.Db.FromSql(`
  SELECT o.Id, o.OrderNo, o.TotalAmount, c.Name AS CustomerName
  FROM OrderHeader o
  INNER JOIN Customer c ON o.CustomerId = c.Id
  WHERE o.Status = @p0 AND o.CreateTime >= @p1
  ORDER BY o.CreateTime DESC
`, 1, V8.Param.startDate).ToList();
```

## 注意事项

- `V8.Db.FromSql` 的参数占位符从 `@p0` 开始递增
- `V8.FormEngine` 操作会触发该表上的 V8 事件，加 `_InvokeType: 'Client'` 可跳过
- 查询结果数量较大时务必分页，避免返回过多数据
- `V8.DbRead` 适用于不需要实时性的报表查询
