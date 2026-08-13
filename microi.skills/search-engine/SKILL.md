---
name: search-engine
description: Microi 搜索引擎索引、同步、查询与安全规范。用于 Elasticsearch 表索引、增量同步、字段映射、SearchAfter 分页、租户与菜单数据范围、重建和多节点验收。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi SearchEngine

## 能力与事实源

搜索引擎提供建索引/全量同步、单文档新增修改删除、字段映射、查询和 `SearchAfter` 深分页。数据库仍是业务事实源，搜索索引是可重建的读模型，不能直接作为权限、余额、库存或审批状态事实。

## 租户隔离

- 索引名必须包含规范化 `OsClient` 和表标识，禁止不同租户共用无过滤索引。
- V8/HTTP 调用的 `OsClient` 必须由 Token/服务端上下文确定，不能信任 Query/Body。
- 搜索服务连接、用户名和密码只从服务端 SaaS 配置读取，不进入前端 `SysConfig`、V8 返回或日志。

## 索引流程

1. 读取 `diy_table/diy_field` 确定可搜索字段、类型和分词需求。
2. 先扩展索引映射，再开始双写/增量同步。
3. 全量回填使用稳定游标或主键分页，记录 checkpoint。
4. 对账数据库数量、抽样字段和删除记录。
5. 切换读流量后保留旧索引回滚窗口。

可用的服务端方法包括 `AsyncIndex`、`AsyncTableDataToIndex`、`AddDocument`、`UpdateDocument`、`DeleteDocument`、`AddField`、`GetSearchResponse`。

## 查询安全

- 用户关键词作为值参数，不允许决定索引名、任意字段、脚本或原始 DSL。
- 排序字段从白名单映射；限制 `PageSize`、高亮长度和聚合桶数量。
- 普通用户的菜单 `SqlWhere`/行级范围不会天然出现在 Elasticsearch 查询中。必须将服务端计算出的允许记录范围同步为可过滤字段，或先取得授权 Id 集合再查询；不能搜索后再在前端过滤。
- 敏感字段不入索引，或使用独立受控索引；日志只记录 trace id、耗时和计数。

## 同步可靠性

数据库写成功、索引写失败时使用 outbox 事件，`EventId` 全局唯一。消费端按事件 Id 幂等；删除使用 tombstone。索引更新失败不能回滚已经提交的业务事务，应告警并重试。

全量重建和增量消费可能在多个节点同时运行，需分布式租约与 checkpoint 条件更新；本机静态标志不能作为“正在重建”的事实。

## 查询示例

```csharp
var result = await search.GetSearchResponse(new MicroiSearchEngineParam
{
    OsClient = osClient,
    TableName = "Diy_Product",
    Keyword = keyword,
    PageSize = Math.Min(pageSize, 100),
    Sorts = new List<MicroiSearchEngineSortModel>
    {
        new MicroiSearchEngineSortModel { Field = "UpdateTime", Order = "desc" }
    }
});
```

字段名与排序必须在进入此对象前经过服务端白名单。

## MCP/交付流程

- 先用 `microi_get_db_schema` 和菜单元数据确认字段与权限。
- 搜索配置写入后回读实际索引名、字段映射和租户连接。
- 用管理员、普通有权限用户、无权限用户和另一个租户验收。
- 覆盖全量重建中断、重复事件、删除、滚动升级、搜索服务短暂故障。

## 验收清单

- [ ] 索引按租户隔离，跨租户搜索为零
- [ ] 菜单/行级范围在查询前生效
- [ ] 字段、排序、分页、聚合均有白名单和上限
- [ ] 数据库与索引可对账、可重建
- [ ] outbox 重试幂等，无永久漏同步
- [ ] 密钥和敏感字段不进入前端/日志/索引
