---
name: dos-orm
description: Dos.ORM C# 数据访问指南。用于 Microi.Server 中编写或审查 DbSession、Entity、From、WhereClip、事务、异步查询、BulkInsert、Upsert、SqlFunc、子查询、导航属性、CodeFirst、读写分离和分库分表代码。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Dos.ORM

Dos.ORM 是 Microi.Server 底层 C# ORM。它不是接口引擎里的 `V8.Db`：

- C# 服务端源码使用 `DbSession`、实体和 Section API。
- V8 JavaScript 使用 `V8.FormEngine` 或 `V8.Db.FromSql`。
- 不能把 C# lambda/事务示例原样放进 V8。

完整 API、跨库行为与示例见 `references/api-reference.md`。

## 默认选择

| 需求 | 首选 |
|---|---|
| 普通实体查询 | `dbSession.From<T>().Where(...).ToList/ToListAsync` |
| 动态条件 | `Where<T>` / `WhereClip` |
| 复杂 SQL | `FromSql(...).AddInParameter(...)` |
| 单条/小批写入 | `Insert/Update/Delete` |
| 大于约 1000 行批量插入 | `BulkInsert/BulkInsertAsync`，先压测批大小 |
| 按唯一键写入 | `Upsert/UpsertAsync` + 真实唯一索引 |
| 多步原子写 | `BeginTransaction()`，`using` + Commit/Rollback |

## 安全规则

### 连接生命周期与在线恢复

- 创建事务、准备读取器、打开连接、提交/回滚及批处理任一路径抛异常，都必须释放本层拥有的连接；借用外部事务或批处理连接时不能擅自关闭。保留原始异常，不因 Dispose 失败遮盖原始错误。
- `DbTrans` 提交成功后先归还连接，再执行提交后通知。通知失败不能把已提交事务报告为回滚，也不能自动重放业务 SQL。调用者仍必须使用 `using`，防止业务异常绕过 Commit/Rollback。
- `DatabasePoolExhausted`、`DatabaseCapacityExceeded`、`DatabaseEndpointUnreachable` 是不同故障；不要把应用池等待、数据库全局连接限制和慢 SQL 混为一谈。
- 可信 C# 宿主通过 `Database.GetConnectionPoolSnapshot()` 读取脱敏状态，`ResetConnectionPool()` 只轮换准确匹配的 MySQL/SQL Server 池，`ProbeConnectionPoolAsync` 用原池执行固定 `SELECT 1`。不使用 `ClearAllPools`，不杀借出的事务，不重放 SQL。
- `BeginIsolatedConnections()` 仅用于有并发限制的可信应急鉴权作用域，设置无池连接与 5 秒连接/命令超时；未知驱动拒绝。不能给普通业务或 V8 增加绕过限流的开关，不能在此作用域内执行清池或把无池探测冒充原池恢复。
- AI 在线恢复使用 `microi_manage_system_observability(action=ResetDatabasePools)` 的预览、确认和回读协议，详细决策见 [系统日志/监控](../system-observability/SKILL.md)。需要升级含 `database-pools/v1` 的后端和 MCP；事故恢复本身不要求重启数据库/API。

- 数据值全程参数化；`FromSql` 的动态值用 `AddInParameter`。
- 表名、字段名、排序名不能来自未经白名单验证的用户输入。
- 保留 `{0}Name{1}` 标识符延迟绑定机制，不能改成字符串替换。
- `OrderByClip` 的校验不是授权；可排序字段仍需业务白名单。
- Upsert 幂等依赖数据库唯一键，不能只靠“先查再写”。
- 租户业务表查询/写入必须包含真实 `OsClient` 范围。
- 已明确需要的索引在 Microi 业务表上通过 Manifest/MCP 管理，不从临时 SQL 创建。
- MySQL 用户名或密码包含分号时必须用连接字符串引号包裹，例如
  `Password="a;b"`；平台统一兼容层只修复“无等号片段紧跟已明确凭据参数”的
  历史串，其它结构错误继续失败关闭，禁止猜测用户名、密码或默认 `root`。

## 事务与异步

```csharp
using (var trans = dbSession.BeginTransaction())
{
    try
    {
        trans.Insert(entity);
        trans.Update<User>(User._.Status, 1, User._.Id == entity.Id);
        trans.Commit();
    }
    catch
    {
        trans.Rollback();
        throw;
    }
}
```

Dispose 幂等，未 Commit 时自动回滚。事务内异步操作串行执行；不要在同一个连接/
事务上 `Task.WhenAll`。取消、超时和异常必须传播，不能吞掉后继续 Commit。

## 性能与跨库

- 显式选择字段，分页和流式读取，避免无界 `ToList()`。
- BulkInsert 会按可用客户端选择原生实现并回退多行 INSERT；不同数据库必须实测。
- 官网性能数字仅是特定环境参考，不能作为目标环境承诺。
- 查询缓存 Key 必须包含 SQL 参数值；业务写后考虑失效。
- 读写分离在“写后立刻读”和事务内强制读主。
- 分片使用稳定 Hash；不能使用进程随机化的 `string.GetHashCode()`。

## 验收

- Oracle 原生 `TO_CHAR(value, format[, nlsparam])` 必须保留参数顺序；Provider 不得用
  字符串扫描交换参数。单参数、嵌套函数、格式串中的逗号、注释与字面量也要原样保留。
- `ToArray/ToList` 是查询执行与读取边界，堆栈停在这里不能证明对象转换出错。
  遇到 `ORA-01722`，先用同一账号条件拆分计数/列表，核对最终命令文本与参数类型，
  再执行最小原生 SQL 对照；确定性的转换/语法错误不得用盲目重试或更改业务过滤掩盖。

- 至少在目标数据库 Provider 运行定向测试，不用 MySQL 结果宣称 Oracle/达梦通过。
- 覆盖 NULL、DateTime、decimal、Guid、enum、byte[] 和分页边界。
- 覆盖事务提交/回滚、唯一冲突、超时、取消和连接故障。
- BulkInsert/Upsert 核对受影响行、Identity 跳过、唯一键和重试副作用。
- 读写分离覆盖从库故障、写后读主和降级。
- CodeFirst/索引变更在隔离库验证，不直接对生产执行破坏性重建。
