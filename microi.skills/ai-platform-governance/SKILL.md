---
name: ai-platform-governance
description: Microi吾码 AI 平台治理中心设计、调用、扩展、应用商城升级与验收规范。用于门户与资源版本、身份目录/用户组/权限解释、配置模板与漂移、功能开关、发布审批/门禁/断点回滚、服务注册路由与韧性、Trace/告警/日志生命周期、资产物料、协作租约和可恢复导入。
---

# Microi吾码 AI 平台治理中心

## 何时使用

以下任一需求都应使用本 Skill：

- 门户项目、插槽、资产、版本发布、Diff 或回滚；
- 身份目录同步、动态用户组、标签、人群圈选、批量授权、访问申请、临时权限或权限解释；
- 配置模板/继承/Secret 引用、配置漂移或功能开关；
- 发布计划、多人审批、职责分离、自动门禁、断点续发或回滚；
- 服务注册、实例心跳/排空、版本/区域/标签/权重路由、限流、熔断、重试、降级或服务拓扑；
- W3C Trace、告警规则、值班升级、可靠通知或日志热温冷生命周期；
- 可复用组件/区块资产、依赖解析、协作租约或跨资源变更集；
- JSON/CSV/Excel 可恢复导入；
- 发布或安装官方应用 `ai-platform-studio`。

## 不可破坏的边界

- DiyToken 是唯一会话入口；继续复用现有用户、角色、部门、菜单、表权限和数据范围，禁止建立第二套 Token/RBAC。
- 所有治理事实写入当前 `OsClient` 数据库或租户隔离 Redis；禁止把 `static`、单例字典、本机定时器或浏览器存储作为平台完成事实。
- 普通业务编排优先接口引擎。C# 只提供目录协议/Secret 隔离、真实 FormEngine 权限解释、Trace/日志物理访问和 Redis 原子缓存等底层可信原子能力。
- 核心资源由应用商城交付，不为表、字段、菜单、接口、任务或种子数据添加定制 `Microi.Upgrade` 迁移。
- 所有危险动作必须是 Plan/DryRun → Hash/CAS → 幂等执行 → 回读 → 条件回滚。
- 锁只解决并发，不代替稳定幂等键、唯一约束、状态机、outbox/inbox 或条件写入。
- Secret 只保存引用；列表、Diff、错误、日志、截图、导出和运行台账不得出现密码、Token、私钥或连接串原文。

## 官方应用事实

应用 Key：`ai-platform-studio`，当前资源合同版本：`v2.0.1`。

- 40 张 `mci_` 治理表和 5 张运行基础表，应用包共 45 张表、873 个字段；
- 40 个后台模块；
- 64 个接口引擎：57 个 `Managed`，7 个 `CreateIfMissing`；
- 1 个 `MciAiPlatformMinuteSweep` 维护任务；
- 10 个微服务路由：`overview`、`portal`、`identity`、`access`、`configuration`、`release`、`services`、`observability`、`assets`、`import`。

租户 Hook：

```text
mci-portal-publish-extension
mci-identity-source-extension
mci-release-gate-extension
mci-alert-notify-extension
mci-asset-validate-extension
mci-log-archive-extension
mci-release-execute-extension
```

Hook 首次创建后归租户维护，升级永不覆盖，也不得把同 Key 改回 `Managed`。

## 通用调用规则

1. 通过 MCP 回读当前表结构、菜单、接口、应用和微服务事实。
2. 调用 `*-plan`、`*-publish` 的 `DryRun=true` 或专用预检接口。
3. 保存返回的 `PlanHash/ContentHash/RowVersion`，展示影响和阻断项。
4. 只有用户授权后执行写操作；服务端从 DiyToken 重算身份与租户。
5. 写后回读主记录、不可变版本、运行台账和实际页面。
6. 分开报告源码/测试、远端写入、浏览器、应用商城和生产部署证据。

旧 Hash、旧 RowVersion、旧 fencing token、未知状态、未知步骤或未知字段一律失败关闭。

## 门户与资源版本

调用顺序：

```text
mci-portal-publish-plan
  → mci-portal-publish(ExpectedSnapshotHash)
  → mci-portal-resolve
```

- `ProjectKey/SlotKey/AssetKey` 稳定且项目内唯一。
- 发布先写 `mci_resource_version`，再 CAS 切换活动版本指针。
- 相同 Hash 幂等复用；旧 Hash 冲突后必须重新计划。
- `mci-resource-compare` 做语义比较。
- `mci-resource-rollback` 校验 `ExpectedCurrentHash` 并创建新回滚版本，不能删除历史。

## 身份与访问治理

### 身份同步

```text
mci-identity-sync-plan → 人工处置冲突 → mci-identity-sync-apply
```

- 可信 SCIM 适配器为 `V8.Method.ReadIdentityDirectoryPage`；只允许 HTTPS、受控 DNS、非私网目标、有界页数和 Secret 引用。
- 新账号默认停用。邮箱、手机号或账号多重命中时进入 `mci_identity_sync_conflict`，禁止猜测合并。
- 增量游标、计划 Hash 和 IdempotencyKey 必须一致。
- 非 SCIM 目录通过 `mci-identity-source-extension` 接入；Hook 也不能返回 Secret 原文。

### 用户组、标签和授权

- `mci-identity-group-preview`：静态成员或标签集合预览；空规则失败关闭。
- `mci-identity-group-refresh`：写入带 SnapshotId 的共享成员快照。
- `mci-identity-tag-assign`：分配/撤销标签，记录有效期和 `EvidenceHash`。
- `mci-access-change-plan/apply/rollback`：批量授权计划、逐项执行和条件回滚。
- `mci-access-request`：`Submit/Approve/Reject/Cancel/Revoke` 与临时授权。
- `mci-access-entitlement-expire`：维护任务回收过期授权。
- `mci-org-snapshot`：不可变组织树快照与结构差异。

`mci-permission-explain` 必须调用 `V8.Method.ExplainAuthorizationDecision` 复用真实 FormEngine 授权逻辑；禁止从菜单/角色表重新拼近似结论。

## 配置模板与漂移

`mci-configuration-publish` 输入要点：

```js
{
  ProfileKey, Name, Category, Environment, ParentProfileId, VersionNo,
  Schema, Values, SecretReferences, Owner, Enabled,
  ExpectedContentHash, ChangeSummary, DryRun
}
```

- `Values` 只能放非敏感值；敏感路径映射到 `SecretReferences`。
- 继承最多 10 层，检测循环。
- 稳定规范化、SHA-256、DryRun、CAS 和 `ConfigurationProfile` 不可变版本必须同时存在。
- `mci-configuration-resolve` 返回 `EffectiveHash`，并保持 `SecretValuesResolved=false`。
- `mci-configuration-drift-scan` 生成有界语义差异。
- `mci-configuration-drift-transition` 使用 `ExpectedRowVersion` 完成 Ignore/Reopen/Resolve；摘要仍不一致时不能 Resolve。

## 功能开关

发布调用 `mci-feature-flag-publish`，求值调用 `mci-feature-flag-evaluate`。

- 规则只允许 `UserIds/ExcludedUserIds/DeptIds/RoleIds`。
- 灰度比例 0—100，按稳定主体 Hash 分桶，禁止 `Math.random()`。
- 普通用户只能使用当前 DiyToken 的权威 `UserId/RoleIds/DeptIds`；只有超级管理员可模拟其它主体。
- 开关内容生成 `FeatureFlag` 不可变版本；无变化复用，版本号冲突拒绝。
- 功能开关不能代替任何权限、状态机、幂等或审计。

## 发布状态机

### 固定计划

使用 `mci-release-plan-publish`，不要直接 Add/Upt `mci_release_plan`。

允许发布步骤：

- `Verify`：`FeatureFlag/ConfigurationProfile/ServicePolicy/AssetVersion/Portal/ChangeSet`；
- `PortalPublish`；
- `Extension`：由 `mci-release-execute-extension` 处理并使用 `StepIdempotencyKey`。

允许回滚步骤：`Verify`、`PortalRollback`、`Extension`。

生产计划至少包含发布步骤、回滚步骤、测试/回读证据和审批策略。计划中发现疑似 Secret 失败关闭。

### 审批

`mci-release-transition` 支持：

```text
Submit / Approve / Reject / Cancel / Reopen
```

每次调用必须传 `ExpectedPlanHash + ExpectedRowVersion`。审批记录按计划 Hash、轮次和审批人生成不可变 `ApprovalKey`。职责分离开启时创建人不能审批自己的计划。

### 门禁

`mci-release-validate` 可检查：

- 计划完整性、发布/回滚步骤、证据和审批；
- `NoCriticalAlerts`、`NoIdentityConflicts`、`NoConfigurationDrift`；
- `PortalVersion`、`FeatureFlag`、`ChangeSet`；
- `Extension` 门禁。

通过只进入 `Ready`，不等于已发布。

### 执行与恢复

`mci-release-execute` 输入：

```js
{
  ReleasePlanId,
  Direction: 'Release' | 'Rollback',
  IdempotencyKey,
  ExpectedPlanHash,
  Resume: false
}
```

- 每次调用只提交一个步骤；调用方依据 `HasMore` 继续。
- 运行台账保存 RunKey、Checkpoint、LeaseToken/Expiry、FencingToken、RowVersion 和结果摘要。
- 失败返回 `Code=1, Data.Status='Failed', ResumeRequired=true`，以便失败事实提交；业务成功不能只看 `Code`。
- 续跑必须使用同一 IdempotencyKey 且 `Resume=true`。
- 变更子步骤使用独立事务；成功后台账中断时用 `StepIdempotencyKey` 重试。

## 服务治理

### 实例协议

- `mci-service-instance-register`：生成实例令牌，数据库只存摘要。
- `mci-service-instance-heartbeat`：实例身份或管理员更新租约，使用 RowVersion/FencingToken。
- `mci-service-instance-drain`：先排空再退出流量。

### 策略与调用闭环

- `mci-service-policy-publish`：版本/区域/标签/权重、限流、熔断、重试、降级；DryRun/CAS/不可变 `ServicePolicy` 版本。
- `mci-service-resolve`：按权威角色/主体与稳定 Hash 选择单个端点，普通调用方不返回全部候选。
- `mci-service-policy-acquire`：共享 Redis 固定窗口、持久 Outcome 重建熔断、半开共享许可。
- `mci-service-policy-outcome`：Permit 归属校验、稳定 OutcomeKey、持久结果与调用边聚合。
- `mci-service-topology`：从持久调用边读取运行拓扑。

V8 业务只能使用租户隔离的 `SetIfNotExists/Expire/HashIncrement` 原子能力，不能获得原始 Redis 客户端或自定义 Key 前缀逃逸租户边界。

## Trace、告警与日志

### 可信原子能力

- `V8.Method.QuerySystemLogSignal`：有界日志计数、错误率、P95 和样例；
- `V8.Method.GetTraceTimeline`：跨月 Trace/Span 时间线；
- `V8.Method.PlanSystemLogLifecycle`：只读生命周期估算；
- `V8.Method.RunSystemLogLifecycle`：仅可信持久后台任务可调用的物理执行器。

### 告警

- `mci-alert-evaluate` 使用持久窗口台账，覆盖连续触发/恢复、去重和抑制。
- `mci-alert-scan`、`mci-alert-dispatch`、`mci-alert-delivery-send` 均为内部任务接口。
- Dispatch 只写 Outbox；Sender 以 ClaimToken、LeaseExpiresAt、RowVersion 和 DeliveryKey 送达。
- `mci_alert_route` 可配置值班排班、升级链和 SLA。
- 渠道发送只写 `mci-alert-notify-extension`。

### 日志生命周期

`mci_log_policy` 包含匹配/采样、脱敏规则、热温冷天数、日/总配额、超限动作、归档模式和法律保留。

- 先 `mci-log-lifecycle-plan` 获取 PlanHash/估算。
- 再通过持久后台任务调用 `mci-log-lifecycle-execute`。
- 每片归档为 gzip JSONL，私有 HDFS 必须回读长度和 SHA-256。
- 先写 `ArchiveVerified` 收据，再条件删除，再回读为零，最后标记 `Committed`。
- `Extension` 模式由 `mci-log-archive-extension` 处理；法律保留不能删除。

## 资产、协作和变更集

- `mci-asset-publish` 使用 `microi.asset.v1`，声明 Component、Props、Setters、DataAdapters、Platforms、DependencyPackages。
- 校验语义版本范围、缺失依赖、循环、最大深度、规范化摘要、DryRun 和 CAS。
- `mci-asset-resolve` 验证内容 Hash，返回 `ResolvedDependencies/DependencyGraph/LoadOrder`。
- `mci-collaboration-lease` 使用共享租约和 fencing token；旧编辑者不能保存。
- `mci-change-set-validate` 检查资源、PlanHash、生产证据和回滚计划。
- Page JSON ↔ Vue SFC 只处理平台生成的受控标记，不执行任意 Vue/JavaScript，也不承诺任意源码无损反编译。

## 可恢复导入

- `mci-import-plan`：JSON/CSV/Excel 解析、字段元数据校验、文件/计划/行 Hash、公式注入与敏感字段拒绝。
- `mci-import-stage`：按 ExpectedPlanHash 幂等写暂存行。
- `mci-import-execute`：必须通过持久后台任务；每片独立提交 Checkpoint/FencingToken。
- `mci-import-control`：Pause/Resume/Cancel/Retry，使用状态条件更新。
- `mci-import-rollback`：只恢复当前值仍等于 After 基线的记录；冲突不覆盖。

单批最多 2,000 行。更大数据应拆批或使用专用迁移作业，不提高内存上限硬顶。

## 页面与蓝图版本

页面工具：

```text
microi_list_page_history
microi_get_page_history
microi_compare_page_versions
microi_export_page_design
microi_rollback_page_design
```

蓝图提供对应的历史、读取、比较、导出和回滚工具。修改前读取 CurrentHash，保存传 ExpectedHash，写后回读新 Hash 与不可变历史。回滚创建新版本，不删除旧历史。

## 应用商城发布

- 官方发布使用绑定 `https://api.itdos.com`、`OsClient=iTdos` 的 `microi_itdos`。
- 先构建 Manifest、21 项应用契约、微服务类型检查/契约/生产构建。
- 发布请求版本、资产准备版本和包内 `PackageInfo.Version` 必须精确相同；40 个菜单、40 张治理表和 64 个接口引擎的选择必须来自当前包正文。
- 包内 `ResourcePolicies.ApiEngines` 必须精确为 57 个 Managed + 7 个 CreateIfMissing。
- 发布后独立回读应用版本、状态、包内容、45 表/873 字段、40 模块、64 接口、任务、10 路由和构建资产 Hash。
- 定时任务必须在 `PostSchema` 后通过独立 `ScheduleJobs` checkpoint 安装并回读；成功版本只能在任务阶段之后写入。
- 官方发布源禁止自安装和 `ValidateOnly`；发布源做精确包回读，安装验证在非官方目标租户或本地非发布源环境完成。
- 目标安装/更新后再次回读，并做管理员 PC/390px 浏览器冒烟。
- 商城发布不等于生产 API/Web 容器部署。

## 双节点与浏览器验收

至少覆盖：

- 两节点同时心跳、同一策略解析、同一限流窗口和熔断半开；
- 同一发布幂等键并发执行、租约竞争、步骤失败、台账提交前中断、同键续跑与回滚；
- Redis/MongoDB 短暂故障、锁持有者退出、重复消息和滚动版本共存；
- PC 10 路由、失败态、空态、重复动作；390×844 下移动导航、对话框、表单和无整页横向溢出；
- 页面源码桥、资产依赖循环、协作旧 fencing、导入暂停/恢复和条件回滚。

最终报告必须分别列出源码/测试、远端写入、真实浏览器、应用商城、正式发布和生产部署证据；没有执行的层不能声称通过。
