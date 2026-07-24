# 🔍 搜索引擎

> Microi.SearchEngine 提供 Elasticsearch 索引、同步、单文档增删改、字段映射、查询和 SearchAfter 深分页。

---

## 基本原则

数据库是业务事实源，搜索索引是可重建的只读模型。权限、余额、库存、审批状态和任务是否完成不能以 Elasticsearch 为唯一事实。

可用服务端能力包括：

- `AsyncIndex` / `AsyncTableDataToIndex`：创建与全量同步；
- `AddDocument` / `UpdateDocument` / `DeleteDocument`：增量同步；
- `AddField`：扩展字段映射；
- `GetSearchResponse` / `SearchBySearchAfter`：查询与深分页。

## 租户隔离

索引名必须包含规范化 `OsClient` 与表标识。调用使用 Token/V8 服务端上下文确定的租户，不相信 Query/Body 中的 `OsClient`。Elasticsearch 地址与密码只保存在服务端 SaaS 配置，不进入前端、V8 响应或日志。

## 索引生命周期

1. 从 `diy_table/diy_field` 确定字段、类型与分词。
2. 先扩展映射，再开启双写/增量事件。
3. 用稳定主键游标全量回填并保存 checkpoint。
4. 对账数量、抽样字段和删除记录。
5. 切换读流量，保留旧索引回滚窗口。

数据库提交成功而索引失败时，使用 outbox 事件重试；`EventId` 全局唯一，消费者幂等，删除使用 tombstone。

## 查询安全

- 关键词只作为值；索引、字段、排序、脚本和聚合维度来自服务端白名单。
- 限制 `PageSize`、高亮长度、聚合桶数、超时和最大深分页。
- 普通用户的菜单 `SqlWhere` 不会自动转换为 Elasticsearch 权限。必须把可过滤的数据范围安全映射到索引查询，或先从服务端取得允许 Id；不能搜索后再由前端过滤。
- 敏感字段不入索引，日志不记录完整查询正文和结果。

## 多节点重建

全量重建和增量消费使用分布式租约、幂等事件和共享 checkpoint；`static` 状态只能做本节点优化。新旧索引遵循“先建新索引、回填、对账、切换、最后清理旧索引”。

完整规范见 `microi.skills/search-engine/SKILL.md` 与[平台安全与兼容基线](../more/security)。
