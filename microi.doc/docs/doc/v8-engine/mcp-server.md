# 🔌 Microi MCP Server 完整指南

Microi MCP Server 让 Codex、GitHub Copilot、Cursor、Claude Code、Trae 等 AI 工具连接真实的 Microi 服务器与 OsClient。它不是只读文档搜索器，也不是绕过权限的万能数据库接口：每个工具围绕平台业务对象设计，继续执行参数校验、当前身份、租户隔离、写入确认、审计与远端回读。

源码随主仓库开放：[GitHub](https://github.com/itdos/microi.net/tree/master/microi.mcp) / [Gitee](https://gitee.com/ITdos/microi.net/tree/master/microi.mcp)。普通用户推荐通过 [VS Code 插件或 CLI](/doc/v8-engine/vs-code-plugin) 使用内置版本，无需单独克隆。

## 当前能力面

按 2026-08-08 当前源码扫描，`microi.mcp/src` 中可识别 **119 个 `microi_*` 工具注册项**。数量会随版本增长，运行时应以 `tools/list`，或 Codex 单入口的 `list_tools` / `describe_tool` 返回为准。

| 类别 | 代表工具 | 作用 |
|---|---|---|
| 连接与发现 | `microi_get_status`、`microi_get_db_schema`、`microi_get_field_list` | 确认服务器、租户、表与字段事实 |
| 表与索引 | `microi_create_table`、`microi_add_field`、`microi_get_table_indexes`、`microi_create_table_index` | 建模、布局、审计字段与物理索引回读 |
| 数据 | `microi_get_table_data`、`microi_add_form_data`、`microi_update_form_data`、`microi_seed_table_data` | 维护租户业务数据 |
| V8 与接口引擎 | `microi_list_engines`、`microi_get_engine_code`、`microi_save_engine_code`、`microi_run_engine` | 读取、版本化保存与远程执行 |
| 表单事件 | `microi_list_events`、`microi_get_event_code`、`microi_save_event_code` | 维护前后端表单 V8 事件 |
| 模块与权限 | `microi_create_module`、`microi_update_module`、`microi_set_role_permission` | 菜单、列、按钮、Tab 与角色授权 |
| Manifest 全系统交付 | `microi_get_manifest_schema`、`microi_plan_system`、`microi_generate_system`、`microi_validate_system` | 从自然语言编排完整低代码系统 |
| 页面与打印 | `microi_build_page_design`、`microi_save_page_design`、`microi_build_print_template_design` | 校验、生成并保存设计 JSON |
| 工作流与任务 | `microi_check_workflow_package`、`microi_test_workflow_condition`、`microi_save_workflow_package`、`microi_save_job` | 流程拓扑、条件测试与调度 |
| 蓝图 | `microi_list_blueprints`、`microi_get_blueprint`、`microi_save_blueprint`、`microi_validate_blueprint` | 读取、维护和验证业务架构 |
| 前端微服务 | `microi_list_applications`、`microi_create_microservice`、`microi_sync_microservice_source`、`microi_publish_microservice` | 创建、同步源码、构建与发布 |
| 应用商城 | `microi_install_store_application`、`microi_update_store_application` | 提交可恢复安装/更新任务 |
| 外部数据库 | `microi_list_database_types`、`microi_inspect_external_database`、`microi_query_external_database`、`microi_execute_external_database` | 结构探测、只读采样与受控高权限执行 |
| 文件迁移 | `microi_import_external_attachment`、`microi_upload_file_base64` | 从 URL、本机/UNC 或 Base64 写入 HDFS |
| Redis / MongoDB 日志 | `microi_redis_*`、`microi_query_mongodb_logs`、`microi_write_mongodb_log` | 诊断和显式确认后的维护 |
| AI、翻译、OCR | `microi_chat`、`microi_translate*`、`microi_ocr_recognize` | 调用当前租户可信配置的服务 |
| 数据库备份 | `microi_list_database_backup_tenants`、`microi_run_database_backup` | 提交带幂等键的持久化备份任务 |
| 访问密钥 | `microi_list_my_access_keys`、`microi_create_my_access_key`、`microi_revoke_my_access_key` | 管理当前用户自己的限期访问密钥 |
| E2E | `microi_get_playwright_context`、`microi_plan_playwright_e2e` | 生成租户绑定的测试上下文和计划 |

## 推荐接入方式

### VS Code 插件

安装 Microi吾码插件后执行：

1. `Microi: 插件配置`，填写服务器与 OsClient。
2. `Microi: 登录`。
3. `Microi: 初始化AI配置`。
4. `Microi: 配置 MCP（AI 工具连接）`。
5. `Microi MCP: 诊断 MCP 可调用性`。

诊断会真实执行 MCP `initialize`、`tools/list` 和状态读取，不只是检查配置文件存在。

### CLI

```bash
npm install -g @microi.net/cli
microi init --pull
microi doctor
```

CLI 与插件共用连接、Token、MCP、Skills、V8 工作区和同步基线。CLI 不保存帐号密码；首次生成 Codex MCP 配置后需要新开对话，已打开的会话通常不会热加载新工具。

### 独立 stdio / SSE

需要自行部署时，`microi.mcp` 支持本地 stdio 与远程 SSE。SSE 适合团队共享，但必须放在受控网络、TLS 和反向代理之后，并绑定服务器端凭据；不要把管理员帐号密码写入公开镜像或前端配置。

## Codex 单入口兼容

部分 Codex 版本不会稳定注入超大工具集。Microi 提供 `microi_codex` 单入口：

```text
action=list_tools
action=describe_tool, params={name:"microi_get_db_schema"}
action=microi_get_db_schema, params={...}
```

单入口只改变协议暴露方式，仍调用原始工具注册与参数 Schema，不会绕过写入确认、审计或远端回读。还可使用 `microi://codex/status`、`microi://codex/tools` 与 action 资源模板做兼容发现。

## 从自然语言生成系统

标准顺序是：

1. `microi_get_db_schema`：读取已有表，避免重复建模。
2. `microi_get_manifest_schema`：获取当前 Manifest 协议与示例。
3. `microi_plan_system`：检查字段、菜单、页面、流程和依赖顺序。
4. `microi_generate_system` + `dryRun:true`：只生成执行计划。
5. 用户确认真实写入范围。
6. `microi_generate_system` + `dryRun:false` + `confirmExecution`：执行。
7. `microi_validate_system`：独立回读表、字段、接口、菜单、页面、打印、流程等结果。

Manifest 支持角色、表、索引、数据源、接口引擎、事件、菜单、权限、页面、打印模板、工作流和任务。常规表单字段不要默认写 `FormWidth=24`；整行控件才使用整行宽度。绑定表的菜单应同时补齐 PC/移动列、搜索列、隐藏列、排序、统计与卡片字段。

## 读取、写入与高风险操作

| 级别 | 示例 | 要求 |
|---|---|---|
| 只读 | 状态、Schema、列表、代码读取 | 仍绑定当前身份、URL 与 OsClient |
| 普通写入 | 保存 V8、字段、模块、页面 | 显式确认；成功后远端回读关键字段 |
| 可执行副作用 | 运行接口/数据源、安装应用、备份 | 使用稳定幂等键，区分排队成功与业务完成 |
| 高权限/破坏性 | 任意外库 SQL、删索引、删 Redis Key | 更高角色门槛、明确目标与专用确认值 |

工具返回 `Code=1` 只代表该次协议调用成功。安装、备份、文件迁移等后台任务还要读取任务状态和最终对象；前端功能还要做真实 PC/移动页面验收。

## 租户与安全边界

- 每次连接绑定 API URL、OsClient、用户身份和网络环境；不要跨连接复用 Token。
- 写工具从当前 Token 解析租户，不能相信模型随意传入的另一个 OsClient。
- 密码、数据库连接串、OCR/AI Key 和对象存储密钥不应出现在工具结果或审计正文。
- `microi_execute_external_database` 等高风险工具只对后端确认的高权限用户开放。
- MCP 的“可点击/可调用”不是最终授权边界，服务端仍执行菜单、表、行和动作权限。
- 超时后的结果不确定时先回读，不要直接重复写入；若返回 `RecoveredAfterTransportError:true`，表示远端状态已经确认。

## 常见问题

### 配置成功但当前对话没有工具

先运行 MCP 诊断；诊断通过后新开 AI 对话或重载客户端。Codex 可先检查 `microi_codex` 单入口与资源模板。

### 能否只安装 CLI，不装 VS Code

可以。自然语言建模、V8、页面、打印、工作流、微服务和回读验收都通过同一 MCP 完成；编辑器资源树、Diff 和逐行断点调试仍是 VS Code 插件的交互能力。

### 为什么不能直接用 SQL 建全部资源

表、字段、菜单、权限、页面和工作流同时包含元数据、缓存、物理结构与兼容规则。标准工具会校验、幂等写入并回读；临时 SQL 容易留下只有物理列、没有 `diy_field` 或菜单显示配置的半成品。

### 如何获得最新工具清单

使用运行时 `tools/list`；Codex 单入口使用 `list_tools`，再对目标工具执行 `describe_tool`。不要长期复制一份静态参数 Schema 到提示词中。
