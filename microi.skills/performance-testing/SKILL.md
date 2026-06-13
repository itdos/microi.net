---
name: performance-testing
description: Microi 高并发、性能压力测试规范。用于对 ApiEngine、V8 事件、FormEngine CRUD、VS Code 插件性能页、压力/尖峰/长稳测试、报告、并发、吞吐、延迟分位和瓶颈诊断做压测。
---

# Microi 高并发性能压力测试

本 Skill 用于设计、实现和执行 Microi 吾码性能测试，覆盖接口引擎、V8 事件、FormEngine 表 CRUD、前端工作流与 VS Code 插件性能测试页。

## 总原则

1. **真实链路优先**：接口引擎压测默认走真实 HTTP `/apiengine/{ApiEngineKey}`，不要用调试执行接口替代线上链路。
2. **事件隔离与真实触发分开**：单独测 V8 事件代码可用 `ExecuteV8Event`；要验证表单事件真实成本，必须通过 FormEngine Add/Upt/Del 触发服务端事件。
3. **读写分级**：先跑只读基线，再跑写入压力；写入压测必须使用测试表、测试租户或自动清理策略。
4. **渐进升压**：不要一上来极限并发。标准顺序是 smoke -> baseline -> load -> stress -> spike -> soak。
5. **报告必须可读**：报告至少包含并发数、总请求、成功/失败、RPS、平均耗时、P50/P90/P95/P99、错误 Top、每秒趋势和测试参数。
6. **通用坑必须回写 Skill**：修复过程中发现可复用的平台、插件、MCP、前端、V8、FormEngine 坑时，不要只写到本地 memory；必须更新对应 `microi.skills/*/SKILL.md`，必要时新增 Skill，让 VS Code 插件打包后其他用户也能受益。

## 测试类型

| 类型 | 目的 | 建议配置 |
| --- | --- | --- |
| Smoke | 确认目标可用 | 并发 1-2，总请求 3-10 |
| Baseline | 单机基线 | 并发 1，总请求 50-200 |
| Load | 常规高并发 | 目标业务并发，持续 3-10 分钟 |
| Stress | 找瓶颈 | 阶梯增加并发直到错误率或 P95 不可接受 |
| Spike | 突增流量 | 短时间从低并发升到高并发，再回落 |
| Soak | 长稳态 | 30 分钟到数小时，重点看内存、连接池、缓存和慢查询 |

## 接口引擎压测

默认使用真实入口：

```text
POST /apiengine/{ApiEngineKey}
Body: { "OsClient": "xxx", ...业务参数 }
Header: Authorization / Token 复用当前登录态
```

规则：

- 除非明确在调试 V8 代码，否则不要用 `/api/V8Debug/ExecuteApiEngine` 作为性能结论。
- 测试参数要覆盖真实业务分支，包括分页、关键过滤条件、权限上下文、缓存命中/未命中场景。
- 返回必须按 DosResult 判断业务成功：`Code === 1` 才算成功；HTTP 200 但 `Code !== 1` 要计入失败。
- 报告中隐藏 token、密码、API Key 等敏感参数。

## V8 事件压测

两种模式要区分清楚：

1. **隔离执行**：使用 `/api/V8Debug/ExecuteV8Event`，传 `EventType`、`V8Code`、`Form`，用于判断单段 V8 代码在当前服务器上的解释执行成本。
2. **真实触发**：通过 `/api/formengine/AddFormData`、`/api/formengine/UptFormData`、`/api/formengine/DelFormData` 触发 `SubmitBeforeServerV8`、`SubmitAfterServerV8`、`DataFilterV8`，用于判断真实表单保存/查询成本。

常见结论不能混用：隔离执行快，不代表真实保存快；真实保存慢也可能是 SQL、索引、事件、外部 HTTP、缓存或权限链路导致。

## FormEngine CRUD 压测

推荐标准 Controller 路由：

```text
POST /api/formengine/GetFormData
POST /api/formengine/GetTableData
POST /api/formengine/AddFormData
POST /api/formengine/UptFormData
POST /api/formengine/DelFormData
```

请求体必须包含：

```json
{ "OsClient": "xxx", "FormEngineKey": "表名", "Id": "测试行Id", "Name": "测试数据" }
```

安全规则：

- CRUD 压测默认创建带 `perf_` 前缀的测试 Id，结束后删除本次创建的数据。
- 不要对生产业务表直接跑删除压力，除非用户明确确认并指定可清理条件。
- Add/Upt payload 必须由用户或测试清单明确给出，避免写不存在字段导致大量业务失败。
- 查询压测要区分 `GetFormData` 单行查询和 `GetTableData` 列表查询；列表查询必须带分页。

## VS Code 插件性能测试页实现规范

插件配置页的“性能测试”功能应遵守：

- Webview 只负责收参、进度和报告展示；请求由扩展宿主执行，复用 `ApiClient` 登录态，避免 CORS 和 token 泄露。
- 支持三类目标：接口引擎、V8 事件、表 CRUD。
- 支持手动 JSON 参数、并发数、总迭代次数、持续时间、渐进升压、单请求超时。
- 支持停止测试：停止发起新请求，等待已发出的请求返回后生成部分报告。
- 支持保存 HTML 报告到 `.microi-performance/`，并可从 VS Code 打开。
- 报告至少展示：完成、成功、失败、RPS、平均耗时、P95/P99、错误率、延迟分布、每秒趋势、错误 Top。

## 结果判定

性能测试不是只看 RPS。结论必须同时看：

- 错误率是否为 0 或低于目标阈值。
- P95/P99 是否满足业务 SLA。
- 是否出现连接超时、身份过期、数据库死锁、缓存穿透、外部接口超时。
- 写入场景是否确实触发了 V8 事件并完成清理。
- 长时间测试后内存、线程、连接池、Redis、数据库连接是否稳定。

## 复盘写回规则

每次压测暴露通用问题后，把经验写回最贴近的 Skill：

- FormEngine 路由/CRUD 坑 -> `v8-formengine-http/SKILL.md` 或本 Skill。
- V8 代码性能/缓存/SQL -> `v8-sql-query`、`v8-cache-pattern`、`v8-debugging`。
- 前端弹层、主题、表格搜索等 UI 运行时坑 -> `microi-client-frontend/SKILL.md`。
- 插件/MCP 能力缺口 -> 本 Skill、`playwright-e2e` 或 `microi-system-delivery`。

本地 memory 只能作为临时笔记；对用户和其他安装插件的人有价值的规则，必须进入 `microi.skills`。
