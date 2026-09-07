---
name: system-observability
description: Microi 系统日志/监控查询、诊断与治理规范。用于分析系统日志、Trace、热点接口、CPU/内存吃满、OOM、异常分配、接口引擎/V8 事件归因、重启事故恢复、网络流量、安全事件和监控性能成本。
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

AI 第一次使用时先查询 `action=Capabilities`，再按返回的动作、权限和边界选择查询。优先使用专用工具，它已经限制动作、参数、分页、确认和审计。旧进程缺少新 Memory 动作时，仅允许通过标准 `microi_run_engine` 临时只读执行固定查询引擎；完整版本排查与降级边界见 [内存事故排查手册](references/memory-incident-triage.md)。不得创建临时维护引擎或绕过后端权限。

## 查询动作

`microi_query_system_observability` 支持：

| action | 用途 | 关键参数 |
|---|---|---|
| `Capabilities` | 能力目录与真实边界 | 无 |
| `Snapshot` | 请求、进程、主机、Docker、队列、诊断和实时网络 | `windowMinutes=1..15`、`top`、`includeHost`、`includeDocker` |
| `Memory` | 当前节点内存压力、执行分配、对象类型和采集质量 | 无；必须先核对采集器心跳与存储错误 |
| `MemoryIncidents` | 当前租户共享事故与本机持久记录摘要 | 最近最多 50 条 |
| `MemoryIncident` | 执行链、代码哈希、CLR 分配栈和退出证据 | 32 位小写十六进制 `incidentId` |
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
7. 执行累计分配和 EventPipe 抽样不是存活堆或 RSS；父执行包含子调用，不能相加或把最高分配者直接宣布为唯一根因。CLR 栈关联脚本哈希和资源身份，不保证 JavaScript 行号。
8. MongoDB 驻留内存、WiredTiger 缓存和日志库存储空间分开解释；磁盘大小不能当作进程 RAM。未正常退出只说明检查点未完成正常关闭，不单独证明 OOM。

## 内存事故留证规范

处理内存吃满、OOM、异常分配、长循环或重启丢日志时，必须继续读取 [内存事故排查手册](references/memory-incident-triage.md)，按字段与证据质量完成归因，不得仅返回一个热点排行。

- 诊断始终独立于 V8 内存/语句保护；不能为了留证默认开启 `V8Limit`，也不能把正常复杂业务报错当成问题已解决。
- 先核对包含独立采集器的 API 二进制、可写持久 `logs` 卷和本机 .NET 诊断通道；仅升级商城微服务不代表底层已经上线。
- 每 2 秒检查点与周期分配样本覆盖尚未返回的执行；API 被强杀后由独立采集器保存末段证据，再由重启节点恢复。极快崩溃、线程调度停顿、磁盘满/丢失仍有缺口，不承诺零丢失。
- 优化版使用执行边界计量与单独后台线程约 200 ms 身份刷新，不挂载诊断专用的 Jint 逐语句 Constraint，也不依赖可能耗尽的业务线程池定时回调。后台事件必须携带原始 OS 线程 Id 和递增版本；运行中长循环的实时分配看 EventPipe 样本，不能把边界累计值的暂时不变或身份刷新误判成业务没有分配/已经取得进展。
- `Memory` 动作兼容不变；核对 `Executions.ObservationMode/IdentityRegistryOverflowCount/NativeThreadIdentityUnavailableCount/IdentityRefreshFailureCount` 和 `Collector.ObservedIdentityProtocolVersion/BackgroundIdentityRefreshes/RejectedStaleIdentityMarkers`。字段缺失按旧版/未知处理，不按零故障处理。性能数据与完整边界见下方内存诊断参考文件。
- 共享 Mongo 事故保留 14 天，本机历史预算 256 MiB。原始片段单段上限 64 MiB，保留最近两段，加上正在写入的一段最多 192 MiB；采集主体到 16 MiB 时提前收尾，为 rundown 留出空间，EventPipe 缓冲固定 64 MiB。完整 API 的收尾实测约 35 MiB，不能用小测试进程的片段大小代替平台验收；仍须检查截断、丢事件和离线方法栈。事件 Id 全局唯一，重放幂等且更新版本只前进；不得回退为无界日志/完整对象序列化。
- 共享存储断开时先保留本机证据，恢复后补传。多节点共享卷的恢复和清理必须尊重仍存活节点及采集器的租约。
- 查询先报告 `Fresh/LastCaptureError/LostEvents/OverflowSamples`、本机存储错误和待补传状态；指标缺失应显示不可用，不得按零值宣布健康。
- 整个容器退出后，重启解析器尝试最后两个原始片段。尾段缺方法栈时保留执行身份与对象类型，并补充前段；必须同时报告 `MissingStackSamples`、`Truncated` 与 `Evidence.StackQuality`，不得把部分恢复称为完整栈。
- 高 RSS 但没有分配热点时，继续区分长期保留、非托管和数据库进程；受控堆分析属于后续证据，不能伪称分配采样已经给出存活对象根因。

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
   内存问题同时查 `Memory`、`MemoryIncidents`、`MemoryIncident`，先确定采集健康，再关联接口/V8 事件、表/工作流节点、代码哈希和 Trace。
3. 查 `ApiRank` 和 `TrafficHistory` 的 Endpoint/IP/User/Tenant/ContentType 维度，区分“计算慢”与“传输大”；再用 `TrafficDetails` 定位具体帐号/匿名、IP、接口、文件元数据和 TraceId。
4. 按异常接口或 TraceId 查 `Logs`、`Signal`、`Trace`；先处理时间线中的首个根因。
5. 对慢 SQL 核对执行计划、索引、返回字段、分页、排序/Join 和锁等待；不要先盲目加 Redis。
6. 对高频只读结果评估短 TTL Redis，并明确更新/删除时的失效路径；对写接口先批量化 I/O、缩小事务和消除逐行远程调用。
7. 对匿名上传、大响应、重复轮询或攻击信号先核对业务合法性，再限流、对象存储直传/CDN、Range、压缩或封禁。
8. 优化后用相同窗口与负载复测 P50/P95/P99、RPS、错误率、CPU、内存、分配率和网络字节，不能只凭单次页面刷新下结论。

## 扩展与商城交付

- 普通查询和汇总优先在 `mci-system-observability-query` 接口引擎编排。
- 只有接口引擎缺少宿主进程、Docker、Mongo 聚合、安全运行态等可复用底层能力时，才扩展最小 V8 原子方法；Controller 不承载业务编排。
- 官方引擎声明 `ResourcePolicies.ApiEngines=Managed`，由本次已校验包正文覆盖其拥有的资源；客户扩展使用独立 Key 或 `CreateIfMissing`，既有扩展不被覆盖。不得把 Managed 的旧本地改动当作拒绝应用升级的理由，也不得扩大到无关资源。
- 按应用发布契约交付表、字段、索引/DDL、接口引擎、菜单、版本日志和微服务运行产物；私有源码由源码同步链交付。`DatabaseOnly/SourceNotIncluded` 必须如实标识，不能声称商城包包含全部源码。安装后回读固定版本快照并在真实页面验收。
- 后端框架和商城应用是两条升级链：只升级其中一条不能证明功能完整。目标端应先升级兼容框架，再安装/更新最新【系统日志/监控】应用。

## 最低验收

- 系统日志位于首个 Tab；统计、筛选、15 条默认分页、搜索、详情、Trace 时间线均可用。
- 日志详情使用平台级 `Teleport to="body"` 遮罩整个系统框架；标题/副标题最多两行，异常标红并提供原因与解决方案。
- 八个 Tab 均跟随主题；动画只使用 transform/opacity 等低成本属性，页面隐藏或 `prefers-reduced-motion` 时暂停。
- MCP 能发现两个专用工具；`Capabilities`、日志/流量分页、Trace 缺参拦截、IP dry-run、错误确认和成功审计均有自动测试。
- 通过实际打包后的 MCP 执行 `initialize`、`tools/list`、`describe_tool` 和 Memory 查询，确认三个动作及 `incidentId` 校验；源码测试通过不能代替发行包验收。旧后端失败保留原始 Code/Msg，不能伪造为空结果或自动开启 V8 限制。
- 对请求热路径做开关前后压测，确认观测开启后 P95/P99、CPU、内存和分配率没有不可接受回退；故障 Mongo 不得阻塞业务请求。
- 多节点、网卡重置/回绕、服务重启、匿名/登录、大上传/下载、敏感字段脱敏、时间桶幂等和缓存失效均有验证证据。
- 内存专项至少覆盖：V8 限制关闭的复杂执行、真实 Kestrel TraceId、500 个活动请求、异步嵌套归属、独立采集栈、Mongo 故障、执行中强杀、改名重启、跨节点补传、旧快照重放和租户隔离。
