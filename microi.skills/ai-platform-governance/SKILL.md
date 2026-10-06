---
name: ai-platform-governance
description: Microi吾码 AI 平台治理中心设计、调用、扩展、应用商城升级与验收规范。用于门户与资源版本、身份目录/用户组/权限解释、配置模板与漂移、功能开关、发布审批/门禁/断点回滚、服务注册路由与韧性、Trace/告警/日志生命周期、资产物料、协作租约和可恢复导入。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi吾码 AI 平台治理中心

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=ai-platform-governance-000 sha256=48b82af9f11388d6872cf90aa2c74a1d35c1db948483f30615ce054989ef0d77 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-001 sha256=47197af80919be7e08ef051884e70900714bdf53f551fad16e119a86d6efb63c -->
## 不可破坏的边界

- DiyToken 是唯一会话入口；继续复用现有用户、角色、部门、菜单、表权限和数据范围，禁止建立第二套 Token/RBAC。
- 所有治理事实写入当前 `OsClient` 数据库或租户隔离 Redis；禁止把 `static`、单例字典、本机定时器或浏览器存储作为平台完成事实。
- 普通业务编排优先接口引擎。C# 只提供目录协议/Secret 隔离、真实 FormEngine 权限解释、Trace/日志物理访问和 Redis 原子缓存等底层可信原子能力。
- 核心资源由应用商城交付，不为表、字段、菜单、接口、任务或种子数据添加定制 `Microi.Upgrade` 迁移。
- 所有危险动作必须是 Plan/DryRun → Hash/CAS → 幂等执行 → 回读 → 条件回滚。
- 锁只解决并发，不代替稳定幂等键、唯一约束、状态机、outbox/inbox 或条件写入。
- Secret 只保存引用；列表、Diff、错误、日志、截图、导出和运行台账不得出现密码、Token、私钥或连接串原文。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-002 sha256=527f1cda978f88d0d1507d90aac71089f7585699f0ad7d5266dc7e40ba026b7c -->
## 官方应用事实

应用 Key：`ai-platform-studio`，当前资源合同版本：`v2.0.9`。

- 40 张 `mci_` 治理表和 5 张运行基础表，应用包共 45 张表、873 个字段；
- 42 条后台菜单兼容记录：仅 `AI平台治理` 作为可见 MicroService 入口；历史工作台和 40 个数据菜单保留原 Id、权限与升级身份，但统一隐藏；
- 64 个接口引擎：57 个 `Managed`，7 个 `CreateIfMissing`；
- 1 个 `MciAiPlatformMinuteSweep` 维护任务；
- 10 个微服务路由：`overview`、`portal`、`identity`、`access`、`configuration`、`release`、`services`、`observability`、`assets`、`import`。
- v2.0.9 保持表、接口、任务和菜单 Id 合同不变；10 个业务域页面及 40 类治理资源全部由工作台内部路由、操作面板和台账入口承载。隐藏的历史工作台菜单必须使用独立兼容 URL，不能与新的唯一入口争用 `sys_menu.Url`。发行版本、Manifest 版本与 `.microi-micro-app.json` 运行时版本必须同时提升并保持一致。内部切换只更新异步内容区并显示局部骨架屏，主题/reset/装饰样式限定在 `[data-mci-ui-root="ai-platform-studio"]`，不得重挂宿主 Tab 或污染吾码 Logo 与主菜单。

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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-003 sha256=3d43295846e19e8b5cb526442ff8aff8f0317db88f5be803b5798e63118546e2 -->
## 菜单层级与语义

应用安装或升级后只保留一个可见入口，禁止把历史工作台或 40 个数据菜单继续暴露到导航：

```text
系统引擎 (cdc0844b-7249-4d64-a9c3-563a15c9cd20)
└─ AI平台治理 (MicroService: /micro-app/ai-platform-studio/overview)
```

`AI平台治理` 是 10 个治理页面的唯一可见操作入口，必须同时绑定 `MicroServiceId`、`MicroServicePageId`、`MicroServiceRoutePath=/overview` 和 `MicroServiceKey=ai-platform-studio`；不得只创建普通 URL 菜单。历史菜单记录必须保持稳定 Id 并设置 `Display=0`、`AppDisplay=0`，避免删除后破坏旧角色权限、收藏与升级定位。`system.manifest.json.menuCatalog` 是 40 类治理资源用途与工作台内部分组的事实源，它们按以下 9 个业务域组织：

| 业务域 | 数据菜单 | 主要作用 |
|---|---|---|
| 门户装配 | 门户项目、门户插槽、门户资源、资源版本 | 组合门户并维护不可变发布版本 |
| 身份目录 | 身份连接器、身份同步、身份冲突、组织快照 | 同步外部身份并处理冲突 |
| 人群与授权 | 动态用户组、用户组成员、用户标签、标签分配、授权变更集、授权变更明细、访问申请、临时授权 | 按人群申请、授予、到期回收并保留证据 |
| 配置与灰度 | 配置模板、配置漂移、功能开关 | 管理配置基线、环境偏差和灰度开关 |
| 发布治理 | 发布计划、发布审批、发布运行、变更台账 | 计划、审批、门禁、执行、恢复和审计发布 |
| 服务治理 | 服务目录、服务实例、流量策略、调用结果、服务拓扑 | 管理实例租约、路由韧性和调用事实 |
| 可观测与日志 | 可观测策略、规则评估台账、告警事件、告警路由、告警送达、日志策略、日志生命周期 | 监控、告警、可靠通知和日志归档闭环 |
| 资产与协作 | 资产包、资产版本、协作租约 | 交付可复用资产并避免并发覆盖 |
| 数据迁移 | 导入批次、导入暂存行 | 预检、分片执行、恢复和回滚大批量导入 |

向用户解释时必须区分页面类型：`配置` 是日常维护入口，`审批/处置` 在有待办或异常时使用，`运行` 用于观察和恢复任务，`台账` 主要供审计与排错。不得把台账页描述成需要人工逐项维护的业务模块。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-004 sha256=f4fbda7d2522d95e4aaa6f010637b6dfe652a7871614177ce489df7830b9c911 -->
## 通用调用规则

1. 通过 MCP 回读当前表结构、菜单、接口、应用和微服务事实。
2. 调用 `*-plan`、`*-publish` 的 `DryRun=true` 或专用预检接口。
3. 保存返回的 `PlanHash/ContentHash/RowVersion`，展示影响和阻断项。
4. 只有用户授权后执行写操作；服务端从 DiyToken 重算身份与租户。
5. 写后回读主记录、不可变版本、运行台账和实际页面。
6. 分开报告源码/测试、远端写入、浏览器、应用商城和生产部署证据。

旧 Hash、旧 RowVersion、旧 fencing token、未知状态、未知步骤或未知字段一律失败关闭。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-005 sha256=6298a32cb0b0c2f226485697bba306936265dab62248bb48a1709e36f73241e9 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-006 sha256=ec5c949ac0615c9917ce1910a397f5ab1e7878fb56a35cb761cd5ebbdf96c714 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ai-platform-governance-007 sha256=64f2699d58860ed29782136673b51bdb1488b87cd17b24b761e9d22479902ae5 -->
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

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-功能开关.md](references/progressive-01-功能开关.md)：功能开关；发布状态机；服务治理；Trace、告警与日志；资产、协作和变更集；可恢复导入；页面与蓝图版本；应用商城发布；双节点与浏览器验收
<!-- microi-progressive:end -->
