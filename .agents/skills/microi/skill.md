---
name: microi
description: 安装或初始化 @microi.net/cli、配置 Microi吾码服务器连接与 MCP、按连接拉取全部 V8 代码，并处理吾码低代码平台任务。用户提到“安装吾码插件”“初始化 Microi”“添加服务器/MCP”“拉取某连接的所有 V8”或 Microi 开发时使用。
---

# Microi吾码 AI 开发路由



## Codex 吾码最新版硬门禁（强制）

- 当前宿主是 Codex 且会话能够读取任意 Microi吾码 Skill 时，每个对话首次处理 Microi 任务必须先完整读取 `microi.skills/microi-codex-installer/SKILL.md`，并在业务分析、MCP 调用、源码修改、构建或发布前完成一次最新版门禁。
- 使用 npm 官方 registry 强制在线查询：`npm view '@microi.net/cli' version --json --prefer-online --registry=https://registry.npmjs.org/`。本地 `microi codex status` 不能证明 npm 没有新版。
- 同时核对 `microi version --json`、`microi codex status --json` 与 `microi doctor --workspace "<工作区绝对路径>" --json`。CLI、Codex 插件、工作区 AI bundle 或 MCP provider 不是最新版时，必须先取得一次用户授权；用户已明确要求安装、升级、更新或初始化时不重复询问。
- 获得授权后连续执行 `npm install --global @microi.net/cli@latest`、`microi codex install --yes`、`microi ai init --workspace "<工作区绝对路径>" --json`、`microi doctor --workspace "<工作区绝对路径>" --json`、`microi codex status --json`。`ai init` 默认包含 MCP 更新，禁止传 `--no-mcp`。
- Codex 插件发生变化后必须新建任务或重载 Codex，再次通过门禁后继续；registry 不可用、用户拒绝授权、安装失败或未重载时失败关闭，不得用第三方 registry、缓存或旧 CLI 冒充最新版。


## 立即执行规则

- 用户明确要求安装 `@microi.net/cli` 时，先运行 `npm install --global @microi.net/cli@latest`；若只需在空工作区初始化，也可直接运行 `npx --yes @microi.net/cli@latest init --workspace "<工作区绝对路径>" --pull`。
- 用户要求“初始化 Microi吾码插件”时，运行 `microi init --workspace "<工作区绝对路径>" --pull`。CLI 会交互式收集 API 地址、OsClient、账号、密码，并生成当前宿主可识别的 Skills 与 MCP 配置；不得把密码、Token 写进提示词或命令历史。
- 已有连接时，用户要求拉取某服务器、连接或 MCP 的全部 V8 代码，运行 `microi pull --profile "<连接名称、OsClient、序号或 mcpName>" --scope all --workspace "<工作区绝对路径>"`。`microi profile list --json` 会返回每个连接的稳定 `mcpName`；无法唯一匹配时再让用户选择。
- 初始化或更新后运行 `microi doctor --workspace "<工作区绝对路径>" --json` 验证；当前 AI 会话未刷新 MCP/Skills 时，提示用户重载 Skills、插件或新建任务。
- 初始化完成后，先读取 `microi.skills/microi-codex-installer/SKILL.md`，再按任务类型读取下列项目 Skill。不要复制或另建一套平台规范。

## 吾码完整 Skills 索引

- `microi.skills/v8-crud-api/SKILL.md` — Microi V8 CRUD API 接口引擎开发
- `microi.skills/v8-sql-query/SKILL.md` — Microi V8 安全 SQL 查询
- `microi.skills/v8-table-event/SKILL.md` — Microi V8 表单事件开发
- `microi.skills/v8-cache-pattern/SKILL.md` — Microi V8 Redis 缓存模式
- `microi.skills/v8-http-integration/SKILL.md` — Microi V8 HTTP 外部接口集成
- `microi.skills/v8-mongodb/SKILL.md` — Microi V8 MongoDB 操作
- `microi.skills/v8-mq-mqtt/SKILL.md` — Microi V8 消息队列与 MQTT
- `microi.skills/v8-workflow/SKILL.md` — Microi V8 工作流事件开发
- `microi.skills/v8-api-config/SKILL.md` — Microi V8 接口引擎配置
- `microi.skills/v8-saas-multi-tenant/SKILL.md` — Microi V8 SaaS 多租户引擎
- `microi.skills/v8-image-processing/SKILL.md` — Microi V8 图像处理
- `microi.skills/v8-file-upload/SKILL.md` — Microi V8 文件上传下载
- `microi.skills/v8-export-import/SKILL.md` — Microi V8 Office 导入导出
- `microi.skills/v8-debugging/SKILL.md` — Microi V8 调试与日志
- `microi.skills/v8-security/SKILL.md` — Microi V8 安全最佳实践
- `microi.skills/v8-utilities/SKILL.md` — Microi V8 通用能力与函数索引
- `microi.skills/ocr-engine/SKILL.md` — Microi OCR 引擎
- `microi.skills/spider-engine/SKILL.md` — Microi 采集引擎
- `microi.skills/v8-frontend-events/SKILL.md` — Microi V8 前端事件大全
- `microi.skills/v8-template-engine/SKILL.md` — Microi V8 模板引擎（表格/表单 V8 模板）
- `microi.skills/v8-menu-buttons/SKILL.md` — v8-menu-buttons — 菜单按钮 / Tab / 批量操作 V8 写法
- `microi.skills/microi-client-frontend/SKILL.md` — Microi.Client 前台源码架构说明
- `microi.skills/page-engine/SKILL.md` — Microi 界面引擎（Page Engine）页面 JSON 生成
- `microi.skills/print-engine/SKILL.md` — Microi 打印引擎（Print Engine）模板 JSON 生成
- `microi.skills/ui-design/SKILL.md` — Microi吾码设计规范
- `microi.skills/microi-ui/SKILL.md` — Microi.UI / MCI-UI
- `microi.skills/microi-form-engine/SKILL.md` — Microi 表单引擎设计
- `microi.skills/microi-form-layout/SKILL.md` — Microi 表单布局分组规范（Tabs vs CollapseGroup）
- `microi.skills/microi-db-schema/SKILL.md` — Microi DB Schema
- `microi.skills/module-engine/SKILL.md` — Microi 模块引擎
- `microi.skills/dos-orm/SKILL.md` — Dos.ORM
- `microi.skills/microi-left-right-layout/SKILL.md` — Microi 左右树表配置规范
- `microi.skills/datasource-engine/SKILL.md` — Microi 数据源引擎
- `microi.skills/job-engine/SKILL.md` — Microi Job 定时与后台任务
- `microi.skills/message-notification/SKILL.md` — Microi 消息通知
- `microi.skills/search-engine/SKILL.md` — Microi SearchEngine
- `microi.skills/report-engine/SKILL.md` — Microi 报表引擎
- `microi.skills/translate-engine/SKILL.md` — Microi TranslateEngine
- `microi.skills/ai-engine/SKILL.md` — Microi AI Engine
- `microi.skills/ai-platform-governance/SKILL.md` — Microi吾码 AI 平台治理中心
- `microi.skills/app-store/SKILL.md` — Microi 应用商城
- `microi.skills/business-blueprint/SKILL.md` — Microi 业务架构蓝图（System Blueprint）
- `microi.skills/microi-system-delivery/SKILL.md` — Microi 全系统交付复盘与总控规范
- `microi.skills/microi-deployment/SKILL.md` — Microi 安装与部署
- `microi.skills/microi-microservice/SKILL.md` — Microi 前端微服务
- `microi.skills/microi-ai-application/SKILL.md` — Microi AI 应用
- `microi.skills/unity-integration/SKILL.md` — Microi Unity 完整交付
- `microi.skills/microi-docs-coverage/SKILL.md` — Microi 中文官网文档与 Skills 覆盖审计
- `microi.skills/microi-solution-quotation/SKILL.md` — Microi吾码解决方案与报价
- `microi.skills/microi-frontend-sdk/SKILL.md` — Microi 前端 SDK
- `microi.skills/microi-uniapp-frontend/SKILL.md` — Microi UniApp 前端通用规范
- `microi.skills/microi-mobile-app-quality/SKILL.md` — Microi 移动端质量门禁
- `microi.skills/microi-datasource-mapping/SKILL.md` — microi-datasource-mapping — 数据源 Key/Value 映射规范
- `microi.skills/v8-formengine-http/SKILL.md` — FormEngine HTTP 路由约定（外部系统调用）
- `microi.skills/v8-explorer-tree/SKILL.md` — v8-explorer-tree — V8 资源管理器目录规范 v2（2026-05）
- `microi.skills/workspace-conventions/SKILL.md` — Microi 工作区全局约定
- `microi.skills/microi-codex-installer/SKILL.md` — Microi吾码 AI 插件与 CLI 安装
- `microi.skills/microi-codex/SKILL.md` — Microi吾码 Codex Plugin
- `microi.skills/production-readonly-audit/SKILL.md` — Microi 正式环境只读业务巡检
- `microi.skills/uniapp-mall-assets/SKILL.md` — Microi UniApp / 商城资源路径规范
- `microi.skills/playwright-e2e/SKILL.md` — Microi 吾码 Playwright E2E 自动化测试
- `microi.skills/performance-testing/SKILL.md` — Microi 高并发性能压力测试

## AI 菜单模块视觉交付门禁（强制）

- 每个可见、绑定表的模块都必须配置紧凑 Hero 标题、业务副标题和 2-4 个真实动态指标。指标优先选择金额、数量、余额、进度、逾期、待处理等业务聚合；没有合适数值字段时使用真实 `DataCount`、`PageCount` 或真实状态分布兜底。禁止随机数、固定演示数、伪统计或只写毫无业务意义的总数。
- 每个列表字段都要按字段语义设置合理 `TableWidth`。PC 复合列必须给足 `MinWidth`，组织主字段、多行副字段、右侧图标/状态，并从普通列中排除已经展示的重复字段，同时保留查询依赖字段。
- 移动端卡片应按真实业务字段设计图片、标题、副标题、顶部标签、右侧金额/状态、内容、Meta 与底部字段；同一字段不得跨区域重复堆叠。
- 菜单动态统计角标只用于少数高价值待办/异常/未读入口；页面多 Tab 和更多 V8 按钮有真实业务计数时也应配置角标。批量角标必须避免 N+1 查询并提供安全降级。
- 模块设计器固定提供“模块标题与统计、PC 复合列、移动端卡片、自定义表单、高级 JSON”五个入口。`EnableViewSchema` 只控制 Detail/Edit 自定义表单；关闭后紧凑标题、动态指标、列表密度、PC 复合列和移动端卡片仍然生效。
- 平台自动生成的 List/Card 与真实数据兜底只是最低保障。AI 交付时仍须根据业务语义主动完善并回读验证，不得因为平台已有默认值而省略设计。
