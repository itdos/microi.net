# 🧭 源码架构与模块地图

Microi吾码不是单一的后台管理模板。完整工程由低代码运行时、Vue 前端、多端客户端、V8 引擎、MCP、VS Code / CLI、Skills、设计系统和发布工具共同组成。

官方主仓库同时维护 [GitHub](https://github.com/itdos/microi.net) 与 [Gitee](https://gitee.com/ITdos/microi.net)。本文按当前源码职责说明每个目录，帮助二次开发者先找到正确扩展点，再决定使用低代码配置、接口引擎、前端源码或后端模块。

## 先判断应该改哪一层

| 需求 | 首选实现位置 | 说明 |
|---|---|---|
| 表、字段、菜单、权限、页面、打印、流程、任务 | 低代码元数据 / 应用商城包 | 可配置、可升级、可跨租户安装，不应先写定制 Controller |
| 业务校验、数据编排、第三方 HTTP、定时业务 | V8 表单事件 / 接口引擎 | 保存即生效，可继续使用 DiyToken、租户、角色和事务上下文 |
| 复杂交互页面 | 界面引擎或前端微服务 | 常规 CRUD 继续复用表单与模块引擎，复杂 UI 才独立开发 |
| 跨端原生交互 | `microi.uniapp` 或 `microi.app` | 原生小程序与 WebView 壳是两条不同技术路线 |
| 协议网关、可信鉴权、运行时内核、存储边界 | C# 后端模块 | 只提供可复用的最小原子能力，业务编排仍优先留在接口引擎 |

## 顶层工程

| 目录 | 技术与职责 | 继续阅读 |
|---|---|---|
| `Microi.Server/` | .NET 10 后端解决方案，包含 API、核心引擎、缓存、文件、消息、AI、OCR、任务与多数据库能力 | 本页“后端项目” |
| `Microi.Client/` | Vue 3 + Vite + Element Plus 管理端；同时承载经典界面、WebOS、移动 Web 页、表单/页面/打印/流程/可视化设计器 | [PC、WebOS 与移动端](/doc/system-engine/multi-end-client) |
| `Microi.UI/` | 跨 Web、UniApp 的 MCI-UI 设计令牌、组件与交付规范 | [吾码 UI](/doc/system-engine/microi-ui) |
| `microi.uniapp/` | uni-app + Vue 3 原生动态小程序/H5/App 基线，支持 Profile 与租户定制隔离 | [PC、WebOS 与移动端](/doc/system-engine/multi-end-client) |
| `microi.app/` | HBuilderX 5+App/Wap2App 壳，把远程 `Microi.Client` 包装为 APK/IPA 并提供 `plus` 原生 API | [PC、WebOS 与移动端](/doc/system-engine/multi-end-client) |
| `microi.mcp/` | TypeScript MCP Server，让 AI 按租户读取结构、生成系统、维护 V8/页面/流程/微服务并回读验收 | [MCP Server](/doc/v8-engine/mcp-server) |
| `microi.skills/` | 面向 AI Agent 的平台规范、工作流和安全边界，避免只知道函数名却不知道正确交付顺序 | [AI 编程](/doc/v8-engine/ai-apiengine) |
| `microi.doc/` | 当前官网与官方文档，VitePress 构建；中文 `docs/doc/` 是维护源 | [平台介绍](/doc/index) |
| `microi.apps/` | 官方应用商城发行包源码：Manifest、接口引擎、资源策略、安装测试与离线包；不是租户前端微应用源码根 | [应用商城](/doc/system-engine/app-store) |
| `数据库、案例、文档、资料/` | 演示库、空库、案例和部署辅助资料；使用前核对版本与目标数据库类型 | [数据库扩展](/doc/system-engine/databases) |

以下两个目录常在完整开发工作区中出现，但用途与主仓库源码不同：

- `Microi.VSCode/` 是 VS Code 插件与 `@microi.net/cli` 的伴随源码仓库，包含同步、远程执行、调试、MCP 打包和 AI 配置生成。详见 [AI 开发工具](/doc/v8-engine/vs-code-plugin)。
- `Microi-V8-Engine/` 通常由插件或 CLI 在本机生成，按服务器与 OsClient 保存接口引擎、事件、数据库快照和同步基线；Web、UniApp、MicroService 的唯一可编辑源码放在对应租户的 `AI应用/{appKey}`。它可能包含本机 Token 或租户代码，不是应整体提交到公开仓库的产品源码目录；只有经过明确白名单审计的官方应用才可单独纳入版本控制。

## 后端项目

`Microi.Server` 当前由下列项目组成。业务入口通常位于 `Microi.net.Api`，领域实现位于 `Microi.net` / `Microi.Core`，其余项目提供可替换的基础能力。

| 项目 | 主要职责 | 对应文档 |
|---|---|---|
| `Microi.net.Api` | ASP.NET Core HTTP 入口、Controller、中间件、后台 Worker、健康与运行诊断 | [安全基线](/doc/more/security) |
| `Microi.net` | 表单、接口、模块、工作流、数据源、应用商城等核心业务运行时 | [系统引擎](/doc/index#核心引擎) |
| `Microi.Core` | 公共接口、模型、租户上下文、FormEngine 基础实现、V8/MCP 领域逻辑 | [表单引擎](/doc/form-engine/form-engine-info) |
| `Microi.AI` | AI 代理、模型订阅、Schema/V8 文档上下文、NL2V8 与系统级 AI 工作流 | [AI 引擎](/doc/system-engine/ai-engine) |
| `Microi.AI/Microi.AI.Tests` | AI 授权门禁、NL2SQL 安全、租户向量隔离、知识上下文与恢复行为测试 | [AI 引擎](/doc/system-engine/ai-engine) |
| `Microi.V8Engine` | V8 扩展注册表以及图片、微信、支付、系统信息等可信扩展 | [后端 V8 函数](/doc/v8-engine/v8-server) |
| `Microi.Cache` | Redis、租户缓存、L1/L2 缓存与 Redis 管理原子能力 | [系统设置](/doc/more/sys-config) |
| `Microi.HDFS` | MinIO、阿里云 OSS、Amazon S3、私有/公有文件与外部对象同步、CAD 转换 | [分布式存储](/doc/more/hdfs) |
| `Microi.Job` | Quartz 任务、接口引擎 Job、监听器与调度注册 | [任务调度](/doc/system-engine/job) |
| `Microi.MongoDB` | MongoDB CRUD、Where 解析与 V8.MongoDb | [后端 V8 函数](/doc/v8-engine/v8-server#v8-mongodb) |
| `Microi.MQ` | RabbitMQ 连接、发布、消费与 V8.MQ | [消息队列](/doc/system-engine/mq) |
| `Microi.MQTT` | MQTT 服务端/客户端事件与 IoT 消息入口 | [MQTT 引擎](/doc/system-engine/mqtt-engine) |
| `Microi.SearchEngine` | Elasticsearch 查询、排序、索引帮助器 | [搜索引擎](/doc/system-engine/search-engine) |
| `Microi.Spider` | 采集任务与浏览器 Worker 的后端协调 | [采集引擎](/doc/system-engine/spider-engine) |
| `Microi.Office` | Excel、Word、PowerPoint、邮件与模板导出 | [Office](/doc/more/office) |
| `Microi.OCR` | 租户绑定的 OCR 网关，模型服务地址与密钥保留在可信后端 | [OCR 与 V8.OCR](/doc/v8-engine/v8-server#v8-ocr) |
| `Microi.Captcha` | 登录验证码生成与可选识别适配 | [安全基线](/doc/more/security) |
| `Microi.WeChat` | 公众号、小程序、模板消息等微信能力 | [消息通知](/doc/system-engine/message-notification) |
| `Microi.Upgrade` | 应用商城运行前必需的物理兼容、协议与核心种子升级 | [应用商城](/doc/system-engine/app-store) |
| `Dos.ORM` | 自研多数据库 ORM、SQL 编译、参数与数据库兼容层 | [Dos.ORM](/doc/more/dos-orm) |
| `Dos.Common` | 加密、序列化、HTTP 参数、运行诊断等通用基础库 | [DosResult](/doc/more/dos-result) |
| `Microi.Tests` | 后端安全、兼容、升级、分布式与全栈发布门禁测试 | [源码本地运行](/doc/getting-started/local-run#后端自动化测试与发布门禁) |
| `tools/Microi.DatabaseSeedConverter` | 多数据库种子与资源转换工具 | [数据库扩展](/doc/system-engine/databases) |
| `tools/SysLogQueueLoadTest` | 系统日志异步队列的受控压力测试工具 | [源码本地运行](/doc/getting-started/local-run) |

## `Microi.Client` 功能入口

| 源码区域 | 作用 |
|---|---|
| `src/views/form-engine/` | 动态表单、表格、字段设计器、全部表单控件和 V8 事件宿主 |
| `src/views/page-engine/`、`print-engine/` | 页面与打印设计/渲染 |
| `src/views/workflow/` | 审批工作流 v4 |
| `src/views/ai-workflow/`、`blueprint/`、`state-machine/`、`flow-engine/`、`process-mining/` | AI 工作流、业务蓝图、数据状态机、自动化流与流程分析 |
| `src/views/micro-app/` | 前端微服务宿主、认证与路由桥 |
| `src/views/go-view/`、`3d-engine/`、`cad-preview/` | 数据大屏、Three.js 场景与 CAD 预览 |
| `src/views/webos/` | macOS / Windows 风格桌面、Dock、小组件和应用容器；缺少该可选目录时自动回退经典界面 |
| `src/views/mobile/` | 同一 Web 工程内的移动工作台、消息、聊天、AI 助手和个人中心 |
| `src/views/file-manage/` | 文件管理、预览、CAD 转换结果与对象存储交互 |
| `src/utils/diy.common.js` | 前端 V8、FormEngine、HTTP、客户端类型与平台公共能力的主要适配入口 |

## MCP、插件、CLI 与 Skills 的关系

| 层 | 负责什么 | 不负责什么 |
|---|---|---|
| MCP | 当前服务器/OsClient 的实时读取、受控写入、确认、审计与远端回读 | 不替代业务权限，也不把任意 SQL/V8 当成万能写口 |
| VS Code 插件 | 资源树、编辑器 Diff、同步、远程执行、逐行调试、MCP 生命周期与可视化命令 | 不另建一套 Token 或业务模型 |
| CLI | 无 IDE 场景下的连接、登录、AI/MCP 初始化、同步与诊断 | 不复制 VS Code 的断点调试 UI |
| Skills | 告诉 AI 正确的实现层、调用顺序、安全约束和验收标准 | 不作为数据库、服务器或运行状态的事实源 |

典型 AI 交付链路是：先通过 MCP 读取真实结构，再让 Skills 约束方案，生成 dry-run 计划；用户确认后写入，并以远端回读与真实页面验收收尾。

## 二次开发边界

1. DiyToken 始终是平台会话与权限入口；新增登录方式在验证成功后仍签发 DiyToken。
2. `OsClient`、服务器地址和连接身份必须绑定，不能把另一个租户的结构或 Token 当成当前事实。
3. 后端业务配置进入 SaaS 引擎；API 容器只保留规定的启动引导配置。
4. 多节点部署下，任务唯一性、幂等、进度与租约进入共享 Redis/数据库，不能依赖本机静态变量。
5. 修改共享服务前先确认端口、PID、命令行和工作区归属，不能批量结束所有 Node、dotnet 或浏览器进程。
6. 源码测试、构建、部署、在线回读与 PC/移动真机验收是不同证据，应分别报告。

## 建议阅读顺序

1. [源码本地运行](/doc/getting-started/local-run)
2. [表单引擎](/doc/form-engine/form-engine-info) 与 [接口引擎](/doc/v8-engine/api-engine)
3. [MCP Server](/doc/v8-engine/mcp-server) 与 [AI 开发工具](/doc/v8-engine/vs-code-plugin)
4. [AI 工作流、蓝图与状态机](/doc/system-engine/ai-workflow-suite)
5. [PC、WebOS 与移动端](/doc/system-engine/multi-end-client)
6. [3D、CAD 与数据大屏](/doc/system-engine/visualization-engine)
