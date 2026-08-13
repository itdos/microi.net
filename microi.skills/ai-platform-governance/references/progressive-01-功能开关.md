# ai-platform-governance 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ai-platform-governance-008 sha256=e3927151358f0c9e801c1027edb877332c8e148f245d58eade2eaae53ddb7948 -->
## 功能开关

发布调用 `mci-feature-flag-publish`，求值调用 `mci-feature-flag-evaluate`。

- 规则只允许 `UserIds/ExcludedUserIds/DeptIds/RoleIds`。
- 灰度比例 0—100，按稳定主体 Hash 分桶，禁止 `Math.random()`。
- 普通用户只能使用当前 DiyToken 的权威 `UserId/RoleIds/DeptIds`；只有超级管理员可模拟其它主体。
- 开关内容生成 `FeatureFlag` 不可变版本；无变化复用，版本号冲突拒绝。
- 功能开关不能代替任何权限、状态机、幂等或审计。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-009 sha256=ca73d439788b802c1b999c0a7973e735caf8b4149d4be116511e470ca93d728e -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-010 sha256=cb8f46acd05462f4fb99d52517b34f9f9a7ae785f44d6ea0c0f1e79f050068d0 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-011 sha256=db964d7f412ce56112c7a8173a10a6a1f33c762761747b6db780463a0e07f79d -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-012 sha256=82e059f90494a679d4073693b83904826841a7c87e0ed1e5ab0e28575eedffac -->
## 资产、协作和变更集

- `mci-asset-publish` 使用 `microi.asset.v1`，声明 Component、Props、Setters、DataAdapters、Platforms、DependencyPackages。
- 校验语义版本范围、缺失依赖、循环、最大深度、规范化摘要、DryRun 和 CAS。
- `mci-asset-resolve` 验证内容 Hash，返回 `ResolvedDependencies/DependencyGraph/LoadOrder`。
- `mci-collaboration-lease` 使用共享租约和 fencing token；旧编辑者不能保存。
- `mci-change-set-validate` 检查资源、PlanHash、生产证据和回滚计划。
- Page JSON ↔ Vue SFC 只处理平台生成的受控标记，不执行任意 Vue/JavaScript，也不承诺任意源码无损反编译。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-013 sha256=b286f47071ac64e9e7d75929134123e8a3ef65a05ddb86007554ae05099e1445 -->
## 可恢复导入

- `mci-import-plan`：JSON/CSV/Excel 解析、字段元数据校验、文件/计划/行 Hash、公式注入与敏感字段拒绝。
- `mci-import-stage`：按 ExpectedPlanHash 幂等写暂存行。
- `mci-import-execute`：必须通过持久后台任务；每片独立提交 Checkpoint/FencingToken。
- `mci-import-control`：Pause/Resume/Cancel/Retry，使用状态条件更新。
- `mci-import-rollback`：只恢复当前值仍等于 After 基线的记录；冲突不覆盖。

单批最多 2,000 行。更大数据应拆批或使用专用迁移作业，不提高内存上限硬顶。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-014 sha256=9c5387dccbc2ff092470edc70b9600416700ac734f15df2c2e775bae0adf00c4 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-015 sha256=6fafd84efd63a1607c4c98c4a173d755b2ba22fb7a251a21ed4d4699556656a7 -->
## 应用商城发布

- 官方发布使用绑定 `https://api.itdos.com`、`OsClient=iTdos` 的 `microi_itdos`。
- 先构建 Manifest、22 项应用契约、微服务类型检查/契约/生产构建。
- 发布请求版本、资产准备版本和包内 `PackageInfo.Version` 必须精确相同；42 个菜单、40 张治理表和 64 个接口引擎的选择必须来自当前包正文。
- 包内 `ResourcePolicies.ApiEngines` 必须精确为 57 个 Managed + 7 个 CreateIfMissing。
- 发布后独立回读应用版本、状态、包内容、45 表/873 字段、42 菜单（含已绑定 `/overview` 的治理工作台）、64 接口、任务、10 路由和构建资产 Hash。
- 定时任务必须在 `PostSchema` 后通过独立 `ScheduleJobs` checkpoint 安装并回读；成功版本只能在任务阶段之后写入。
- 官方发布源禁止自安装和 `ValidateOnly`；发布源做精确包回读，安装验证在非官方目标租户或本地非发布源环境完成。
- 目标安装/更新后再次回读，并做管理员 PC/390px 浏览器冒烟。
- 商城发布不等于生产 API/Web 容器部署。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-016 sha256=76dab40556ce9a5a732c398d2f534c16478a1a88d4c1efdcdeaa6ba76d4339df -->
## 双节点与浏览器验收

至少覆盖：

- 两节点同时心跳、同一策略解析、同一限流窗口和熔断半开；
- 同一发布幂等键并发执行、租约竞争、步骤失败、台账提交前中断、同键续跑与回滚；
- Redis/MongoDB 短暂故障、锁持有者退出、重复消息和滚动版本共存；
- PC 10 路由、失败态、空态、重复动作；390×844 下移动导航、对话框、表单和无整页横向溢出；
- 页面源码桥、资产依赖循环、协作旧 fencing、导入暂停/恢复和条件回滚。

最终报告必须分别列出源码/测试、远端写入、真实浏览器、应用商城、正式发布和生产部署证据；没有执行的层不能声称通过。
<!-- /microi-progressive:chunk -->
