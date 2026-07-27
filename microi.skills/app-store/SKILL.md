---
name: app-store
description: Microi 应用商城开发、打包、安装和升级规范。用于官方/社区应用、Manifest、源码与构建产物、依赖、后台安装任务、租户隔离、增量升级、回滚和验收。
---

# Microi 应用商城

## 核心原则

应用包是可审计、可重复安装、可增量升级的交付单元。运行类型使用 `ApplicationType`：普通平台包的新建默认值是 `Regular`，既有商城平台应用/通知仍使用 `Platform`，另外还有 `MicroService`、`UniApp`、`Web`；读取端必须兼容 `Regular/Platform`，不能在迁移完成前强制改单值。官方/社区来源使用 `PublisherType`。

`AppType` 是历史复用字段：旧包/接口曾把它用于官方/社区来源，也曾把它作为运行类型回退。新代码不能把 `AppType` 当事实源；只在读取旧数据时回退，写入新数据使用 `ApplicationType + PublisherType`。

客户已有的全局 V8、表单配置、菜单、字段和自定义代码必须保留。升级采用存在性检查、差异合并和包隔离，禁止整表覆盖或把发布方租户数据原样复制到目标租户。

## 包内容

- Manifest：应用 Key、版本、兼容平台版本、依赖和资源清单。
- 数据模型：表、字段、菜单、角色权限、接口引擎、事件、数据源、页面、打印、工作流、任务。
- 源码与构建：私有源码包与可部署构建包分离，记录 SHA-256。
- 安装/升级脚本：幂等、可恢复、可回读；不包含租户密钥、Token、连接串或 License keys。
- 迁移采用“先扩展、后迁移、再收缩”，支持新旧节点短暂并存。

## 安装流程

1. 校验签名/哈希、包版本、平台兼容性、依赖和磁盘/配额。
2. 创建全局唯一 `InstallationId` 和稳定幂等键。
3. 使用后台任务执行，阶段性持久化进度与 checkpoint。
4. 按 Manifest 差异创建缺失资源；已有资源只更新包拥有且允许升级的属性。
5. 写入成功后刷新共享缓存版本。
6. 回读表、字段、引擎、菜单、权限、页面等关键资源。
7. 做 HTTP、UI 和权限冒烟；成功后标记安装版本。

安装中断后从 checkpoint 幂等恢复；不能依赖当前 API 节点内存。

## 权限与租户

- 商城定义、安装、升级、卸载和应用源码只允许 `Level >= 9999`。
- 所有资源按目标 `OsClient` 写入；包内不能携带源租户 `OsClient`、数据库、Redis、对象存储、MQ/MQTT、AI 或第三方密钥。
- 按钮调用后台安装接口时，前端只传应用/版本/安装 Id；目标租户和管理员身份由 Token 确定。
- 卸载是破坏性操作，必须明确列出将删除/保留的资源、二次确认并优先软删除/归档业务数据。

## MCP 工作流

1. `microi_list_applications` / `microi_get_application_context` 盘点在线应用源码。
2. `microi_get_manifest_schema` 获取 Manifest 合约。
3. `microi_plan_system` 与 `microi_generate_system(dryRun:true)` 先做干跑。
4. 用户明确确认后才真实安装/升级。
5. `microi_validate_system` 和远端回读验收。

已有 MicroService 优先新增页面/路由；没有时才创建、同步源码、发布构建。复杂安装交互使用 `V8.OpenAppDialog`，后台任务上报进度。

## VS Code 本地应用与发布边界

- `AI应用` 本地树按每个一级目录的 `.microi-micro-app.json` 发现项目；只要 `osClient/apiBaseUrl` 与当前连接一致，就必须显示 `Web / UniApp / MicroService`，不得用 `runtime === "micro-app"` 过滤掉其它应用类型。无效清单应记录诊断，不能静默吞掉整个目录。
- “安装到当前租户”和“发布到应用商城（不安装）”是两个独立动作。商城发布只能同步 `sys_microistore`、应用源码/构建/版本元数据及安装包，不得新增或修改当前租户的 `sys_microiservice / sys_microiservice_page`；操作前后必须回读运行态确认未变化。
- 应用项目行必须直接显示商城发布入口，不能只藏在右键菜单；同时保留构建安装和源码同步状态入口。

## 版本与回滚

- 版本号单调递增，保存变更清单和前后哈希。
- 公有发布必须同时保留两套入口：`/{OsClient}/ai-app-publish/{AppKey}/index.html` 永远指向最新版，`.../versions/{Version}/index.html` 永远保留该历史版本。先写入最新版的非入口资产，最后切换根 `index.html`，避免发布瞬间引用不存在的资源。
- 官网、二维码和用户分享只使用无版本号根入口，不追加 `v/apiBase/OsClient`。目标租户的 `ApiBase/OsClient` 在发布或安装时写入入口 HTML 的 `window.__MICROI_APP_CONTEXT__ / MICROI_API_BASE / MICROI_OS_CLIENT`；安装包不得沿用发布端运行上下文。
- 数据迁移通常只向前；回滚应用版本不能假设自动回滚业务数据。
- 更新失败保留原版本可运行资源，记录失败阶段；不要清空客户 V8 后再尝试恢复。
- 私有源码仓库、`Microi.net/License/keys` 和部署密钥不进入公开应用包。

## 验收清单

- [ ] 同一包重复安装无重复表/字段/菜单/任务
- [ ] 客户自定义 V8 与非包拥有配置保持不变
- [ ] 源码包、构建包、Manifest 和数据库版本一致且哈希可核
- [ ] 无版本号根入口与当前商城版本一致，历史版本 URL 仍可独立访问
- [ ] 安装到不同 ApiBase/OsClient 后，入口 HTML 使用目标租户上下文且分享 URL 无运行参数
- [ ] 中断/重启后可恢复，两个节点不会重复副作用
- [ ] 普通角色不能安装、升级、卸载或读取私有源码
- [ ] 缓存刷新后远端 API 与真实 UI 通过
- [ ] 卸载范围明确、可审计、可恢复或已提示不可恢复
