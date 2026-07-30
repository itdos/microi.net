---
name: dos-orm
description: Dos.ORM C# 数据访问指南。用于 Microi.Server 中编写或审查 DbSession、Entity、From、WhereClip、事务、异步查询、BulkInsert、Upsert、SqlFunc、子查询、导航属性、CodeFirst、读写分离和分库分表代码。
---

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

- 数据值全程参数化；`FromSql` 的动态值用 `AddInParameter`。
- 表名、字段名、排序名不能来自未经白名单验证的用户输入。
- 保留 `{0}Name{1}` 标识符延迟绑定机制，不能改成字符串替换。
- `OrderByClip` 的校验不是授权；可排序字段仍需业务白名单。
- Upsert 幂等依赖数据库唯一键，不能只靠“先查再写”。
- 租户业务表查询/写入必须包含真实 `OsClient` 范围。
- 已明确需要的索引在 Microi 业务表上通过 Manifest/MCP 管理，不从临时 SQL 创建。

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

- 至少在目标数据库 Provider 运行定向测试，不用 MySQL 结果宣称 Oracle/达梦通过。
- 覆盖 NULL、DateTime、decimal、Guid、enum、byte[] 和分页边界。
- 覆盖事务提交/回滚、唯一冲突、超时、取消和连接故障。
- BulkInsert/Upsert 核对受影响行、Identity 跳过、唯一键和重试副作用。
- 读写分离覆盖从库故障、写后读主和降级。
- CodeFirst/索引变更在隔离库验证，不直接对生产执行破坏性重建。
