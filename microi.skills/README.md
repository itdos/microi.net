# Microi Skills

**Microi 吾码项目级 AI 编程技能集合** — 让 AI 在低代码建模、V8 接口引擎、表单事件、PC 前端、UniApp/H5/小程序、Microi.UI、自动化测试和系统交付中自动遵循最佳实践。

> Skills 是一系列结构化指令文件（SKILL.md），告诉 AI 工具在特定场景下**应该如何写代码、如何建模、如何设计界面、如何测试验收**。每个 Skill 覆盖一个明确场景，包含 API 用法、代码模板、设计约束、质量门禁和安全规范。

---

## 包含的 Skills

当前仓库包含 58 个 `SKILL.md`。以下清单按任务类型组织；AI 必须先完整读取与当前任务匹配的 Skill，再执行源码、MCP、文档或交付操作。

### V8 引擎核心（后端）

| Skill | 场景 | 文件 |
|-------|------|------|
| **v8-crud-api** | 接口引擎增删改查 | `v8-crud-api/SKILL.md` |
| **v8-sql-query** | 安全的 SQL 查询（参数化、_Where 语法、事务） | `v8-sql-query/SKILL.md` |
| **v8-table-event** | 表单 V8 事件（提交前/后、DataFilter） | `v8-table-event/SKILL.md` |
| **v8-cache-pattern** | Redis 缓存模式（L1+L2、Key 命名、防穿透） | `v8-cache-pattern/SKILL.md` |
| **v8-http-integration** | 调用外部 HTTP API（含下载/上传） | `v8-http-integration/SKILL.md` |
| **v8-mongodb** | MongoDB 增删改查（IoT、审计日志） | `v8-mongodb/SKILL.md` |
| **v8-mq-mqtt** | RabbitMQ 消息队列与 MQTT 物联网 | `v8-mq-mqtt/SKILL.md` |
| **v8-workflow** | 工作流（审批流程）V8 事件 | `v8-workflow/SKILL.md` |
| **v8-api-config** | 接口引擎配置（匿名/锁/StopHttp/响应文件） | `v8-api-config/SKILL.md` |
| **v8-saas-multi-tenant** | SaaS 多租户（OsClient/OsClientModel） | `v8-saas-multi-tenant/SKILL.md` |
| **v8-image-processing** | 服务端图片生成、合并、覆盖、水印、缩放、裁剪、绘制与二维码 | `v8-image-processing/SKILL.md` |
| **v8-file-upload** | 文件上传/下载/响应（HDFS、私有桶 URL） | `v8-file-upload/SKILL.md` |
| **v8-export-import** | Excel 自定义导入导出（含进度跟踪） | `v8-export-import/SKILL.md` |
| **v8-debugging** | 调试模式、异常捕获、系统日志 | `v8-debugging/SKILL.md` |
| **v8-security** | 安全最佳实践（权限/输入验证/防注入） | `v8-security/SKILL.md` |
| **v8-utilities** | 前后端 V8 上下文、通用函数、扫码、消息、Base64、加密和专项 API 索引 | `v8-utilities/SKILL.md` |
| **ocr-engine** | 通用 OCR 网关、SaaS 配置、PaddleX 服务与多节点验收 | `ocr-engine/SKILL.md` |
| **spider-engine** | 爬虫/浏览器采集 Worker、会话、目标地址、配额与交付边界 | `spider-engine/SKILL.md` |

### V8 引擎核心（前端）

| Skill | 场景 | 文件 |
|-------|------|------|
| **v8-frontend-events** | 前端字段/按钮/列表事件（FieldValueChange 等） | `v8-frontend-events/SKILL.md` |
| **v8-template-engine** | 表格/表单 V8 模板（HTML 渲染、徽章、图片列） | `v8-template-engine/SKILL.md` |
| **v8-menu-buttons** | 菜单按钮 / Tab / 批量操作 JSON | `v8-menu-buttons/SKILL.md` |
| **microi-client-frontend** | `Microi.Client` 前台源码架构、表单引擎、动态按钮和工作流修改指南 | `microi-client-frontend/SKILL.md` |

### 引擎模块

| Skill | 场景 | 文件 |
|-------|------|------|
| **page-engine** | 界面引擎页面 JSON 生成 | `page-engine/SKILL.md` |
| **print-engine** | 打印引擎模板 JSON 生成 | `print-engine/SKILL.md` |
| **ui-design** | Microi吾码设计规范（阴影/动效/主题/性能） | `ui-design/SKILL.md` |
| **microi-ui** | 吾码UI（Microi.UI / MCI-UI）组件库、主题 palette、圆角/扁平、Web/UniApp 用法 | `microi-ui/SKILL.md` |
| **microi-form-engine** | 表单设计器、字段组件、数据源、事件和物理类型 | `microi-form-engine/SKILL.md` |
| **microi-form-layout** | 表单布局分组规范：Tabs vs CollapseGroup 决策、字段数阈值、回读验收 | `microi-form-layout/SKILL.md` |
| **microi-db-schema** | 数据库字典、核心表关系、字段归属与 V8 配置存储位置 | `microi-db-schema/SKILL.md` |
| **module-engine** | sys_menu 菜单模块、查询列、打开方式、ViewSchema 和多表查询 | `module-engine/SKILL.md` |
| **dos-orm** | Dos.ORM 实体、查询、事务、Provider、批量写入与 CodeFirst | `dos-orm/SKILL.md` |
| **microi-left-right-layout** | 模块引擎“树形+表格/表单”左右布局与主外键过滤 | `microi-left-right-layout/SKILL.md` |
| **datasource-engine** | SQL/V8/JSON 数据源设计、租户与权限、字段供数和验收 | `datasource-engine/SKILL.md` |
| **job-engine** | 定时/后台任务、多节点租约、幂等、恢复和进度 | `job-engine/SKILL.md` |
| **message-notification** | 公众号/服务号、短信、邮件、平台内部通知、SignalR、幂等与商城交付 | `message-notification/SKILL.md` |
| **search-engine** | Elasticsearch 索引、同步、查询、租户/数据范围和重建 | `search-engine/SKILL.md` |
| **report-engine** | Rpt_Report 虚拟报表、数据源、聚合、写接口和导出 | `report-engine/SKILL.md` |
| **translate-engine** | 多语言词条、翻译供应商、租户隔离、缓存和批量翻译 | `translate-engine/SKILL.md` |
| **ai-engine** | 模型代理、NL2SQL/NL2V8、Schema/Skill 关键词检索与可选向量融合 | `ai-engine/SKILL.md` |
| **app-store** | 应用包、Manifest、后台安装、差异升级、回滚和验收 | `app-store/SKILL.md` |

### 项目交付、前端与移动端

| Skill | 场景 | 文件 |
|-------|------|------|
| **business-blueprint** | 从需求生成业务蓝图、模块边界、数据模型与接口清单 | `business-blueprint/SKILL.md` |
| **microi-system-delivery** | 自然语言到完整系统交付的总控、MCP 编排、验收和复盘 | `microi-system-delivery/SKILL.md` |
| **microi-deployment** | Docker/Windows/源码部署、配置、升级和多节点运行验收 | `microi-deployment/SKILL.md` |
| **microi-microservice** | 前端微服务/微应用源码、路由、发布、宿主上下文和运行时交付 | `microi-microservice/SKILL.md` |
| **microi-ai-application** | Web、MicroService、UniApp、H5 与游戏类 AI 应用的 Vue 3 + Vite + TypeScript 默认架构、迁移和质量门 | `microi-ai-application/SKILL.md` |
| **microi-docs-coverage** | 中文官网文档到 Skills 的能力映射、V8 API 漏项审计和同步流程 | `microi-docs-coverage/SKILL.md` |
| **microi-solution-quotation** | 生成紧凑的一页式 Microi吾码解决方案、市场预估价、优惠报价与开发周期 Word | `microi-solution-quotation/SKILL.md` |
| **microi-frontend-sdk** | Vue3/UniApp/H5/PC 前端统一 SDK、Token终端会话/续签、上传、资源 URL、ApiEngine/FormEngine | `microi-frontend-sdk/SKILL.md` |
| **microi-uniapp-frontend** | Microi UniApp/H5 通用前端规范、安全区、资源解析、骨架屏、主题与页面质量 | `microi-uniapp-frontend/SKILL.md` |
| **microi-mobile-app-quality** | 移动端质量门禁：登录、验证码、图标、菜单层级、主题、动效、截图验收 | `microi-mobile-app-quality/SKILL.md` |
| **microi-datasource-mapping** | 数据源 Key/Value 映射、下拉枚举与前后端显示值一致性 | `microi-datasource-mapping/SKILL.md` |
| **v8-formengine-http** | 移动端/外部系统直接调用 FormEngine HTTP 路由的约定 | `v8-formengine-http/SKILL.md` |
| **v8-explorer-tree** | VS Code 插件 V8 资源管理器目录规范和本地文件归档 | `v8-explorer-tree/SKILL.md` |
| **workspace-conventions** | 工作区文件放置、临时产物、项目专属目录和根目录污染防护 | `workspace-conventions/SKILL.md` |
| **production-readonly-audit** | 正式环境只读巡检，不改动线上数据的业务核对流程 | `production-readonly-audit/SKILL.md` |
| **uniapp-mall-assets** | UniApp/H5/商城上传资源、FileServer、私有临时 URL 与富文本安全 | `uniapp-mall-assets/SKILL.md` |

### 自动化测试

| Skill | 场景 | 文件 |
|-------|------|------|
| **playwright-e2e** | Playwright 端到端自动化测试、接口引擎断言、冒烟验收与 CI | `playwright-e2e/SKILL.md` |
| **performance-testing** | 接口引擎、V8事件、FormEngine CRUD 高并发性能压力测试与报告 | `performance-testing/SKILL.md` |

---

## 快速开始：如何使用 Skills

### 推荐：VS Code 插件零配置安装

安装 Microi 吾码 VS Code 插件后，在工作区执行初始化/拉取。插件会安装当前版本的完整 `microi.skills`，并为 Codex、GitHub Copilot、Claude Code、Cursor 等生成 `AGENTS.md`、`.github/copilot-instructions.md`、`CLAUDE.md` 和 Cursor rules；不需要手工维护 56 条 Skill 引用。

插件升级采用清单和内容哈希做差异更新：未被用户修改的官方 Skill 自动升级，用户已经修改的文件不被整文件覆盖，新增 Skill 自动补齐。发布插件时必须比对源 Skills、插件 `dist`、VSIX 和空工作区初始化产物的相对路径与 SHA-256，不能只检查文件数量。

随后按需连接 Microi MCP：MCP 提供实时表结构、接口引擎、菜单和应用源码上下文；Skills 提供设计、安全、编码与验收规则；VS Code 插件提供类型、资源树和上下文生成。三者组合才是推荐的 AI 零代码开发路径。

### 备用：手工获取 Skills

```bash
git clone https://gitee.com/ITdos/microi.net.git
```

将源码中的 `microi.skills` 文件夹放到工作区根目录。也可使用 Git sparse-checkout 只获取该目录。

### 手工配置 AI 工具加载 Skills

根据你使用的 AI 工具，选择对应的配置方式：

> 手工配置仅是插件不可用时的备用方案。不要把全部 Skill 内容拼接到单个规则文件；保留独立文件并按任务路由读取，可避免超长上下文、重复规则和版本漂移。

---

### GitHub Copilot（VS Code）

**方式 A：通过 `.github/copilot-instructions.md` 全局引用（推荐）**

在项目根目录的 `.github/copilot-instructions.md` 文件末尾追加：

```markdown
## Microi 项目技能规范

处理 Microi 低代码系统、V8 引擎、PC 前端、UniApp/H5/小程序、Microi.UI、MCP 建模、自动化测试或交付时，参考以下技能文件：
- microi.skills/v8-crud-api/SKILL.md — 增删改查
- microi.skills/v8-table-event/SKILL.md — 表单事件
- microi.skills/v8-sql-query/SKILL.md — SQL 查询
- microi.skills/v8-http-integration/SKILL.md — HTTP 集成
- microi.skills/v8-cache-pattern/SKILL.md — Redis 缓存
- microi.skills/v8-security/SKILL.md — 安全规范
```

> Copilot 会自动将这些 Skill 作为上下文注入到每次对话中。

**方式 B：在对话中按需引用**

```
@workspace 参考 microi.skills/v8-crud-api/SKILL.md 帮我写一个用户管理的接口引擎
```

---

### Cursor

**方式 A：在 `.cursor/rules/` 目录中添加规则文件（推荐）**

在项目根目录创建 `.cursor/rules/microi-skills.mdc`：

```
---
description: Microi 项目技能规范
globs: ["microi-v8-engine/**/*.js", "Microi.Client/**/*.{vue,js,ts,css,scss}", "microi.uniapp/**/*.{vue,js,ts,css,scss,json}", "AI-Project/**/*.{vue,js,ts,css,scss,json,md}", "Microi.UI/**/*.{vue,js,ts,css,scss,md}", "microi.skills/**/*.md"]
---

处理 Microi 项目时，按任务类型参考以下技能文件获取 API 用法、界面规范和验收门禁：
- @microi.skills/v8-crud-api/SKILL.md
- @microi.skills/v8-table-event/SKILL.md
- @microi.skills/v8-sql-query/SKILL.md
- @microi.skills/v8-http-integration/SKILL.md
- @microi.skills/v8-cache-pattern/SKILL.md
- @microi.skills/v8-security/SKILL.md
- @microi.skills/microi-ui/SKILL.md
- @microi.skills/microi-uniapp-frontend/SKILL.md
- @microi.skills/microi-mobile-app-quality/SKILL.md
- @microi.skills/microi-system-delivery/SKILL.md
```

> Cursor 会在匹配 `microi-v8-engine/**/*.js` 的文件中自动加载这些规则。

**方式 B：合并到 `.cursorrules`**

```bash
for f in microi.skills/*/SKILL.md; do
  echo -e "\n---\n" >> .cursorrules
  cat "$f" >> .cursorrules
done
```

---

### Claude Code

**方式 A：添加到 `CLAUDE.md`（推荐）**

在项目根目录的 `CLAUDE.md` 中追加：

```markdown
## Microi 项目 Skills

处理 Microi 项目时，按任务类型参阅以下文件：
- microi.skills/v8-crud-api/SKILL.md
- microi.skills/v8-table-event/SKILL.md
- microi.skills/v8-sql-query/SKILL.md
- microi.skills/v8-http-integration/SKILL.md
- microi.skills/v8-cache-pattern/SKILL.md
- microi.skills/v8-security/SKILL.md
- microi.skills/microi-ui/SKILL.md
- microi.skills/microi-uniapp-frontend/SKILL.md
- microi.skills/microi-mobile-app-quality/SKILL.md
- microi.skills/microi-system-delivery/SKILL.md
```

**方式 B：批量追加内容到 `CLAUDE.md`**

```bash
for f in microi.skills/*/SKILL.md; do
  echo -e "\n---\n" >> CLAUDE.md
  cat "$f" >> CLAUDE.md
done
```

---

## 安全与兼容底线

- 浏览器 FormEngine 请求优先携带真实 `_SysMenuId`；历史无菜单调用由后端从用户真实菜单缓存安全推断，后端可信 V8 不要求 `_SysMenuId`。
- `_InvokeType: 'Client'` 会触发表单 V8 事件，不是授权标记，也不能用来“避免递归”。
- 平台保护表和控制面 API 只允许 `Level >= 9999`；普通角色的表权限不能绕过该基线。
- 多租户、文件、Redis、MQ、对象存储和搜索能力必须由服务端绑定当前 `OsClient`。
- `setTimeout`、`Task.Run` 和进程内静态状态不能承担可靠后台任务或集群锁。
- 上传上限由平台默认值和 `sys_osclients` 租户配置共同约束；私有文件的浏览器访问必须绑定菜单、记录、字段和附件。
- CORS 未配置时为兼容历史默认允许 `*`，配置后才按租户域名收紧；SSRF 严格模式默认关闭，启用后按精确主机白名单放行。
- MCP 写入前先读取实时 schema/manifest，写后回读；超时先回读确认，不得立即重复创建。

---

## 使用效果示例

配置 Skills 后，AI 对话中的代码生成质量会显著提升：

**没有 Skills 时：**
```
你：帮我写一个分页查询用户列表的接口引擎
AI：（可能写出不用 _Where 参数化、没有 try-catch、没有权限校验的代码）
```

**有 Skills 时：**
```
你：帮我写一个分页查询用户列表的接口引擎
AI：参考 v8-crud-api Skill，生成完整代码：
    ✅ 使用 V8.FormEngine.GetTableData + _Where 参数化查询
    ✅ 包含分页参数校验
    ✅ 使用 V8.CurrentUser 做权限校验
    ✅ 规范的 V8.Result 返回格式
```

---

## 与 VS Code 插件 / MCP 的关系

| 方案 | 覆盖内容 | 适用场景 |
|------|---------|---------|
| **VS Code 插件** | V8 全部 API 知识 + 数据库表结构 + 代码补全 | 日常开发，自动化 |
| **MCP Server** | 实时查询数据、远程执行引擎 | AI 实时操作平台 |
| **Skills**（本项目） | 具体场景的编码最佳实践和代码模板 | 进阶模式，深度指导 |

> 💡 推荐三者搭配使用：插件提供 API 知识和表结构 → MCP 提供实时数据查询 → Skills 提供编码最佳实践。

## License

MIT

## 关键路由提示

- 独立 PC/H5/UniApp 前端：先读 `microi-frontend-sdk`，再读对应端的 UI/质量 Skill。
- 表单字段较多时：先读 `microi-form-layout`。默认优先使用 `diy_table.Tabs + diy_field.Tab` 做业务域分组，局部复杂区域再用 `CollapseGroup` 或字段级 `Tabs`。
- 树形+表格/表单：使用 `microi-left-right-layout`。
- 跨模块完整交付：从 `business-blueprint` 进入，由 `microi-system-delivery` 总控，并把 `v8-security`、`microi-db-schema` 和自动化验收作为强制门禁。
