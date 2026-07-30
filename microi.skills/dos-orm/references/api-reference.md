# Dos.ORM API 参考

## 数据库 Provider

| DatabaseType | Provider |
|---|---|
| `SqlServer` | SQL Server 2000 |
| `SqlServer9` | SQL Server 2005+ |
| `MySql` | MySQL |
| `Oracle` | Oracle |
| `PostgreSql` | PostgreSQL |
| `DaMeng` | 达梦 |
| `KingBase` | 人大金仓 |
| `Sqlite3` | SQLite |
| `MsAccess` | Access |

兼容协议数据库仍需目标库实测，不能只凭协议名称判定所有 DDL、分页和 BulkCopy 一致。

默认会话入口是 `DbSession.Default`；多数据库、读写分离和分片场景使用明确的
`DbSession` 实例，避免把默认连接误用于其它租户或数据库。

## 实体

```csharp
[TableName("sys_user")]
public class SysUser : Entity
{
    public string Id { get; set; }
    public string Account { get; set; }
    public DateTime CreateTime { get; set; }

    public override Field[] GetFields() => new[] { _.Id, _.Account, _.CreateTime };
    public override object[] GetValues() => new object[] { Id, Account, CreateTime };
    public override Field GetIdentityField() => _.Id;

    public sealed class _
    {
        public static readonly Field Id = new Field("Id", "sys_user");
        public static readonly Field Account = new Field("Account", "sys_user");
        public static readonly Field CreateTime = new Field("CreateTime", "sys_user");
    }
}
```

`Entity.GetFields()` 的字段顺序也是批量写入和 CodeFirst 映射依据；实体声明、
字段数组与数据库列变更必须同步。

## 查询链

| API | 作用 |
|---|---|
| `From<T>()` / `From("table")` | 查询入口 |
| `Where(predicate)` / `Where(WhereClip)` | 条件 |
| `OrderBy` / `OrderByDescending` | 排序 |
| `GroupBy` / `Having` | 分组 |
| `Select` / `AddSelect` | 选择字段 |
| `Distinct` / `Top` / `Page` | 去重、Top、分页 |
| `InnerJoin/LeftJoin/RightJoin/CrossJoin/FullJoin` | Join |
| `Union/UnionAll` | 集合联合 |
| `SetCacheTimeOut` / `Refresh` | 查询缓存/绕过缓存 |
| `ToList/ToListAsync` | 列表 |
| `ToFirst/ToFirstAsync` | 第一条或 null |
| `ToFirstDefault` | 第一条或 new 实体 |
| `ToScalar/ToScalarAsync` | 标量 |
| `ToDataReader` / `ToDataTable/ToDataTableAsync` | Reader/DataTable |
| `ToEnumerable` | 流式枚举 |
| `Count/CountAsync` | 计数 |
| `ExecuteNonQuery/ExecuteNonQueryAsync` | 非查询 |

查询缓存入口的完整成员名是 `FromSection.SetCacheTimeOut`。缓存 Key 包含 SQL
与参数值，但写后失效、租户隔离和多节点一致性仍由业务负责。

```csharp
var users = await dbSession.From<SysUser>()
    .Where(u => u.Account == account)
    .OrderByDescending(u => u.CreateTime)
    .Page(20, 1)
    .ToListAsync();
```

## WhereClip

```csharp
var where = new Where<SysUser>();
where.And(u => u.Status == 1);
if (!string.IsNullOrWhiteSpace(keyword))
    where.And(u => u.Name.Like(keyword));
if (deptIds?.Any() == true)
    where.And(u => u.DeptId.In(deptIds));

var list = dbSession.From<SysUser>()
    .Where(where.ToWhereClip())
    .ToList();
```

支持比较、`Like/NotLike/StartsWith/EndsWith`、`In/NotIn` 和 NULL。

## 原生 SQL

```csharp
var users = dbSession
    .FromSql("SELECT Id,Account FROM sys_user WHERE Status=@p0")
    .AddInParameter("@p0", 1)
    .ToList<SysUser>();
```

动态值只走参数；动态标识符先从固定白名单映射。
Provider 的标识符替换最终由 `DataUtils.FormatSQL` 完成；不要绕过该步骤手工
拼接用户输入的表名或字段名。

## 写入

```csharp
dbSession.Insert(entity);
dbSession.Insert(list);
dbSession.Update<SysUser>(u => u.Status, 0, u => u.Id == id);
dbSession.Delete<SysUser>(u => u.Id == id);
```

批量：

```csharp
var affected = dbSession.BulkInsert(list, batchSize: 5000, bulkCopyTimeoutSeconds: 600);
var affectedAsync = await dbSession.BulkInsertAsync(list, batchSize: 5000, ct: token);
```

原生优选：

- SQL Server：SqlBulkCopy
- MySQL：MySqlBulkCopy
- PostgreSQL/KingBase：Binary COPY
- Oracle/达梦/SQLite/Access：多行参数化 INSERT 回退

批大小 5000 只是起点；按行宽、索引、日志、网络和数据库负载测量。

## Upsert

```csharp
dbSession.Upsert(user, SysUser._.Account);
await dbSession.UpsertAsync(
    user,
    ct: token,
    conflictFields: new[] { SysUser._.Account });
```

各 Provider 使用 `ON DUPLICATE KEY`、`ON CONFLICT`、`MERGE` 或更新后插入回退。
冲突字段必须有数据库唯一约束。

## SqlFunc 与子查询

`SqlFunc` 提供 `SqlFunc.IfNull`、`SqlFunc.IIF`、`SqlFunc.Length`、
`SqlFunc.Substring`、`SqlFunc.Now`、`SqlFunc.DateDiff`、
`SqlFunc.JsonValue`、`SqlFunc.Concat`、`SqlFunc.Upper`、`SqlFunc.Lower`、
`SqlFunc.Trim`、`SqlFunc.Abs`、`SqlFunc.Round`、`SqlFunc.Count`、
`SqlFunc.Sum`、`SqlFunc.Avg`、`SqlFunc.Min`、`SqlFunc.Max` 的 Provider 方言。

`SqlSubQuery` 提供 `SqlSubQuery.Exists`、`SqlSubQuery.NotExists`、
`SqlSubQuery.In`、`SqlSubQuery.NotIn`、`SqlSubQuery.Scalar` 和
`SqlSubQuery.Count`。
返回的是 SQL 片段，数据值仍要参数化。

## 导航属性

`[Navigate]` 支持 `NavigateType.OneToOne`、`NavigateType.OneToMany`、
`NavigateType.ManyToMany`；加载入口：

- `IncludeOne`
- `IncludeMany`
- `IncludeManyToMany`

实现使用批量 IN，避免逐行 N+1。仍要限制主结果规模。

## CodeFirst

```csharp
dbSession.CreateTable<SysUser>();
dbSession.SyncSchema(typeof(SysUser), typeof(Order));
var exists = dbSession.TableExists("sys_user");
```

`CreateTable<T>(dropIfExists: true)` 是破坏性操作，只可在明确授权的隔离环境使用。
实体索引可用 `[Index]` 声明；Microi 低代码业务表的运行时索引仍必须走 Manifest/MCP。

## 读写分离

```csharp
var router = new ReadWriteRouter(master);
router.AddSlave(slave1, weight: 1);
router.AddSlave(slave2, weight: 2);

var read = router.GetReadSession();
var write = router.GetWriteSession();

using (router.ForceMaster())
{
    var latest = router.GetReadSession().From<SysUser>().ToList();
}
```

支持加权轮询、摘除和回退。事务与读自己刚写的数据必须读主。

## 分库分表

表名路由：

- `ShardingRouter.MonthlyTable`
- `ShardingRouter.HashModTable`
- `ShardingRouter.ModTable`

数据库路由：

- `DbShardingRouter.AddNode`
- `RouteByHash`
- `AllNodes`

稳定 Hash 使用 FNV-1a。跨分片事务、全局唯一键、分页排序和聚合需要业务层明确设计。

## 监控与缓存

```csharp
Dos.ORM.Section.SlowSqlThresholdMs = 1000;
Dos.ORM.Section.OnSlowSql = (cmd, elapsed, operation) =>
{
    // 记录脱敏 SQL 模板、耗时和关联 Id；不要记录密钥参数
};
```

反序列化器、实体元数据和字段名缓存是进程内优化，允许节点重启后重建；
不能作为跨节点业务事实。查询缓存使用滑动过期，写后按业务失效。
