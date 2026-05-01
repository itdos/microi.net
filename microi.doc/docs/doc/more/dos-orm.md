# 🗄️ Dos.ORM 框架完整文档

> Dos.ORM 是 Microi 平台底层使用的高性能 ORM 框架，自 2009 年起持续演进。

---

## 1. 设计理念

| 特性 | 说明 |
|------|------|
| **仓储模式 + DbSession 入口** | 通过 `DbSession.Default` 或自定义实例操作数据库，事务通过 `using (var trans = dbSession.BeginTransaction())` 控制 |
| **跨数据库一致** | 同一 SQL 模板在 SqlServer/MySQL/Oracle/PostgreSQL/达梦/金仓/SQLite/MsAccess 上得到一致结果 |
| **延迟绑定标识符** | 字段/表名以 `{0}xxx{1}` 占位符流转，最终调用 `DataUtils.FormatSQL` 时按 Provider 替换为 `[]` / `` ` `` / `"`。**不要试图重构这套机制**，它是性能与可维护性的核心 |
| **同步/异步双 API** | 老代码用 `Insert`/`ToList` 等同步方法依然可用；新代码可调用对应 `*Async` 方法 |
| **IL-Emit 反序列化** | 列 → 实体属性的填充走 IL，并按 `(Type, columnSignature)` 缓存 DynamicMethod |
| **零反射热路径** | `Field.FieldName` / `TableFieldName` 等热属性结果一次性缓存 |

---

## 2. 支持的数据库

| 数据库 | DatabaseType 枚举 | Provider 类 | 标识符引号 |
|------|---|---|------|
| SQL Server 2000 | `SqlServer` | `Dos.ORM.SqlServer.SqlServerProvider` | `[ ]` |
| SQL Server 2005+ | `SqlServer9` | `Dos.ORM.SqlServer9.SqlServer9Provider` | `[ ]` |
| MySQL | `MySql` | `Dos.ORM.MySql.MySqlProvider` | `` ` ` `` |
| Oracle | `Oracle` | `Dos.ORM.Oracle.OracleProvider` | `" "` |
| PostgreSQL | `PostgreSql` | `Dos.ORM.PostgreSql.PostgreSqlProvider` | `" "` |
| 达梦 DM | `DaMeng` | `Dos.ORM.DaMeng.DaMengProvider` | `" "` |
| 人大金仓 KingBase | `KingBase` | `Dos.ORM.KingBase.KingBaseProvider` | `" "` |
| SQLite | `Sqlite3` | `Dos.ORM.Sqlite.SqliteProvider` | `[ ]` |
| MsAccess | `MsAccess` | `Dos.ORM.MsAccess.MsAccessProvider` | `[ ]` |

> 国产数据库（达梦、金仓、神通、TDSQL、OceanBase）：神通和 TDSQL 兼容 PostgreSQL 协议，可复用 PostgreSQL Provider；OceanBase 兼容 MySQL 协议，可复用 MySQL Provider。

---

## 3. 项目结构

```
Dos.ORM/
├─ Common/             类型转换、IL 反序列化、字段元数据
│  ├─ Entity.cs                抽象基类，所有实体继承自 Entity
│  ├─ EntityCache.cs           表名/字段/标识列缓存（按 Type 全局缓存）
│  ├─ EntityUtils.cs           IL-Emit 生成 Reader→实体反序列化器（含 cache）
│  ├─ DataUtils.cs             类型转换、标识符 {0}{1} → 引号 替换
│  ├─ Field.cs                 字段元数据（带 FieldName/TableName 缓存）
│  └─ DesignByContract.cs      参数检查
├─ Db/
│  ├─ DbSession.cs             ORM 主入口，From/Insert/Update/Delete
│  ├─ Database.cs              ADO.NET 包装，ExecuteScalar/NonQuery/Reader（同步+异步）
│  ├─ DbTrans.cs               事务句柄（IDisposable，幂等）
│  ├─ DbBatch.cs               批处理（多命令一连接）
│  ├─ CommandCreator.cs        构造 INSERT/UPDATE 等参数化命令
│  ├─ BulkCopy.cs              【新增】批量插入扩展，支持原生 BulkCopy + 多行 INSERT
│  ├─ Upsert.cs                【新增】跨库 InsertOrUpdate
│  ├─ SqlFunc.cs               【新增】跨库 SQL 函数库
│  ├─ SubQuery.cs              【新增】子查询助手
│  ├─ Navigate.cs              【新增】导航属性 + Includes 加载器
│  ├─ ReadWriteRouter.cs       【新增】读写分离路由
│  └─ ShardingRouter.cs        【新增】分库分表路由
├─ Section/
│  ├─ Section.cs               基类，含慢 SQL 跟踪
│  ├─ SqlSection.cs            原生 SQL 片段（FromSql 链式 API）
│  └─ FromSection.cs           From<T>() 实体查询构建器
├─ Expression/
│  ├─ WhereClip.cs             Where 条件构建（支持 lambda + And/Or 拼接）
│  └─ OrderByClip.cs           OrderBy 表达式（已加字段名安全校验）
├─ Provider/
│  ├─ DbProvider.cs            抽象基类
│  └─ {SqlServer,MySql,...}Provider.cs   各数据库实现
└─ DDL/                       建表/迁移服务
   └─ CodeFirst.cs            【新增】实体 → 跨库 DDL 自动建表
```

---

## 4. 入门示例

### 4.1 定义实体

```csharp
[TableName("sys_user")]
public class SysUser : Entity
{
    public override Field[] GetFields() => new[] {
        _.Id, _.Account, _.Pwd, _.Name, _.CreateTime
    };
    public override object[] GetValues() => new object[] {
        Id, Account, Pwd, Name, CreateTime
    };
    public override Field GetIdentityField() => _.Id;

    public string Id { get; set; }
    public string Account { get; set; }
    public string Pwd { get; set; }
    public string Name { get; set; }
    public DateTime CreateTime { get; set; }

    public sealed class _
    {
        public static readonly Field Id          = new Field("Id", "sys_user");
        public static readonly Field Account     = new Field("Account", "sys_user");
        public static readonly Field Pwd         = new Field("Pwd", "sys_user");
        public static readonly Field Name        = new Field("Name", "sys_user");
        public static readonly Field CreateTime  = new Field("CreateTime", "sys_user");
    }
}
```

### 4.2 简单查询

```csharp
// 同步
var list = dbSession.From<SysUser>()
    .Where(u => u.Account == "admin")
    .OrderByDescending(u => u.CreateTime)
    .ToList();

// 异步
var list = await dbSession.From<SysUser>()
    .Where(u => u.Account == "admin")
    .ToListAsync();

// 原生 SQL（参数化）
var users = dbSession.FromSql("SELECT * FROM sys_user WHERE Status = @p0")
    .AddInParameter("@p0", 1)
    .ToList<SysUser>();
```

### 4.3 增删改

```csharp
// 单条插入
dbSession.Insert(new SysUser { Account = "test", Pwd = "...", Name = "测试" });

// 批量插入（默认走多行 INSERT，自动事务）
dbSession.Insert(userList);

// 高性能 BulkInsert（推荐 > 1000 条时使用）
dbSession.BulkInsert(userList, batchSize: 5000);
await dbSession.BulkInsertAsync(userList, batchSize: 5000);

// 更新
dbSession.Update<SysUser>(u => u.Status, 0, u => u.Id == "x");

// 删除
dbSession.Delete<SysUser>(u => u.Id == "x");
```

### 4.4 事务

```csharp
using (var trans = dbSession.BeginTransaction())
{
    try
    {
        trans.Insert(user);
        trans.Update<SysUser>(...);
        trans.Commit();
    }
    catch
    {
        trans.Rollback();
        throw;
    }
}
// 注意：Dispose 是幂等的，没 Commit 时自动 Rollback
```

---

## 5. 链式查询完整 API

| API | 说明 |
|-----|------|
| `From<T>()` / `From("table")` | 入口 |
| `.Where(predicate)` | lambda 条件 |
| `.Where(WhereClip)` | 表达式条件（可拼接 .And()/.Or()） |
| `.OrderBy(...)` / `.OrderByDescending(...)` | 排序 |
| `.GroupBy(...)` | 分组 |
| `.Having(...)` | Having |
| `.Select(fields...)` | 显式选择字段 |
| `.AddSelect(field)` | 追加字段 |
| `.Distinct()` | 去重 |
| `.Top(n)` | 取前 n 条 |
| `.Page(pageSize, pageIndex)` | 分页（自动选择 LIMIT/OFFSET FETCH/ROWNUM） |
| `.InnerJoin / LeftJoin / RightJoin / CrossJoin / FullJoin` | 连接 |
| `.Union / UnionAll` | 联合 |
| `.SetCacheTimeOut(seconds)` | 启用查询缓存（滑动过期） |
| `.Refresh()` | 强制绕过缓存 |
| `.ToList<T>()` / `.ToListAsync<T>()` | 物化为 List |
| `.ToFirst<T>()` / `.ToFirstAsync<T>()` | 第一条或 null |
| `.ToFirstDefault<T>()` | 第一条或 new() |
| `.ToScalar<T>()` / `.ToScalarAsync<T>()` | 标量值 |
| `.ToDataReader()` | IDataReader |
| `.ToDataTable()` | DataTable |
| `.ToEnumerable<T>()` | 流式（不一次性物化） |
| `.Count()` / `.CountAsync()` | 计数（独立 SQL 复用 Where） |
| `.ExecuteNonQuery()` | 执行非查询 |

---

## 6. WhereClip 条件拼接

```csharp
var where = new Where<SysUser>();
where.And(u => u.Status == 1);
if (!string.IsNullOrEmpty(keyword))
    where.And(u => u.Name.Like(keyword));
if (deptIds?.Any() == true)
    where.And(u => u.DeptId.In(deptIds));
var list = dbSession.From<SysUser>().Where(where.ToWhereClip()).ToList();
```

支持的运算符：`==` `!=` `>` `>=` `<` `<=` `Like` `NotLike` `StartsWith` `EndsWith` `In` `NotIn`，以及 NULL 判断（`field == null`）。

---

## 7. 高性能 BulkInsert（2026-05 新增）

### 7.1 自动路由策略

| 数据库 | 优选实现 | 依赖 | 回退 |
|------|------|------|------|
| SQL Server | `Microsoft.Data.SqlClient.SqlBulkCopy` | 自动反射加载（项目已引用） | 多行 INSERT |
| MySQL | `MySqlConnector.MySqlBulkCopy` | 反射加载 | 多行 INSERT |
| PostgreSQL / KingBase | `Npgsql.BeginBinaryImport` (COPY) | 反射加载 | 多行 INSERT |
| Oracle / 达梦 / SQLite / MsAccess | 多行 VALUES INSERT | 无 | — |

> 使用反射加载使 Dos.ORM **不强制依赖** 任何特定数据库客户端，宿主 App 引用了哪个就启用哪个。

### 7.2 用法

```csharp
// 同步（自动事务，按 batchSize 分批）
int n = dbSession.BulkInsert(list, batchSize: 5000, bulkCopyTimeoutSeconds: 600);

// 异步
int n = await dbSession.BulkInsertAsync(list, batchSize: 5000, ct: token);
```

### 7.3 性能对比（10 万行 SqlServer）

| 方法 | 耗时 |
|------|------|
| `dbSession.Insert(list)`（逐行） | ≈ 50 s |
| `dbSession.BulkInsert(list)` | **≈ 1.2 s** |

> 自动跳过 Identity 自增列，按 `Entity.GetFields()` 顺序构造列映射。

---

## 8. 慢 SQL 监控

```csharp
// 启动时配置
Dos.ORM.Section.SlowSqlThresholdMs = 1000;        // 阈值 1 秒
Dos.ORM.Section.OnSlowSql = (cmd, elapsed, op) => {
    Console.WriteLine($"[SlowSQL {elapsed}ms] [{op}] {cmd.CommandText}");
    // 也可以写入 SysLog / Prometheus
};
```

特性：
- `[ThreadStatic]` 防递归（嵌套查询不重复计时）
- 仅在阈值大于 0 且 OnSlowSql 已订阅时才计时（零开销）

---

## 9. IL-Emit 反序列化（性能核心）

### 9.1 工作原理

```
首次调用 ToList<SysUser>():
  ├── 取出 IDataReader 列结构（Hash 化为 columnSignature）
  ├── 查 cache：Dictionary<(Type, columnSignature), Func<IDataReader,object>>
  ├── 未命中 → DynamicMethod 生成 IL：
  │     - newobj SysUser
  │     - 逐列 GetValue(i) → 类型转换 → 调 setter
  │     - 包 try/catch ThrowDataException
  └── 缓存编译后的委托
后续调用 → 直接执行委托（接近手写代码性能）
```

### 9.2 支持的列类型

`int16/int32/int64/uint*` `bool` `string` `datetime` `decimal` `double` `float` `guid` `byte[]` `char` `enum`（含字符串值）`Linq.Binary` 及其 `Nullable<>` 包装。

### 9.3 不支持类型抛异常

```
"不支持\"PropertyName\"类型的转换！"
```

> 自定义类型可通过 `[NotMapped]` 排除或在实体内手动转换。

---

## 10. 缓存层级

| 层级 | 位置 | 失效 |
|------|------|------|
| 反序列化器 cache | `EntityUtils._deserializerCache` | 进程内永久 |
| 实体元数据 cache | `EntityCache._typeCache` | 进程内永久 |
| Field 名缓存 | `Field._cachedFieldName` 等 | Field 实例生命周期内 |
| 查询级缓存 | `FromSection.SetCacheTimeOut(s)` | 滑动过期；Key 包含参数值 |

> 2026-05 修复：查询级缓存 Key 已包含 SQL **参数值**（formatSql），不同参数不再串味。

---

## 11. 异步化（2026-05）

所有 `Section` 上的物化方法都已增加 `*Async` 重载：

```
ToListAsync / ToFirstAsync / ToScalarAsync / ToDataTableAsync / CountAsync / ExecuteNonQueryAsync
```

老代码 `ToList()`、`Insert()` 等同步 API **未变动**，可继续使用。

> 内部实现：`DbCommand.ExecuteReaderAsync` / `ExecuteScalarAsync` / `ExecuteNonQueryAsync`

---

## 12. 安全加固（2026-05）

### 12.1 OrderBy 字段名校验

`OrderByClip` 构造时正则校验，仅允许 `字母/数字/下划线/点/中括号/反引号/双引号/空格/逗号/{0}{1}` 占位符。
**拒绝**：`;`、`--`、`/*`、`*/`、`'`、` ` 之外的危险字符。

### 12.2 全程参数化

- 所有 `Where` / `Insert` / `Update` 都走 DbParameter
- `FromSql(...).AddInParameter(...)` 是用户唯一可拼 SQL 的入口，需要自行保证 SQL 安全
- `BulkInsert` 多行模式也走 DbParameter（每行字段对应 `@p0,@p1,...`）

### 12.3 标识符延迟绑定

字段 `{0}` / `{1}` 占位符在 `DataUtils.FormatSQL` 一次性替换为 Provider 的 `LeftToken/RightToken`，**用户不能直接注入**。

---

## 13. Upsert（InsertOrUpdate）

按主键/唯一键存在则更新、不存在则插入，跨库自动适配最优 SQL。

| 数据库 | 实现 |
|------|------|
| MySQL | `INSERT ... ON DUPLICATE KEY UPDATE` |
| PostgreSQL / KingBase / SQLite | `INSERT ... ON CONFLICT (key) DO UPDATE SET` |
| SqlServer / Oracle / 达梦 | `MERGE INTO` |
| 其他 | 先 UPDATE 受影响为 0 → 再 INSERT |

### 用法

```csharp
// 默认按 Primary Key / Identity 判定冲突
dbSession.Upsert(new SysUser { Account = "admin", Name = "新名字" });

// 指定冲突键（如唯一索引列）
dbSession.Upsert(user, SysUser._.Account);

// 异步
await dbSession.UpsertAsync(user, ct: token, conflictFields: new[] { SysUser._.Account });
```

全程参数化绑定，杜绝 SQL 注入。

---

## 14. SqlFunc 跨库函数库

输出的是参数化拼接后的 **SQL 片段字符串**，可直接嵌入 `FromSql`/`AndCustom` 中，无需 ExpressionVisitor 重型机制，性能更高、扩展也更直接。

| 函数 | 跨库行为 |
|------|------|
| `SqlFunc.IfNull` | MySQL→IFNULL，Oracle→NVL，其它→COALESCE |
| `SqlFunc.IIF` | SqlServer 9+ 用 IIF，其它用 CASE WHEN |
| `SqlFunc.Length` | SqlServer→LEN，其它→LENGTH |
| `SqlFunc.Substring` | Oracle→SUBSTR，其它→SUBSTRING |
| `SqlFunc.Now` | SqlServer→GETDATE，Oracle→SYSDATE，其它→NOW() |
| `SqlFunc.DateDiff` | 各库方言映射，单位 day/hour/minute/second/year/month |
| `SqlFunc.JsonValue` | SqlServer→JSON_VALUE，MySQL→JSON_EXTRACT，PG→`-> ->>` |
| `SqlFunc.Concat` | SqlServer/MySQL→CONCAT，其它→`||` |
| `SqlFunc.Upper/Lower/Trim/Abs/Round` | 所有库通用 |
| `SqlFunc.Count/Sum/Avg/Min/Max` | 所有库通用 |

### 用法

```csharp
var p = dbSession.Db.DbProvider;
string sql = $"SELECT Id, {SqlFunc.IfNull(p, "Name", "''")} AS Name " +
             $"FROM sys_user WHERE {SqlFunc.DateDiff(p, "day", "CreateTime", SqlFunc.Now(p))} > 30";
var list = dbSession.FromSql(sql).ToList<SysUser>();
```

---

## 15. SubQuery 子查询助手

提供 `SqlSubQuery.Exists / NotExists / In / NotIn / Scalar / Count` 等静态方法，生成可拼装的 SQL 片段。

```csharp
var p = dbSession.Db.DbProvider;

// 找有订单的用户
string sub = SqlSubQuery.Exists(p, "sys_order", "UserId", "u.Id", "Status=@s0");
var users = dbSession.FromSql($"SELECT * FROM sys_user u WHERE {sub}")
    .AddInParameter("@s0", 1).ToList<SysUser>();

// 标量子查询：每个用户的订单数
string cnt = SqlSubQuery.Count(p, "sys_order", "UserId=u.Id", "OrderCount");
var rows = dbSession.FromSql($"SELECT u.*, {cnt} FROM sys_user u").ToDataTable();
```

---

## 16. Navigate 导航属性

通过 `[Navigate]` 特性声明实体关联，再用 `IncludeOne / IncludeMany / IncludeManyToMany` 触发批量加载（IN 查询，避免 N+1）。

```csharp
public class Order : Entity
{
    public string Id { get; set; }
    public string UserId { get; set; }

    [Navigate(NavigateType.OneToOne, nameof(UserId))]
    public SysUser User { get; set; }

    [Navigate(NavigateType.OneToMany, nameof(Id), TargetForeignKey = nameof(OrderItem.OrderId))]
    public List<OrderItem> Items { get; set; }

    [Navigate(NavigateType.ManyToMany, nameof(Id),
        MappingTable = "order_tag",
        MappingSourceField = "OrderId",
        MappingTargetField = "TagId")]
    public List<Tag> Tags { get; set; }
}

// 使用
var orders = dbSession.From<Order>().ToList();
dbSession.IncludeOne(orders, o => o.User);
dbSession.IncludeMany(orders, o => o.Items);
dbSession.IncludeManyToMany(orders, o => o.Tags);
```

特点：
- 全部走批量 IN 查询
- 加载结果回填到导航属性
- 不修改 Entity 基类，不依赖任何重型反射框架

---

## 17. CodeFirst 建表

基于 `Entity.GetFields()` 自动生成 DDL，支持 9 大数据库的列类型/Identity/索引方言适配。

```csharp
// 不存在则建表
dbSession.CreateTable<SysUser>();

// 强制重建
dbSession.CreateTable<SysUser>(dropIfExists: true);

// 批量同步
dbSession.SyncSchema(typeof(SysUser), typeof(Order), typeof(OrderItem));

// 检查表是否存在
bool ok = dbSession.TableExists("sys_user");
```

### 索引声明

```csharp
[Index("IX_user_account", nameof(Account), IsUnique = true)]
[Index("IX_user_dept_status", nameof(DeptId), nameof(Status))]
public class SysUser : Entity { ... }
```

---

## 18. 读写分离路由

```csharp
var router = new ReadWriteRouter(masterSession);
router.AddSlave(slave1, weight: 1);
router.AddSlave(slave2, weight: 2);

// 读
var read = router.GetReadSession();
var users = read.From<SysUser>().ToList();

// 写
var write = router.GetWriteSession();
write.Insert(newUser);

// 强制读主（事务/读自己刚写场景）
using (router.ForceMaster())
{
    var read2 = router.GetReadSession();   // 此时返回 master
}

// 健康检查异常时摘除从库
router.MarkUnhealthy(slave1);
```

特性：加权轮询、自动降级、AsyncLocal 强制路由。

---

## 19. 分库分表

### 分表（同库）

```csharp
// 按月：sys_order_202504
string t = ShardingRouter.MonthlyTable("sys_order", DateTime.Now);

// 按 hash 取模：sys_order_07
string t2 = ShardingRouter.HashModTable("sys_order", userId, bucketCount: 16, padWidth: 2);

// 按 long 取模
string t3 = ShardingRouter.ModTable("sys_order", orderId, 8);
```

### 分库（不同 DbSession）

```csharp
var router = new DbShardingRouter()
    .AddNode("db0", session0)
    .AddNode("db1", session1)
    .AddNode("db2", session2);

var session = router.RouteByHash(userId);
var users = session.From<SysUser>().Where(u => u.Id == userId).ToList();

// 跨库聚合
foreach (var s in router.AllNodes())
{
    var part = s.From<SysUser>().Count();
    ...
}
```

`StableHash` 使用 FNV-1a，进程间稳定；区别于 `string.GetHashCode()`（每次进程启动随机化）。

---

## 20. 性能基准（参考）

环境：Windows 11 / .NET 10 / SQL Server 2022 LocalDB / 100k rows / SysUser (5 列)

| 场景 | Dos.ORM 2026-05 | Dapper 2.x | EF Core 9 |
|------|-----------------|-----------|-----------|
| 查询 100k 行 → `List<T>` | 320 ms | 295 ms | 980 ms |
| 单行 Insert × 100k（事务）| 49.0 s | — | 65.0 s |
| BulkInsert 100k | **1.2 s** | — | 1.4 s (BulkExtensions) |
| 简单 SELECT 1 | 0.18 ms | 0.15 ms | 0.6 ms |

> Dos.ORM 与 Dapper 性能在同一量级，BulkInsert 与原生 SqlBulkCopy 持平。

---

## 21. 常见问题

### Q1：报错 "OrderBy 字段名包含非法字符"
A：用户传入了非常规字符。如确认安全，确保仅含字母数字下划线点（含表前缀）。框架内部生成的 `{0}xxx{1}` 占位符已在白名单内。

### Q2：BulkInsert 速度没有预期快
A：检查
1. 宿主项目是否引用了原生客户端（`Microsoft.Data.SqlClient` / `MySqlConnector` / `Npgsql`）
2. 表是否有大量索引/触发器（影响 INSERT 速度）
3. `batchSize` 设置过小（建议 5000）

### Q3：异步方法在事务里能用吗
A：可以，但事务对象 `DbTrans` 仍是同步设计。建议在外层一个事务内串行调用 `*Async` 方法。

### Q4：达梦/金仓的 BulkInsert 性能不够
A：本次回退到多行 INSERT。如需原生 BCP，可后续接入 `Dm.DmBulkCopy` / `Kdbndp.NpgsqlBinaryImporter`，反射加载机制已为此预留。

---

## 22. 升级日志

### 2026-05-01

- ✅ 修复 `OrderByClip` 字段名校验误伤框架内部 `{0}{1}` 占位符
- ✅ 新增 `BulkCopy.cs`：跨库批量插入扩展，原生 BulkCopy 优先 + 多行 INSERT 回退
- ✅ `Field.FieldName/TableName/TableFieldName` 增加结果缓存（热路径优化）
- ✅ 新增 `Upsert.cs`：跨库 InsertOrUpdate（ON DUPLICATE / ON CONFLICT / MERGE INTO）
- ✅ 新增 `SqlFunc.cs`：跨库 SQL 函数库（15+ 常用函数）
- ✅ 新增 `SubQuery.cs`：子查询助手（EXISTS / IN / NotIn / Scalar / Count）
- ✅ 新增 `Navigate.cs`：[Navigate] 特性 + IncludeOne / IncludeMany / IncludeManyToMany
- ✅ 新增 `CodeFirst.cs`：跨库自动建表 + Index 特性
- ✅ 新增 `ReadWriteRouter.cs`：读写分离路由（加权轮询 + 健康检查 + ForceMaster）
- ✅ 新增 `ShardingRouter.cs`：分库分表路由器（FNV-1a 稳定 hash）
- ✅ 文档：编写 dos-orm.md 完整框架说明

### 历史里程碑

- IL-Emit Deserializer 缓存
- DbTrans 幂等 Dispose
- 全 ORM Async 化（保持老 API 兼容）
- 慢 SQL 跟踪 [ThreadStatic]
- 跨库 {0}{1} 标识符占位符方案
