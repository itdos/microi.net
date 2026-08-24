---
name: system-observability
description: Microi 系统日志/监控查询、诊断与治理规范。用于通过界面、MCP 或接口引擎分析系统日志、Trace、热点接口、CPU/内存、网络流量归因、安全事件、IP 封禁、应用日志及可观测性性能边界。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 系统日志/监控

本 Skill 用于读取、解释、扩展和验收 Microi 的统一【系统日志/监控】能力。它不授权查看其它租户、绕过菜单/平台管理员权限，或把当前节点样本扩写成全局结论。

## 先选入口

| 目标 | 推荐入口 |
|---|---|
| 人工排查、看趋势、打开日志详情 | 平台菜单【系统日志/监控】 |
| AI 查询、自动诊断、验收 | MCP `microi_query_system_observability` |
| AI 封禁或解封 IP | MCP `microi_manage_system_observability` |
| 应用页面读取 | Managed 接口引擎 `mci-system-observability-query` |
| 应用页面治理 | Managed 接口引擎 `mci-system-observability-action` |
| 扩展宿主、进程、Mongo 或安全底层原子能力 | `V8.Method.GetSystemObservability` / `V8.Method.ManageSystemObservability` |

AI 第一次使用时先查询 `action=Capabilities`，再按返回的动作、权限和边界选择查询。不要用通用 `microi_run_engine` 代替专用工具；专用工具已经限制动作、参数、分页、确认和审计。

## 查询动作

`microi_query_system_observability` 支持：

| action | 用途 | 关键参数 |
|---|---|---|
| `Capabilities` | 能力目录与真实边界 | 无 |
| `Snapshot` | 请求、进程、主机、Docker、队列、诊断和实时网络 | `windowMinutes=1..15`、`top`、`includeHost`、`includeDocker` |
| `Logs` | 日志列表和完整详情数据 | `keyword/type/category/source/level/searchMonth/pageIndex/pageSize` |
| `LogTypes` | 日志类型与数量 | `keyword/searchMonth` |
| `LogStats` | 总数、错误、警告、慢 SQL、慢执行、异常 | `keyword/searchMonth` |
| `Signal` | 时间窗内的诊断信号 | `windowSeconds=60..86400` 与日志过滤项 |
| `Trace` | W3C Trace 时间线 | 32 位十六进制 `traceId` |
| `ApiRank` | 热点接口、耗时占比、平均/P95、异常率 | `top/apiEngineKey/name` |
| `AppLogs` | 当前 API 进程日志尾部 | `lines=20..1000` |
| `PlatformStats` | 表、菜单、接口引擎、租户、用户和排行 | 无 |
| `SecurityData` | 访问、攻击或封锁记录 | `kind=Access|Attack|Block`、分页 |
| `TrafficHistory` | MySQL 固定时间桶流量趋势 | `rangeKey`；可选 `dimensionType` |
| `HistoricalDashboard` | 同一时间范围内的热点接口、IP、帐号、租户、内容类型与请求/流量总览 | `rangeKey=live5|today|yesterday|3d|7d|15d|30d|3m|6m|1y`、`top` |
| `TrafficDetails` | 跨月大文件、上传下载和可疑传输 MongoDB 明细 | `rangeKey`、`pageIndex/pageSize`；可选 `keyword/transferAction/ip/userId/endpoint` |

示例：

```json
{
  "action": "HistoricalDashboard",
  "rangeKey": "30d",
  "top": 15
}
```

```json
{
  "action": "TrafficDetails",
  "rangeKey": "7d",
  "transferAction": "Upload",
  "pageIndex": 1,
  "pageSize": 15
}
```

所有列表默认按 15 条开始；扩大分页前先增加过滤条件。日志和安全数据每页最多 200 条，Trace 最多 500 条。历史总览由固定聚合桶一次返回有界 TOP，不得循环拉取无时间边界的全量日志。

## 安全治理动作

`microi_manage_system_observability` 只允许 `BlockIp` 和 `UnblockIp`。第一次不带确认调用只返回 dry-run，不产生写入；确认值必须精确为：

```text
BlockIp:<ip>
UnblockIp:<ip>
```

封禁前必须核对反向代理、容器网桥、健康检查、办公出口和 NAT。可信后端会再次验证平台管理员身份、IP 格式、本机/未指定/组播限制、租户范围，并写审计日志。不能通过参数指定其它租户，也不能把批量 IP、CIDR、任意表写入或旧菜单删除塞进这个工具。

## 数据解释边界

1. `Snapshot`、活动请求、最近请求、进程与应用日志是当前 API 节点视角。多节点结论需要逐节点或接入统一遥测平台。
2. 热点接口的“耗时占比”是窗口总请求耗时贡献，用于定位相关性；它不是逐请求 CPU 核采样，也不等于该接口独占同等 CPU。
3. HTTP 可归因流量只统计经过 API 中间件的请求体和响应体。网卡、容器 NetIO 还包含 TLS/HTTP 头、重传、数据库、Redis、MongoDB、MQ、对象存储、外部 HTTP、健康检查和同机其它进程。
4. “未归因流量”只能作为排查线索，不能强行归属给某个帐号、IP 或接口。
5. IP 必须注明是可信代理解析后的客户端地址还是直接连接地址；代理链未配置正确前不要据此处罚用户。
6. 进程 CPU“多核原始值”可超过 100%；247.7% 表示约占用 2.48 个逻辑核心。判断整机压力应使用主机归一值并结合持续时间、请求率与热点排行。

## 隐私与权限

- 只允许平台可观测性管理员读取敏感运行数据或治理 IP；通常要求 `Level >= 9999`，最终以可信后端判定为准。
- 不采集或持久化请求正文、响应正文、QueryString、Cookie、Authorization、Token、密码、Secret 或 API Key。
- 文件流量只记录清洗后的文件名/扩展名/数量/字节，不记录文件内容。
- 日志详情由可信后端递归脱敏；AI 回答仍要避免复述连接串、内部路径、个人信息或可用于登录的材料。
- 对外分享截图前检查帐号、IP、Trace、内部域名、物理路径和业务数据；需要时使用测试数据重新截图。

## 高性能存储规范

- 请求热路径只做原子计数和有硬上限的分钟桶聚合；端点、IP、帐号、租户、内容类型限制基数并保留 TOP N。
- 普通高频明细只保留短窗口内存；错误、慢请求、大文件和可疑传输进入有界队列，异步批量写 MongoDB。
- 长期趋势使用 MySQL 固定时间桶和确定性幂等键批量 upsert；5 分钟桶保留 48 小时、小时桶保留 45 天、天桶保留 400 天。页面不能每次扫描 Mongo 明细重新聚合总览。
- 队列必须有硬容量、故障 spool/WAL、停机排空和幂等重放；禁止无界 `ConcurrentQueue` 或逐请求同步写 Mongo/MySQL。
- Redis 适合短时热点结果、租约和限流；缓存 Key 包含租户、动作和过滤摘要，写入或治理后主动失效，并保留短 TTL 防止永久陈旧。

## 接口引擎归因规范

- PC、UniApp、内置微服务、MCP 和应用包中的固定接口必须调用 `/apiengine/{ApiEngineKey}` 或该引擎唯一 `ApiAddress`；新增代码禁止调用 `/api/ApiEngine/Run`。
- SDK 的普通 `ApiEngine.Run` 必须自动生成真实引擎路径；旧通用入口只能封装在显式 `RunLegacy` 中，供不能立即升级的历史客户端使用。
- 监控中保留通用入口的兼容识别，但不能依赖读取请求正文才能知道 Key；真实路由、访问日志、限流和流量排行应直接显示接口引擎 Key。
- 代码审计要区分运行调用与文档/兼容测试；发布门至少扫描 Microi.Client、UniApp、微服务源码、MCP 与应用包，确保没有新增固定业务依赖。

需要压测或修改热路径时同时读取 `../performance-testing/SKILL.md`；排查 V8/日志写法时读取 `../v8-debugging/SKILL.md`。

## AI 诊断顺序

1. 先查 `Capabilities`，确认当前版本和边界。
2. 查 `Snapshot`，记录节点、窗口、请求率、活动请求、CPU/内存、队列、HTTP 流量与未归因残差。
3. 查 `ApiRank` 和 `TrafficHistory` 的 Endpoint/IP/User/Tenant/ContentType 维度，区分“计算慢”与“传输大”；再用 `TrafficDetails` 定位具体帐号/匿名、IP、接口、文件元数据和 TraceId。
4. 按异常接口或 TraceId 查 `Logs`、`Signal`、`Trace`；先处理时间线中的首个根因。
5. 对慢 SQL 核对执行计划、索引、返回字段、分页、排序/Join 和锁等待；不要先盲目加 Redis。
6. 对高频只读结果评估短 TTL Redis，并明确更新/删除时的失效路径；对写接口先批量化 I/O、缩小事务和消除逐行远程调用。
7. 对匿名上传、大响应、重复轮询或攻击信号先核对业务合法性，再限流、对象存储直传/CDN、Range、压缩或封禁。
8. 优化后用相同窗口与负载复测 P50/P95/P99、RPS、错误率、CPU、内存、分配率和网络字节，不能只凭单次页面刷新下结论。

## 扩展与商城交付

- 普通查询和汇总优先在 `mci-system-observability-query` 接口引擎编排。
- 只有接口引擎缺少宿主进程、Docker、Mongo 聚合、安全运行态等可复用底层能力时，才扩展最小 V8 原子方法；Controller 不承载业务编排。
- 官方引擎使用应用包 `ResourcePolicies.ApiEngines=Managed`，客户扩展使用新 Key 或 `CreateIfMissing`，不要覆盖客户已修改的本地代码。
- 应用包必须包含表、字段、索引/DDL、接口引擎、微服务全部源码、构建产物、菜单和版本日志；安装后回读固定版本快照并在真实页面验收。
- 后端框架和商城应用是两条升级链：只升级其中一条不能证明功能完整。目标端应先升级兼容框架，再安装/更新最新【系统日志/监控】应用。

## 最低验收

- 系统日志位于首个 Tab；统计、筛选、15 条默认分页、搜索、详情、Trace 时间线均可用。
- 日志详情使用平台级 `Teleport to="body"` 遮罩整个系统框架；标题/副标题最多两行，异常标红并提供原因与解决方案。
- 七个 Tab 均跟随主题；动画只使用 transform/opacity 等低成本属性，页面隐藏或 `prefers-reduced-motion` 时暂停。
- MCP 能发现两个专用工具；`Capabilities`、日志/流量分页、Trace 缺参拦截、IP dry-run、错误确认和成功审计均有自动测试。
- 对请求热路径做开关前后压测，确认观测开启后 P95/P99、CPU、内存和分配率没有不可接受回退；故障 Mongo 不得阻塞业务请求。
- 多节点、网卡重置/回绕、服务重启、匿名/登录、大上传/下载、敏感字段脱敏、时间桶幂等和缓存失效均有验证证据。
