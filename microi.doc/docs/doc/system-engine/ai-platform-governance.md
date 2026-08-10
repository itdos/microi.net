# Microi吾码 AI 平台治理中心

Microi吾码 AI 平台治理中心把门户、身份、权限、配置、功能开关、发布、服务、可观测、日志、资产、协作和可恢复导入收敛为一套官方应用。它继续使用吾码现有的 `DiyToken`、`OsClient`、菜单/表/行权限、FormEngine、V8引擎、Redis、MongoDB、关系数据库、微服务和应用商城，不建立第二套用户、权限或发布内核。

稳定入口：

```text
菜单 Url：/micro-app/ai-platform-studio/overview
浏览器：/#/micro-app/ai-platform-studio/overview
```

## 能力总览

| 治理域 | 核心能力 |
|---|---|
| 门户与版本 | 门户项目、命名插槽、统一资产、发布预检、不可变版本、原子指针、运行解析、差异与回滚 |
| 身份与访问 | 可信目录适配、同步计划/执行、增量游标、冲突队列、动态用户组、标签、人群、批量授权、临时权限、权限解释、组织快照 |
| 配置与开关 | 配置模板、继承、Secret 引用、稳定哈希、DryRun、CAS、不可变版本、漂移检测/处置、功能开关稳定分桶 |
| 发布治理 | 固定计划、不可变审批证据、职责分离、自动门禁、分布式租约、栅栏令牌、单步提交、断点续发、条件回滚 |
| 服务治理 | 服务/实例注册、心跳租约、排空、版本/区域/标签/权重路由、共享限流、持久熔断、重试/降级、调用结果与拓扑 |
| 观测与日志 | W3C Trace、Span 时间线、可信日志信号、窗口告警、去重/抑制/恢复、值班升级、Outbox 送达、热温冷生命周期与归档证明 |
| 资产与协作 | `microi.asset.v1` 物料协议、Setter/DataAdapter、依赖图、兼容版本、循环检测、加载顺序、协作租约、跨资源变更集 |
| 可恢复导入 | JSON/CSV/Excel 预检、暂存行、分片后台执行、检查点、暂停/恢复/取消/重试、逐行条件回滚 |
| 页面与蓝图 | 页面/蓝图历史、稳定 Hash、语义 Diff、导入导出、CAS 回滚、Undo/Redo、Page JSON ↔ 受控 Vue SFC 桥接 |

## 这些菜单是谁用的

AI平台治理不是普通员工的业务菜单，也不是要求管理员每天把 40 个页面逐个点一遍。它是面向平台管理员、架构师、运维和交付负责人的治理控制台，把原来散落在脚本、发布记录、监控平台和人工表格里的配置、审批、运行状态与审计证据统一起来。

安装或升级后的导航层级固定为：

```text
系统引擎
└─ AI平台治理
   ├─ AI平台治理工作台
   └─ 40 个治理数据菜单
```

`AI平台治理工作台` 绑定稳定路由 `/micro-app/ai-platform-studio/overview`，是 10 个治理页面的统一可视化入口；其余 40 个菜单是治理数据的配置、运行与审计入口。数据菜单名称保留 `AI平台治理·` 前缀以维持已有菜单 ID、权限和升级兼容，并在父菜单内按 9 个业务域连续排序。页面类型可以这样理解：

- **配置**：管理员维护规则或主数据，是日常主要入口；
- **审批/处置**：有待办或异常时进入；
- **运行**：任务执行时观察进度、恢复或排错；
- **台账**：平台自动产生的明细与证据，通常只在审计和故障定位时查看。

## 40 个菜单分别做什么

| 业务域 | 菜单 | 类型 | 用途 |
|---|---|---|---|
| 门户装配 | 门户项目 | 配置 | 定义一个门户及其当前发布状态 |
| 门户装配 | 门户插槽 | 配置 | 定义门户页面中可装配内容的位置 |
| 门户装配 | 门户资源 | 配置 | 维护装入插槽的页面、组件和资源 |
| 门户装配 | 资源版本 | 台账 | 保存资源不可变版本，用于比较、审计和回滚 |
| 身份目录 | 身份连接器 | 配置 | 配置企业微信、钉钉、LDAP 等身份来源 |
| 身份目录 | 身份同步 | 运行 | 查看每次组织和账号同步的执行结果 |
| 身份目录 | 身份冲突 | 处置 | 处理重名、账号碰撞和归属不一致 |
| 身份目录 | 组织快照 | 台账 | 保存部门树与用户归属的不可变快照 |
| 人群与授权 | 动态用户组 | 配置 | 按规则生成可重复计算的用户人群 |
| 人群与授权 | 用户组成员 | 台账 | 查看某次计算得到的实际成员 |
| 人群与授权 | 用户标签 | 配置 | 定义用户分类、范围和标签类型 |
| 人群与授权 | 标签分配 | 台账 | 记录标签分配来源、有效期和状态 |
| 人群与授权 | 授权变更集 | 运行 | 批量授权或回收前生成可校验的变更计划 |
| 人群与授权 | 授权变更明细 | 台账 | 记录每个账号的授权执行结果与错误 |
| 人群与授权 | 访问申请 | 审批 | 提交、审批和跟踪访问权限申请 |
| 人群与授权 | 临时授权 | 运行 | 管理带到期时间且可自动回收的权限 |
| 配置与灰度 | 配置模板 | 配置 | 维护不同环境可继承、可版本化的配置基线 |
| 配置与灰度 | 配置漂移 | 处置 | 发现并处理目标环境偏离配置基线的问题 |
| 配置与灰度 | 功能开关 | 配置 | 按用户、角色、部门或比例控制功能灰度 |
| 发布治理 | 发布计划 | 配置 | 固定发布内容、门禁、步骤和回滚方案 |
| 发布治理 | 发布审批 | 审批 | 保存不可变审批结论并落实职责分离 |
| 发布治理 | 发布运行 | 运行 | 查看发布或回滚的断点、租约和执行状态 |
| 发布治理 | 变更台账 | 台账 | 汇总跨资源变更及其应用、验证证据 |
| 服务治理 | 服务目录 | 配置 | 登记服务身份、负责人和健康状态 |
| 服务治理 | 服务实例 | 运行 | 查看实例版本、区域、租约和排空状态 |
| 服务治理 | 流量策略 | 配置 | 配置版本路由、重试、限流、熔断和降级 |
| 服务治理 | 调用结果 | 台账 | 记录策略许可对应的真实调用结果 |
| 服务治理 | 服务拓扑 | 台账 | 聚合服务间调用量、错误量和延迟 |
| 可观测与日志 | 可观测策略 | 配置 | 定义可信指标、阈值、窗口和严重级别 |
| 可观测与日志 | 规则评估台账 | 台账 | 记录每个时间窗口的规则评估证据 |
| 可观测与日志 | 告警事件 | 处置 | 查看、确认、恢复和关闭平台告警 |
| 可观测与日志 | 告警路由 | 配置 | 配置告警接收人、优先级和处理时限 |
| 可观测与日志 | 告警送达 | 台账 | 跟踪每次通知尝试、重试和送达结果 |
| 可观测与日志 | 日志策略 | 配置 | 设置日志热、温、冷阶段和归档方式 |
| 可观测与日志 | 日志生命周期 | 运行 | 查看日志扫描、归档和清理任务结果 |
| 资产与协作 | 资产包 | 配置 | 定义可复用、可安装的页面或配置资产集合 |
| 资产与协作 | 资产版本 | 台账 | 保存资产不可变版本、内容哈希和兼容范围 |
| 资产与协作 | 协作租约 | 运行 | 显示谁正在编辑资源并提供过期与防并发令牌 |
| 数据迁移 | 导入批次 | 运行 | 查看导入计划、进度、成功失败数和检查点 |
| 数据迁移 | 导入暂存行 | 台账 | 查看每一行的计划动作、结果和错误原因 |

如果只是先熟悉系统，建议从治理工作台总览开始，再关注 `身份冲突`、`配置漂移`、`发布计划/审批`、`告警事件` 和 `导入批次`。`用户组成员`、`授权变更明细`、`规则评估台账`、`调用结果`、`告警送达`、`导入暂存行` 等明细页主要用于追查“为什么失败、影响了谁、能否恢复”。

## 应用资源与页面

`ai-platform-studio` v2.0.3 应用包包含：

- 40 张治理表和 5 张运行基础表，应用包共 45 张表、873 个字段；
- 42 个后台菜单：1 个 `AI平台治理` 父菜单、1 个 `AI平台治理工作台` 微服务菜单和 40 个数据菜单；
- 64 个接口引擎，其中 57 个官方核心为 `Managed`，7 个租户扩展为 `CreateIfMissing`；
- 1 个每分钟治理维护任务；
- 10 条治理微服务路由：`overview`、`portal`、`identity`、`access`、`configuration`、`release`、`services`、`observability`、`assets`、`import`。

所有表位于当前租户数据库，以 `mci_` 为前缀，不额外增加物理 `OsClient` 列。表、字段、索引、菜单、权限、接口引擎、任务和微服务统一由应用商城升级，不能为这些资源添加租户定制 `.NET` 启动迁移。

租户 Hook 固定为：

```text
mci-portal-publish-extension
mci-identity-source-extension
mci-release-gate-extension
mci-alert-notify-extension
mci-asset-validate-extension
mci-log-archive-extension
mci-release-execute-extension
```

Hook 首次安装后归租户维护，官方更新永不覆盖。

## 通用写入合同

危险操作统一遵循：

```text
读取当前事实 → Plan / DryRun → 固定 Hash → 用户确认
→ CAS / 幂等执行 → 数据与资源回读 → 审计 → 条件回滚
```

必须使用以下字段或等价事实：

- `ExpectedContentHash` / `ExpectedPlanHash`：拒绝基于旧内容写入；
- `RowVersion`：拒绝并发状态覆盖；
- `IdempotencyKey` / `EventId`：重复投递复用同一业务结果；
- `LeaseToken` + `LeaseExpiresAt`：共享租约可超时接管；
- `FencingToken`：旧持有者不能在租约转移后继续写；
- 不可变版本/审批/结果台账：不能删除证据来伪造成功。

前端显示成功、接口返回 `Code=1`、商城显示已安装，均不能替代写后回读与真实页面验收。

## 门户编排与版本

1. `mci-portal-publish-plan` 规范化项目、插槽与资产，检查重复 Key、孤立引用和发布漂移。
2. `mci-portal-publish` 必须携带 `ExpectedSnapshotHash`；内容未变化时幂等复用。
3. 发布先写不可变 `mci_resource_version`，再以条件更新切换 `mci_portal_project.ActiveVersionId`。
4. `mci-portal-resolve` 只解析已发布快照；匿名运行端不能读取草稿。
5. `mci-resource-compare` 比较版本；`mci-resource-rollback` 校验当前 Hash 后创建新的回滚版本，不删除历史。

## 身份、用户组与权限

### 可信目录同步

- 连接器只保存 Secret 引用；普通 V8、列表、导出和错误信息不能获得明文。
- `mci-identity-sync-plan` 通过可信宿主适配器读取 HTTPS SCIM 目录，限制 DNS、私网地址、页数和返回量。
- 先生成新增/更新/禁用/冲突计划，再以计划 Hash 和幂等键调用 `mci-identity-sync-apply`。
- 新同步账号默认停用；多重身份命中、未知部门/角色、游标漂移进入冲突队列，不能猜测合并。

### 访问治理

- 动态组支持静态成员、标签交并集和排除集合；空规则失败关闭。
- 标签分配包含来源、有效期、证据摘要和到期状态。
- 批量授权使用计划、影响预览、逐项结果和条件回滚。
- 访问申请覆盖提交、批准、驳回、取消、撤销与临时授权到期回收。
- `mci-permission-explain` 调用真实 FormEngine 授权事实源，解释菜单、表动作、行数据范围与拒绝原因；不能另写一套近似权限算法。

## 配置模板与漂移

`mci-configuration-publish` 提供：

- Schema、非敏感值和 Secret 引用三层分离；疑似密码、Token、私钥或连接串原文失败关闭；
- 最多 10 层继承、循环检测、稳定规范化、SHA-256、DryRun、CAS 和不可变版本；
- 内容相同时幂等复用，版本号对应不同内容时拒绝覆盖。

`mci-configuration-resolve` 合并继承链并返回 `EffectiveHash`，但明确标记 `SecretValuesResolved=false`。`mci-configuration-drift-scan` 生成语义差异，`mci-configuration-drift-transition` 用行版本完成忽略、重开和解决；摘要仍不一致时不能伪造已解决。

## 功能开关

`mci-feature-flag-publish` 校验语义版本、时间窗、0—100 灰度比例、用户/排除用户/部门/角色白名单，生成不可变 `FeatureFlag` 资源版本。`mci-feature-flag-evaluate` 使用稳定主体 Hash 分桶：

- 普通用户只能按当前 DiyToken 的权威 `UserId/RoleIds/DeptIds` 求值；
- 客户端不能伪造其它身份上下文；超级管理员才可做模拟预览；
- 功能开关只决定功能是否启用，不能授予菜单、表、行、接口或业务状态权限。

## 发布审批、门禁与断点执行

### 1. 固定计划

`mci-release-plan-publish` 对门禁、发布步骤、回滚步骤、审批策略和测试证据做白名单规范化，拒绝 Secret 原文，生成稳定 `PlanHash`。生产计划提交前必须有发布步骤、回滚步骤和真实测试/回读证据。

### 2. 不可变审批

`mci-release-transition` 支持 `Submit`、`Approve`、`Reject`、`Cancel`、`Reopen`。每轮每位审批人的结论使用稳定 `ApprovalKey` 只追加一次，不能修改；生产策略可要求多人批准和创建人与审批人职责分离。

主状态：

```text
Draft → Reviewing → Approved → Ready → Releasing → Released
          ↘ Rejected     ↘ Blocked        ↘ Failed
Released / Failed → RollingBack → RolledBack
```

### 3. 自动门禁

`mci-release-validate` 重新计算计划 Hash，并检查审批、资源、回滚、证据、高危告警、身份冲突、配置漂移、门户版本、功能开关和变更集。租户专属检查由 `mci-release-gate-extension` 以相同 Key 返回结论。

### 4. 执行与恢复

`mci-release-execute` 每次只执行一个白名单步骤：`Verify`、`PortalPublish`、`PortalRollback` 或租户 `Extension`。运行台账持久化 `RunKey`、检查点、租约、栅栏令牌和结果摘要：

- 同一计划、方向和幂等键只创建一个运行；
- 多节点竞争通过数据库 CAS 抢占，不能依赖进程内锁；
- 变更步骤使用独立事务，失败回滚子步骤，同时提交失败台账；
- 子步骤成功但台账提交前中断时，用 `StepIdempotencyKey` 安全重试；
- 失败后必须使用同一幂等键 `Resume=true` 从当前检查点继续。

## 服务注册、路由与韧性

- `mci-service-instance-register/heartbeat/drain` 使用实例令牌摘要、行版本、租约到期和栅栏令牌维护共享实例事实。
- `mci-service-policy-publish` 固定版本/区域/标签/权重、限流、熔断、重试和降级策略；支持 DryRun、CAS 与不可变版本。
- `mci-service-resolve` 按权威用户/角色与稳定 Hash 选中一个端点；普通调用方不能获得全部候选实例。
- `mci-service-policy-acquire` 使用租户隔离 Redis 原子能力执行共享限流和半开许可，但熔断事实从持久调用结果重建。
- `mci-service-policy-outcome` 以 Permit/Outcome 幂等键记录结果并更新拓扑；锁不能代替业务幂等。

## Trace、告警与日志生命周期

### W3C Trace

HTTP、后台任务与 MQ 传播 `TraceId/SpanId/ParentSpanId/TraceFlags`，系统日志同时记录服务、版本、节点、环境、事件和耗时。`mci-trace-timeline` 可跨月按 Trace 聚合时间线。

### 告警闭环

- `mci-alert-evaluate` 只读取可信日志信号，按窗口台账计算连续触发/恢复；支持去重、抑制和恢复。
- `mci-alert-dispatch` 生成待发送 Outbox，不直接调用外部渠道。
- `mci-alert-delivery-send` 使用送达租约、行版本和稳定 DeliveryKey；租户渠道由 `mci-alert-notify-extension` 实现。
- 路由支持匹配条件、值班排班、升级链、确认 SLA 和解决 SLA。
- `mci-platform-maintenance` 每分钟扫描告警、送达、到期权限和过期标签；任务仍需业务幂等。

### 日志生命周期

`mci_log_policy` 定义来源匹配、采样/脱敏规则、热/温/冷天数、日/总配额、超限动作、归档模式和法律保留。`mci-log-lifecycle-plan` 只读估算跨月日志；`mci-log-lifecycle-execute` 只能由持久后台任务分片执行：

1. 读取有界批次并生成 gzip JSONL；
2. 写入私有 HDFS，或交给租户归档 Hook；
3. 回读文件长度与 SHA-256 证明；
4. 写入幂等归档收据；
5. 仅在证明通过后条件删除并回读为零。

法律保留策略不能执行删除；单机文件只能做故障 spool，不能成为集群唯一事实源。

## 资产包、页面源码桥与协作

`mci-asset-publish` 使用 `microi.asset.v1`：

- 组件名称、属性、Setter、DataAdapter 和目标平台均为声明式白名单；
- 依赖声明 `MinVersion/MaxVersion`，发布时检查不存在、范围不兼容、循环和最大深度；
- 规范化内容 Hash、DryRun、CAS、不可变版本和租户校验 Hook；
- `mci-asset-resolve` 验证每个版本完整性并返回依赖图与确定性加载顺序。

Page Engine 提供本地 50 步/20MB Undo/Redo、页面不可变历史、结构化 Diff、CAS 回滚，以及确定性 Page JSON ↔ Vue SFC 桥接。源码桥只接受平台生成的受控 SFC 标记，不执行任意脚本，也不承诺无损反编译任意 Vue 工程。

`mci-collaboration-lease` 为资源编辑提供共享租约和 fencing token；`mci-change-set-validate` 固定跨资源计划、测试证据和回滚入口。实时文本合并不能绕过版本 Hash 和最终 CAS。

## 可恢复导入

### 门禁

- 支持 JSON、CSV、Excel；Excel 由 `V8.Office.ExcelToList` 解析。
- 单批最多 2,000 行；目标表和字段从当前租户元数据校验。
- 平台核心表、凭据字段、未知字段、超限嵌套和公式注入失败关闭。
- 文件、计划和每行数据都生成稳定 SHA-256。

### 状态与恢复

```text
Draft → Planned → Staged → Running → Completed / CompletedWithErrors
                       ↘ Paused → Running
                       ↘ Cancelled
Completed → RollingBack → RolledBack
```

`mci-import-execute` 只能由持久后台任务调用，每片独立提交检查点和 fencing token。回滚只恢复本批次产生且当前值仍等于 `AfterHash` 的记录；业务数据已被后来修改时记录冲突，不覆盖新值。

## 页面与蓝图版本工具

界面引擎与业务蓝图共享“规范化 → Hash → 历史 → Diff → CAS 回滚”合同。页面 MCP 工具：

| 工具 | 用途 |
|---|---|
| `microi_list_page_history` | 分页读取历史 |
| `microi_get_page_history` | 读取不可变快照 |
| `microi_compare_page_versions` | 比较历史与当前或两个历史版本 |
| `microi_export_page_design` | 导出带 Schema 与 Hash 的页面包 |
| `microi_rollback_page_design` | 校验当前 Hash 后回滚并创建新历史 |

蓝图对应提供历史列表、读取、比较、导出和回滚工具。AI 修改前先读取当前 Hash，写入后回读新 Hash、历史和真实资源。

## 应用商城安装与升级

官方应用 Key：`ai-platform-studio`。

- 官方发布使用绑定 `https://api.itdos.com`、`OsClient=iTdos` 的 `microi_itdos`。
- 发布请求版本、资产准备版本与包内 `PackageInfo.Version` 必须完全相同；菜单、表和接口选择从当前包正文持久化，禁止回退到最新版本或旧选择。
- 57 个核心接口使用 `Managed`；目标 `Local != Base` 时整包冲突回滚，不静默覆盖客户代码。
- 7 个 Hook 使用 `CreateIfMissing`；首次创建后永不覆盖。
- `IncludeSource=false` 时只交付构建资产；源码仍位于发布租户私有存储。
- 定时任务在 `PostSchema` 完成后进入独立 `ScheduleJobs` checkpoint；任务保存和运行元数据回读成功后，才允许写入应用安装版本。
- 发布和安装后分别回读版本、45 表/873 字段/索引、41 菜单、64 接口策略、任务、10 路由、构建资产 Hash 和运行入口。
- 官方发布源禁止自安装及 `ValidateOnly`。发布源完成包正文精确回读，安装链路改在非官方目标租户或本地非发布源环境验证。

## 最小验收矩阵

- [ ] 10 个页面在 PC 与 390px 窄屏均可操作，无整页横向溢出。
- [ ] 未登录、非管理员、跨租户、伪造身份和旧 Hash 请求失败关闭。
- [ ] 配置、开关、资产和服务策略覆盖 DryRun、无变化复用、版本冲突与 CAS 冲突。
- [ ] 发布覆盖多人审批、职责分离、门禁阻断、重复请求、步骤失败、同键续跑和条件回滚。
- [ ] 两个节点覆盖同一实例心跳、同一限流窗口、熔断半开、租约转移和重复 Outcome。
- [ ] Trace 覆盖 HTTP → 后台任务 → MQ；日志归档覆盖写入、证明、删除回读和节点中断恢复。
- [ ] 导入覆盖非法字段、公式注入、重复执行、暂停/恢复、节点退出和有业务新修改时拒绝回滚。
- [ ] 页面/蓝图/资产覆盖历史、Diff、依赖循环、协作租约、旧 fencing 和回滚。
- [ ] 应用商城首次安装、正常升级、Managed 冲突、Hook 保留和重复安装均通过。

## 相关文档

- [业务蓝图、状态机与自动化流](/doc/system-engine/ai-workflow-suite)
- [界面引擎](/doc/system-engine/page-engine)
- [微服务](/doc/system-engine/micro-app)
- [应用商城](/doc/system-engine/app-store)
- [AI 开发工具](/doc/v8-engine/vs-code-plugin)
