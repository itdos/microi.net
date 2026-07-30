# 🗄️ 扩展数据库与外部数据迁移

> 吾码通过 Dos.ORM 统一访问扩展数据库。数据库连接既可以保存到“数据库管理”，也可以只在当前接口引擎请求中临时使用。

## 支持范围

当前平台认证的数据库类型如下。类型 Key 大小写不敏感，保存时会归一化为表中的标准值。

| DbType | 数据库 | 默认端口 | 连接字符串示例 |
|---|---|---:|---|
| `MySql` | MySQL | 3306 | `Server=127.0.0.1;Port=3306;Database=app;Uid=user;Pwd=***;` |
| `SqlServer` | SQL Server | 1433 | `Server=127.0.0.1,1433;Database=app;User Id=user;Password=***;TrustServerCertificate=True;` |
| `Oracle` | Oracle | 1521 | `User Id=user;Password=***;Data Source=127.0.0.1:1521/ORCL;` |
| `PostgreSql` | PostgreSQL | 5432 | `Host=127.0.0.1;Port=5432;Database=app;Username=user;Password=***;` |
| `DaMeng` | 达梦 DM8 | 5236 | `Server=127.0.0.1;Port=5236;User Id=user;Password=***;` |
| `KingBase` | 人大金仓 KingbaseES V9 | 54321 | `Host=127.0.0.1;Port=54321;Database=app;Username=user;Password=***;` |

这里的“支持”表示 Dos.ORM 已包含对应驱动、SQL 方言和结构读取实现。正式接入仍需用目标数据库的真实版本、网络、字符集和最小权限账号进行连接、查询与写入验收。

## 保存连接：数据库管理

在“数据库管理”中维护 `microi_database`：

- `DbKey`：租户内唯一的访问 Key，例如 `ErpOracle`；只能使用字母、数字和下划线，不能以数字开头。
- `DbType`：上表中的标准类型。
- `DbConn`：写连接；字段使用 `mediumtext`，可保存较长的 Oracle 描述符等连接串。
- `DbReadConn`：可选的只读连接；未填写时使用 `DbConn`。
- `IsEnable`：只有启用的连接会加载到 V8。

`Open`、`Count`、`Keys`、`Values`、`Comparer`、`Add`、`Remove`、`Clear`、`ContainsKey`、`TryGetValue` 是 `V8.Dbs` 保留名称，不能作为 DbKey。

保存后通过 DbKey 访问：

```js
var rows = V8.Dbs.ErpOracle
  .FromSql('SELECT ID, NAME FROM CUSTOMER WHERE STATUS = @p0')
  .AddInParameter('@p0', 1)
  .ToArray();
```

扩展库事务与主库事务完全独立，必须显式提交、回滚并关闭：

```js
var exTrans = V8.Dbs.ErpOracle.BeginTransaction();
try {
  exTrans.FromSql('UPDATE CUSTOMER SET STATUS = @p0 WHERE ID = @p1')
    .AddInParameter('@p0', 1)
    .AddInParameter('@p1', V8.Param.Id)
    .ExecuteNonQuery();
  exTrans.Commit();
} catch (error) {
  exTrans.Rollback();
  throw error;
} finally {
  exTrans.Close();
}
```

“数据库扩展”应用包为 `microi_database` 配置后端提交后 V8 事件。新增、修改、启用、停用或删除连接提交成功后，事件调用 `V8.Method.RefreshExtensionDatabases()`；该方法在数据库事务真正提交后递增当前租户的共享 Redis 版本，所有 API 节点在下一次访问 `V8.Dbs` 时立即重载，事务回滚则不会发布错误版本。默认 60 秒 TTL 只作为旧节点或异常情况下的兜底；需要调整时修改 SaaS 引擎主租户的 `ExtensionDatabaseCacheSeconds`，不再要求重启 API。

`DbType` 选项、`DbKey`、长连接串控件和不同数据库的连接串填写提示属于“数据库扩展”应用的表单设计。请在应用商城安装或更新该应用；平台启动升级程序不会修改这些非启动关键元数据。

## 临时直连：V8.Dbs.Open

不希望保存到 `microi_database` 时，可以在可信的后端接口引擎中创建仅当前请求使用的会话：

```js
var db = V8.Dbs.Open(
  'SqlServer',
  'Server=127.0.0.1,1433;Database=app;User Id=user;Password=***;TrustServerCertificate=True;'
);

var rows = db.FromSql('SELECT Id, Name FROM Customer WHERE Status = @p0')
  .AddInParameter('@p0', 1)
  .ToArray();
```

临时直连支持与保存连接相同的六类数据库。连接串必须来自服务端密钥配置或仅管理员可编辑的接口引擎代码，禁止直接使用 `V8.Param.ConnectionString`，也禁止写入日志、接口返回、前端代码或审计详情。

## 通过 MCP 用自然语言接入数据库

安装“Microi吾码 VS Code 插件”并初始化 MCP 后，AI 可以编排以下工具：

| MCP Tool | 用途 |
|---|---|
| `microi_list_database_types` | 返回支持类型、别名、默认端口和脱敏示例 |
| `microi_inspect_external_database` | 临时连接或按 DbKey 读取表、字段、类型、是否为空、默认值、主键和说明 |
| `microi_query_external_database` | 执行有超时和行数上限的单条只读 `SELECT/WITH` |
| `microi_execute_external_database` | 超级管理员执行任意 SQL，包括 DML、DDL、存储过程、数据库原生命令和多语句；需要显式确认 |
| `microi_save_database_connection` | 测试连接后新增、更新或恢复 `microi_database` 记录，需要显式确认 |
| `microi_import_external_attachment` | 从 HTTP/HTTPS、本机绝对路径或 UNC 路径流式迁移附件，需要显式确认 |

例如可以描述：“连接这个 SQL Server，列出所有客户和订单表以及字段说明；不要保存连接。确认结构后，在吾码创建对应表并同步前 100 条测试数据。”AI 应先读取结构，再生成写入计划；只有获得写入确认后，才调用标准建模、表单写入或接口引擎工具。

`microi_get_db_schema` 仍只读取当前吾码租户自身的低代码表结构；读取第三方数据库必须使用 `microi_inspect_external_database`，两者不能混用。

大批量或持续同步不应把所有行经 MCP 对话搬运。应让 AI 创建接口引擎、Job 或 MQ 消费者，在服务端使用稳定业务键、唯一约束和 upsert 实现幂等；多节点任务还必须使用带租约的分布式锁，但锁不能代替业务幂等。

## 第三方附件迁移

推荐流程：

1. 用 `microi_query_external_database` 或 `V8.Dbs.<DbKey>` 参数化查询附件记录及路径。
2. 根据实际存储方式提供 HTTP/HTTPS URL、API 节点可访问的本机绝对路径或 UNC 路径。
3. 对每个文件调用 `microi_import_external_attachment`，指定目标表、记录和附件字段。
4. 回读目标记录，确认保存的是吾码租户内文件路径，而不是第三方临时签名 URL。
5. 批量任务使用第三方附件 Id 作为幂等键，记录成功、失败和重试状态。

该 MCP 控制面入口不设置固定文件大小上限，`MaxBytes` 省略或传 `0` 表示不设置本工具上限，因此可处理 200 MB、500 MB 或更大的文件。HTTP 下载先流式写入临时文件，再以文件流上传对象存储，不经过 Base64；最终仍受磁盘空间、请求超时、网络、对象存储和服务账号文件权限约束。需要主动限制一次任务时可传 `MaxBytes`。源 URL（包括用户凭据、签名参数和鉴权 Header）或本机/UNC 路径不会写入工具结果与审计详情。

可信后端 V8 也可以先通过 `V8.Http.GetResponse` 获取 `RawBytes`，再转为 Base64 调用 `V8.Method.Upload`；这种方式会占用更多内存并继续受普通业务上传配额约束，大文件优先使用 MCP 流式迁移入口。

## 安全与验收

- 外部数据库、连接管理和附件迁移 MCP 接口均在 Controller 重新读取当前 Token，并硬校验 `Level >= 9999`；前端角色名、菜单显示和请求参数不能代替该校验。
- `microi_query_external_database` 保留为默认安全只读工具；`microi_execute_external_database` 不限制 SQL 类型，支持数据库账号能够执行的任意 DML、DDL、存储过程、文件能力和多语句。`Mode` 显式选择 `Query`、`Scalar` 或 `NonQuery`，输出行数上限只是 MCP 传输保护，不限制数据库操作权限。
- 全权限 SQL、保存连接和附件迁移都需要显式确认并写脱敏审计；审计只记录 SQL/来源 SHA-256、类型、长度和结果，不记录 SQL 正文、连接串、密码、URL 查询串、Header 或文件路径。
- 所有动态值使用 `AddInParameter`，表名、列名和排序字段只能来自已读取并校验的元数据白名单。
- “最高权限”不绕过目标数据库和操作系统自身的授权：数据库账号必须拥有相应权限，本机/UNC 文件必须对 API 服务进程账号可读。
- `microi_database` 是敏感控制面表，禁止普通角色查询、导入、导出或通过前端 FormEngine 修改。
- 上线至少分别验证：真实数据库连通、全量结构读取、只读与全权限 SQL、目标表写入、读连接、连接提交后的双节点即时重载、事务回滚不刷新、重复同步幂等、200/500 MB 流式附件、本机/UNC 权限和目标记录回读。
