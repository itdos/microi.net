<div align="center">

<img src="https://static.itdos.com/upload/img/microi-red-256.png" alt="Microi吾码" width="120" />

# Microi 吾码

<p class="mci-doc-home-subtitle"><strong>不只是开源 AI 低代码，更是企业级 AI 应用开发框架：</strong>可视化建模、V8 在线编程、.NET / Vue 源码扩展与 AI Agent 共用一条交付链。</p>

<p><a href="https://blog.csdn.net/qq973702/article/details/163763831" target="_blank" rel="noopener noreferrer">阅读门头文章：为什么 AI 开发的 Token 和交付时间，能同时降一个数量级？ →</a></p>

<p style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px;">
  <img src="https://static.itdos.com/upload/img/NET-10.svg" alt=".NET 10" />
  <img src="https://static.itdos.com/upload/img/Vue-2_3-4FC08D.svg" alt="Vue 2 与 Vue 3" />
  <img src="https://static.itdos.com/openclaw/preview/license-MIT-orange.svg" alt="MIT 开源协议" />
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank"><img src="https://static.itdos.com/openclaw/preview/QQ交流群-51050055-12B7F5.svg" alt="加入吾码 QQ 交流群" /></a>
</p>

🔥 AI 本地 V8引擎 编程（VS Code Copilot / Cursor / Claude + MCP + Skills）、AI 在线编程、AI 数据分析<br>
.NET10 + Vue3 + 跨数据库 / 跨平台，分布式架构、高性能（L1/L2级缓存）、开源可控、多端统一

[官网](https://microi.net/) · [GitHub](https://github.com/itdos/microi.net) · [Gitee](https://gitee.com/ITdos/microi.net) · [吾码UI](/doc/system-engine/microi-ui) · [OpenClaw 吾码小龙虾](https://gitee.com/microi-net/microi.openclaw)

</div>

---

<MciNugetStats variant="feature" />

## Microi吾码 AI平台 架构图

[![Microi吾码 AI平台 架构图](/images/microi-ai-platform-architecture.svg)](/images/microi-ai-platform-architecture.svg)

> 点击图片可在弹层中放大、缩小和拖动查看。图中治理控制面覆盖门户、身份权限、配置、功能开关、发布审批与执行、服务流量、Trace、日志生命周期、可观测告警、组件资产、页面源码桥接、协作与可恢复导入，详见 [AI 平台治理中心](/doc/system-engine/ai-platform-governance)。

### 架构能力全景（可检索文本）

> SVG 负责展示整体关系；下面的同步索引由同一份架构能力数据自动生成，便于新用户、搜索引擎和 AI 完整识别平台边界。

<!-- MICROI_ARCHITECTURE_CAPABILITIES:START -->
<!-- capability-source-sha256:948e503e69a80ed5249356d9438cdec52564c67dff31946f34d68b1ecd15d36b -->
| 架构层 | 核心职责 | 关键能力 |
|---|---|---|
| **AI 智能与设计控制面** | 理解需求、设计系统、生成并校验变更 | 多模型网关、RAG、NL2SQL / NL2V8、Agent / Tool Calling、MCP / Skills、业务架构蓝图、AI Workflow、Manifest、Preview / Diff |
| **低代码与多端体验层** | 建模业务并交付 PC、WebOS、移动端和微应用 | 表单、模块、界面、工作流、打印、报表、Microi.UI、前端微服务、UniApp / App、Unity / WebGL |
| **V8 运行与集成核心** | 在线运行可信业务逻辑并连接平台原子能力 | 接口引擎、FormEngine、数据源、Dos.ORM、HTTP、Redis、MongoDB、MQ / MQTT、Office / OCR、Webhook / SignalR |
| **AI 平台治理中心** | 治理门户、身份、配置、发布和跨资源变更 | 门户项目、身份连接器、动态用户组、配置模板、Feature Flag、灰度发布、不可变审批、断点续发、条件回滚 |
| **企业可靠性与安全底座** | 保障多租户、多节点、安全、观测和恢复 | OsClient 隔离、DiyToken、Passkey / TOTP、分布式租约、幂等、Outbox / Inbox、Trace / 日志 / 告警、健康检查、Docker / K8s |
| **工程与交付生态** | 把开发、测试、升级、文档和 AI 协作连成闭环 | Microi.VSCode、Codex / OpenClaw、MCP、Skills、应用商城、Managed / CreateIfMissing、自动化测试、浏览器回读、官方文档 |

**AI 交付链路：** 自然语言 → 业务蓝图 → Manifest → DryRun → 确认执行 → 自动校验 → 真实回读 → 安全回滚

<details>
<summary>查看架构图完整功能索引（253 个唯一标签）</summary>

- **平台价值：** 10×+、Token 更省、10×+、典型交付更快、20+、成熟引擎复用、在线生效、V8 无需编译发布
- **全端入口：** PC 管理端、Vue 3、WebOS、桌面多任务、移动自适应、H5 / 触控、UniApp / App、Android / iOS、微信小程序、多端复用、AI 应用 / Agent、Web / UniApp、前端微服务、多页路由、Microi.VSCode、资源树 / 调试、MCP / Skills、Codex / OpenClaw、OpenAPI / SDK、HTTP / JS
- **AI 智能与设计控制面：** 多模型网关、智能模型路由、密钥隔离、Token 统计、流式对话、多模态输入、知识库 RAG、向量检索、NL2SQL、NL2V8、Agent、Tool Calling、MCP 编排、Skills、Prompt 模板、上下文记忆、AI 应用工作台、在线源码、业务架构蓝图、系统关系图谱、AI Workflow、状态机、Automation Flow、流程挖掘、Manifest 建模、解决方案规划、影响面分析、代码生成、测试计划生成、AI 辅助调试、根因诊断、Preview / Diff
- **低代码与多端体验引擎：** 表单引擎、40+ 控件、Tabs / 分组、栅格布局、主子表、关联表单、字段 V8 事件、表单 V8 事件、数据过滤、模块引擎、列表 / 搜索、统计 / 角标、PC 复合列、移动卡片、左右树表、界面引擎、JSON ↔ Vue、源码预览、Undo / Redo、页面版本、语义 Diff、Microi.UI / 物料、资产依赖、打印引擎、报表引擎、审批流 v4、模板引擎、Office / 蓝牙打印、图表 / 地图 / 甘特、Unity / WebGL、3D / CAD / 大屏、前端微服务
- **AI 平台治理中心：** 门户项目、命名插槽、统一资产、不可变快照、原子发布、运行解析、身份连接器、SCIM 同步、增量游标、冲突重放、动态用户组、用户标签、人群圈选、批量授权、权限解释、临时权限、组织快照、配置模板、配置继承、Secret 引用、配置漂移、Feature Flag、稳定灰度、发布时间窗、发布计划、计划哈希、不可变审批、职责分离、自动门禁、断点续发、条件回滚、跨资源变更集
- **服务、观测与可靠运行：** 服务注册、实例心跳、共享租约、优雅排空、版本 / 区域、标签 / 权重、稳定路由、限流许可、熔断反馈、重试 / 降级、服务拓扑、W3C Trace、Span 时间线、日志信号、告警规则、窗口评估、去重 / 抑制、自动恢复、值班排班、升级链、Outbox 送达、热 / 温 / 冷、留存 / 配额、脱敏规则、法律保留、归档证明、导入预检、暂存行修正、检查点 / 栅栏、暂停 / 恢复、条件回滚、协作租约
- **V8 运行与集成核心：** 接口引擎、保存即生效、FormEngine、CRUD / _Where、DataSource、SQL / API / JSON、Db / Dos.ORM、多数据库、HTTP、GET / POST / PATCH、Redis Cache、TTL / Hash、MongoDB、文档数据、Search Engine、索引 / 检索、Job / Quartz、可靠后台任务、Spider Engine、采集 / 浏览器、MQ / RabbitMQ、Outbox / Inbox、MQTT / IoT、设备事件、Files / HDFS、流式资产、Office、Excel / Word / PPT、OCR / Image、识别 / 图像处理、Translate、翻译 / 多语言、Message Engine、站内 / 多通道、AI / Agent、模型 / 工具、Template、HTML / 文档、Webhook / SignalR、实时集成、事务、权限、多租户、多节点
- **统一治理与交付闭环：** Plan / DryRun、Confirm / Apply、Validate / Readback、Version / Hash、Audit / Trace、Rollback / Recover、Managed Core、Tenant Hook、OsClient 隔离、共享状态、稳定幂等、失败关闭
- **数据与存储底座：** MySQL、SQL Server、Oracle、PostgreSQL、达梦、金仓、Redis、MongoDB、Elasticsearch、MinIO / HDFS
- **身份、安全与多租户：** SaaS / OsClient、DiyToken、角色 / 部门、菜单 / 表权限、行 / 字段权限、Access Key、Passkey / TOTP、SSO / OAuth、强身份票据、认证加密
- **分布式运行底座：** 多节点 API、Worker 集群、分布式租约、Fencing Token、幂等 / 唯一约束、Outbox / Inbox、WAL / Spool、重启恢复、健康检查、Docker / K8s
- **工程、生态与交付：** 应用商城、Managed、CreateIfMissing、MCP、Microi.VSCode、CLI / Plugins、Skills、官方文档、自动化测试、浏览器回读
- **AI 交付流水线：** 自然语言、业务蓝图、Manifest、DryRun、确认执行、自动校验、真实回读、安全回滚

</details>
<!-- MICROI_ARCHITECTURE_CAPABILITIES:END -->

## 📖 平台简介

**Microi吾码** 是面向中大型企业应用的**开源 AI 应用开发平台与开发框架**。它保留低代码快速建模的效率，同时通过 V8 在线编程、前端微服务和 .NET / Vue 源码扩展覆盖差异化与深层开发；VS Code 插件、MCP 与 Skills 会把平台 API、业务代码和数据库结构交给 AI，使低代码开发者、专业开发者与 AI Agent 在同一套工程和治理体系中协作。平台始于 2014 年（基于 Avalon.js），2018 年使用 Vue 重构，历经多年打磨，于 **2025 年正式开源**。

强大的 [**API 接口引擎**](https://microi.net/doc/v8-engine/api-engine)，在线使用 JavaScript 编写后端 API 接口，支持[**在线 AI 编程**](https://microi.net/doc/v8-engine/ai-apiengine)与[**本地 AI 编程（VS Code 插件）**](https://microi.net/doc/v8-engine/ai-apiengine#模式二-本地-ai-编程vs-code-插件)。

## Microi吾码平台能力全景

下面按产品能力归纳 Microi吾码的核心底座；架构图给出层级关系，详细文档给出配置、开发和验收方法。

| 概览 | 说明 |
|---|---|
| **持续演进** | 平台始于 2014 年，已有 10+ 年持续产品演进；提供 20+ 核心系统引擎，支持自然语言建模、代码生成与可审计交付，并采用 MIT 开放源码协议。 |
| **AI 编程、数据分析** | VS Code 插件一键拉取业务代码与数据库结构，并为 VS Code / Codex / Copilot / Claude / Cursor 提供 V8、Schema、MCP 和 Skills 上下文；AI 生成业务模型、配置及少量 V8 / 前端扩展，保存后可远程执行、调试和回读。AI 数据分析默认使用大模型关键词扩展、权限感知 Schema 搜索与精确字段回读，向量数据库作为可选增强；同时支持模型、训练、微调和提示词管理，并可接入 OpenClaw 远程 Agent。 |
| **API 接口引擎** | 在线使用 JavaScript 编写后端 API 接口，支持 AI 在线编程 + VS Code 本地 AI 编程。无需编译发布，保存即生效；支持 Get、Post 请求，支持返回 JSON、字符串、文件、HTML 等，并支持自定义接口地址、分布式锁、权限、自定义扩展函数。 |
| **系统引擎** | AI 引擎、V8 引擎、表单引擎、接口引擎、界面引擎、打印引擎、工作流引擎、Office 引擎、模块引擎、模板引擎、采集引擎、调度引擎、数据源引擎、SaaS 引擎、搜索引擎、消息队列引擎、IoT 物联网 MQTT 引擎、报表引擎、3D 引擎、goView 数据大屏、定制组件、应用商城、多数据库扩展、微服务、任务调度、自定义导出模板、单点登录、聊天系统、公众号平台管理等。 |
| **分布式架构** | 支持 Docker、K8S、Jenkins、Rancher、CI/CD、RabbitMQ、Redis 分布式缓存、ElasticSearch、MongoDB、OSS / MinIO / Amazon S3 分布式存储及分布式任务调度；所有系统引擎均按分布式部署设计。 |
| **跨平台、跨数据库、跨语言** | 支持 Linux、Windows、国产操作系统、主流云和本地化部署；支持 MySQL、SQL Server、Oracle、PostgreSQL、达梦、人大金仓等数据库，以及分库分表、读写分离与多主同步，精确版本以部署文档为准；通过 OpenAPI、SDK 与 gRPC 支持多语言二次开发。 |
| **无限制与开放能力** | 不限制用户数、表单数、数据量和数据库数量；PC 传统界面与移动端源码 100% 开放、后端 99% 开放，WebOS 源码按对应版本授权提供，并支持 Vue、React、Angular 与 .NET 二次开发。 |

> 从业务想法到企业级应用，Microi吾码围绕 AI 编程、低代码建模、系统集成与私有化交付，提供清晰、可扩展的数字化能力底座。

## 🚀 为什么 AI 开发能更快、更省 Token

| 对比维度 | 传统定制代码 + AI | Microi吾码 + AI |
|---|---|---|
| AI 生成范围 | 数据访问、权限、CRUD、流程、页面和部署胶水代码都要从头生成 | 复用几十+成熟引擎，AI 主要处理业务模型、配置和少量 V8 / 前端扩展 |
| 上下文与 Token | 反复解释框架、表结构、接口规范和历史代码，长上下文随项目持续膨胀 | Skills、V8 类型提示、实时 Schema、业务蓝图与 MCP 自动提供准确上下文 |
| 交付速度 | 先生成大量代码，再编译、联调、补权限、补部署和回归 | 建模、生成、远程执行、调试、回读与验收形成闭环，开箱即可进入业务开发 |
| 稳定性与成熟度 | 每个项目重复实现通用底座，代码面大、差异多 | 平台自 2014 年持续演进，权限、表单、工作流、SaaS、缓存和分布式能力统一复用 |
| 持续维护 | AI 后续仍要理解并修改整套定制工程 | AI 聚焦更小的业务增量，平台升级与业务扩展边界更清晰 |

在表单、CRUD、权限、流程、报表、SaaS 等平台能力高度复用的典型企业应用中，相比从零生成整套定制代码，**AI Token 消耗与开发周期都有机会获得 10 倍以上的改善**。实际结果取决于需求与平台的匹配度、模型、上下文质量、团队熟练度和验收范围，不应理解为对所有项目的无条件工期或费用承诺。

> [查看完整原理、开发闭环与适用边界 →](/doc/v8-engine/ai-apiengine#ai-efficiency)

### 按角色进入

| 角色 | 建议先看 |
|---|---|
| 业务负责人 / 架构师 | [AI 平台治理](/doc/system-engine/ai-platform-governance) · [AI 工作流与业务蓝图](/doc/system-engine/ai-workflow-suite) · [版本选择](/doc/edition-comparison) |
| 低代码开发者 | [快速开始](/doc/getting-started/start-use) · [表单引擎](/doc/form-engine/form-engine-info) · [模块引擎](/doc/system-engine/module-engine) · [工作流](/doc/system-engine/wf-engine) |
| AI / V8 开发者 | [AI + V8 编程](/doc/v8-engine/ai-apiengine) · [VS Code 插件](/doc/v8-engine/vs-code-plugin) · [接口引擎](/doc/v8-engine/api-engine) |
| 前端与多端开发者 | [Microi.UI](/doc/system-engine/microi-ui) · [多端客户端](/doc/system-engine/multi-end-client) · [前端微服务](/doc/system-engine/micro-app) · [Unity / WebGL](/doc/system-engine/unity-integration) |
| 运维 / 安全负责人 | [Docker 部署](/doc/getting-started/docker-run) · [安全基线](/doc/more/security) · [任务调度](/doc/system-engine/job) · [消息通知](/doc/system-engine/message-notification) |
| 系统集成开发者 | [接口引擎](/doc/v8-engine/api-engine) · [数据源引擎](/doc/system-engine/datasource-engine) · [MQ](/doc/system-engine/mq) / [MQTT](/doc/system-engine/mqtt-engine) · [应用商城](/doc/system-engine/app-store) |

| 资源 | 地址 |
|---|---|
| 🌐 官网 | [https://microi.net](https://microi.net) 【<span class="mci-doc-danger">支持在线注册免费使用</span>】 |
| 🦞 OpenClaw 吾码小龙虾 | [https://gitee.com/microi-net/microi.openclaw](https://gitee.com/microi-net/microi.openclaw) |
| 📦 Gitee 源码 | [https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net) |
| 📦 GitHub 源码 | [https://github.com/itdos/microi.net](https://github.com/itdos/microi.net) |
| 📦 GitCode 源码 | [https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview) |
| 📝 官方 CSDN 博客 | [https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog) |
| 📝 技术 CSDN 博客 | [https://lisaisai.blog.csdn.net](https://lisaisai.blog.csdn.net/?type=blog) |

---

## ✨ 平台亮点

### 🔗 核心引擎

<table>
<thead><tr><th width="200">引擎</th><th>说明</th></tr></thead>
<tbody>
<tr><td>🔗 <strong><a href="/doc/v8-engine/api-engine">接口引擎</a></strong></td><td>在线使用 JavaScript 编写后端接口，支持 AI 在线编程 + VS Code 本地 AI 编程，保存即生效无需编译发布，支持 Get/Post，支持返回 JSON、文件、HTML 等</td></tr>
<tr><td>🤖 <strong><a href="/doc/v8-engine/ai-apiengine#模式二-本地-ai-编程vs-code-插件">AI 本地编程</a></strong></td><td>VS Code 插件一键拉取业务代码与数据库结构，为 Copilot / Claude Code / Cursor 提供 V8、Schema、MCP 和 Skills 上下文；写代码、远程执行、逐行调试与真实回读形成闭环</td></tr>
<tr><td>🤖 <strong><a href="/doc/v8-engine/ai-apiengine">AI 在线编程</a></strong></td><td>平台内置 DeepSeek 等 AI 模型，上传 V8 文档 + 数据库结构即可生成高质量接口代码，支持自然语言转 SQL、代码智能检查与优化</td></tr>
<tr><td>📊 <strong>AI 数据分析</strong></td><td>自然语言提问，AI 自动分析业务数据并生成可视化图表；默认使用大模型关键词扩展、权限感知 Schema 搜索与准确字段回读，不依赖 Ollama/Qdrant，向量数据库仅作为可选语义召回增强；AI 训练、微调、提示词管理一站式管理</td></tr>
<tr><td>🧠 <strong><a href="/doc/system-engine/ai-workflow-suite">AI 工作流与业务蓝图</a></strong></td><td>系统关系图、业务架构蓝图、状态机、自动化流和流程挖掘，覆盖设计、运行与治理</td></tr>
<tr><td>📝 <strong><a href="/doc/form-engine/form-engine-info">表单引擎</a></strong></td><td>支持扩展组件、自定义 Vue 组件嵌入表单、V8 引擎事件，灵活实现复杂业务逻辑</td></tr>
<tr><td>📦 <strong><a href="/doc/system-engine/module-engine">模块引擎</a></strong></td><td>多表关联、查询列、统计列、动态 V8 按钮、复杂 Where 条件、多种嵌入模式</td></tr>
<tr><td>🔄 <strong><a href="/doc/system-engine/wf-engine">工作流引擎 v4</a></strong></td><td>完全自主研发，由表单引擎 + 接口引擎驱动</td></tr>
<tr><td>🎨 <strong><a href="/doc/system-engine/page-engine">界面引擎</a></strong></td><td>可视化界面自定义设计，支持 ECharts 图表</td></tr>
<tr><td>🖨️ <strong><a href="/doc/system-engine/print-engine">打印引擎</a></strong></td><td>在线制作打印模板，无需导出即可打印</td></tr>
<tr><td>🧾 <strong><a href="/doc/system-engine/bluetooth-printer">蓝牙打印机</a></strong></td><td>一份 V8 同时兼容佳博 GP-M322 与 ZICOX CC4，支持 TSPL、CPCL、ESC/POS、BLE 与 Android SPP</td></tr>
<tr><td>📊 <strong><a href="/doc/system-engine/report-engine">报表引擎</a></strong></td><td>虚拟表格、ECharts 报表，支持自定义增删改</td></tr>
<tr><td>☁️ <strong><a href="/doc/system-engine/saas-engine">SaaS 引擎</a></strong></td><td>三种模式：数据库隔离多租户、TenantId 租户隔离、独立组织机构隔离</td></tr>
</tbody>
</table>

### 🤖 AI + 低代码 开发模式

<table>
<thead><tr><th width="170">模式</th><th width="250">工具</th><th>说明</th></tr></thead>
<tbody>
<tr><td><strong>本地 AI 编程</strong> ⭐</td><td>VS Code + Copilot / Claude Code / Cursor</td><td><strong>推荐模式。</strong> 插件同步业务代码和数据库结构，AI 获得 V8、Schema、MCP 与 Skills 上下文；写代码 → 保存部署 → 远程执行 → 逐行调试 → 真实回读在 VS Code 内闭环完成</td></tr>
<tr><td><strong>在线 AI 编程</strong></td><td>平台内置 DeepSeek / ChatGPT / Kimi 等</td><td>上传 V8 文档 + 数据库结构（db.json），AI 直接生成接口引擎代码，支持代码补全、智能检查与优化</td></tr>
<tr><td><strong>AI 数据分析</strong></td><td>DeepSeek / OpenAI + 内置 Schema 搜索</td><td>自然语言提问即可分析业务数据，自动生成可视化图表；默认使用大模型关键词扩展、权限感知 Schema 搜索与准确字段回读，按需启用向量融合，支持 AI 训练、微调、提示词管理</td></tr>
<tr><td><strong>V8 代码调用 AI</strong></td><td>接口引擎 + DeepSeek 接口</td><td>在接口引擎中直接调 AI，实现智能问答、自然语言转 SQL、内容审核等</td></tr>
</tbody>
</table>

> [→ 查看 AI 编程全指南](https://microi.net/doc/v8-engine/ai-apiengine)

### 🏗️ 基础架构

<table>
<thead><tr><th width="200">能力</th><th>说明</th></tr></thead>
<tbody>
<tr><td>♾️ <strong>无限制</strong></td><td>不限制用户数、表单数、数据量和数据库数量；PC 传统界面与移动端源码 100% 开放、后端 99% 开放，WebOS 源码按对应版本授权提供</td></tr>
<tr><td>🌐 <strong>跨平台</strong></td><td>基于 .NET10，<a href="https://www.nuget.org/packages/Microi.net#versions-body-tab">核心库采用 .Net Standard 开发</a>，支持 gRPC 跨语言通信</td></tr>
<tr><td>🗄️ <strong>跨数据库</strong></td><td>支持 MySQL、SQL Server、Oracle、PostgreSQL、达梦、人大金仓等数据库，以及读写分离与分库分表；精确版本见部署文档</td></tr>
<tr><td>☁️ <strong>分布式部署</strong></td><td>Docker / K8S / Jenkins / Rancher / CI/CD</td></tr>
<tr><td>💾 <strong>分布式缓存</strong></td><td>Redis 哨兵模式</td></tr>
<tr><td>📂 <strong><a href="/doc/more/hdfs">分布式存储</a></strong></td><td>阿里云 OSS / MinIO / 亚马逊 S3，可扩展更多存储介质</td></tr>
<tr><td>🔐 <strong><a href="/doc/more/security">平台安全与兼容基线</a></strong></td><td>FormEngine 混合授权、保护表、TableChild、上传与私有文件、CORS/SSRF、RSA、Token 和多节点缓存</td></tr>
<tr><td>🛡️ <strong><a href="/doc/more/identity-verification">登录方式与强身份验证</a></strong></td><td>DiyToken、Passkey、Authenticator、Gitee/微信/GitHub 登录、改密步进票据与可选严格人脸网关</td></tr>
<tr><td>📨 <strong><a href="/doc/system-engine/mq">消息队列</a></strong></td><td>RabbitMQ 集成</td></tr>
<tr><td>🔔 <strong><a href="/doc/system-engine/message-notification">消息通知</a></strong></td><td>公众号/服务号、短信、邮件与平台内部实时通知，持久日志和多节点幂等</td></tr>
<tr><td>📡 <strong><a href="/doc/system-engine/mqtt-engine">IoT 物联网 MQTT</a></strong></td><td>集成 MQTT 服务器，支持 485 / ZigBee / 蓝牙 / Modbus 网关</td></tr>
<tr><td>🔍 <strong><a href="/doc/system-engine/search-engine">搜索引擎</a></strong></td><td>ElasticSearch 分词搜索</td></tr>
<tr><td>🍃 <strong>MongoDB</strong></td><td>日志系统，亿级数据量毫秒级分页</td></tr>
</tbody>
</table>

### 🧩 更多能力

<table>
<thead><tr><th width="200">能力</th><th>说明</th></tr></thead>
<tbody>
<tr><td>📄 <strong>模板引擎</strong></td><td>表单/表格支持在线 HTML 模板渲染</td></tr>
<tr><td>📂 <strong><a href="/doc/system-engine/databases">数据库管理</a></strong></td><td>一键加载第三方数据库，接口引擎中访问任意数据库</td></tr>
<tr><td>📑 <strong><a href="/doc/more/office">Office 引擎</a></strong></td><td>集成 OnlyOffice，本地设计模板，导出/打印</td></tr>
<tr><td>🔐 <strong>细粒度权限</strong></td><td>精确到每张表、每个字段、每个菜单、每个按钮、每个接口</td></tr>
<tr><td>🔑 <strong>单点登录</strong></td><td>支持第三方系统 ↔ 低代码平台双向单点登录</td></tr>
<tr><td>💬 <strong>微信公众平台</strong></td><td>多公众号 / 多小程序配置、模板消息</td></tr>
<tr><td>🎨 <strong><a href="/doc/system-engine/microi-ui">Microi.UI</a></strong></td><td>Web / UniApp 统一设计系统、主题变量、响应式组件和 AI 可检索组件文档</td></tr>
<tr><td>📱 <strong><a href="/doc/system-engine/multi-end-client">PC / WebOS / UniApp / App</a></strong></td><td>经典管理端、桌面式门户、移动 Web、原生动态小程序和 HBuilderX App 壳</td></tr>
<tr><td>🧩 <strong><a href="/doc/system-engine/micro-app">前端微服务</a></strong></td><td>独立源码、宿主认证与路由桥、在线/本地编辑、应用商城交付</td></tr>
<tr><td>⏱️ <strong><a href="/doc/system-engine/job">任务调度</a></strong></td><td>定时执行接口引擎或定制 DLL</td></tr>
<tr><td>💬 <strong>聊天系统</strong></td><td>自研在线聊天 + 腾讯 IM 集成</td></tr>
<tr><td>🕷️ <strong><a href="/doc/system-engine/spider-engine">采集引擎</a></strong></td><td>可重复规则采集、真实 Chrome Worker、验证码人工兜底、接口与 DOM 全覆盖</td></tr>
<tr><td>🌍 <strong><a href="/doc/system-engine/translate-engine">多语言</a></strong></td><td>前后端多语言管理，在线配置</td></tr>
<tr><td>📊 <strong><a href="/doc/system-engine/visualization-engine">goView 数据大屏</a></strong></td><td>自由拖拽驾驶舱，设计 JSON 与 Microi 表单引擎数据统一管理</td></tr>
<tr><td>🧊 <strong><a href="/doc/system-engine/visualization-engine">3D 与 CAD</a></strong></td><td>Three.js GLB/GLTF 场景设计，以及 DWG/DXF、STEP/STP、STL 转换与预览</td></tr>
<tr><td>🌸 <strong><a href="/doc/system-engine/unity-integration">Unity 3D 与 WebGL</a></strong></td><td>Microi.Unity UPM SDK、安全工具箱、V8 通讯与可安装 WebGL AI 应用</td></tr>
<tr><td>🦞 <strong>OpenClaw 远程 Agent</strong></td><td>通过 MCP 与 Skills 连接 Microi，支持远程集群管理、应用开发和自动化交付</td></tr>
<tr><td>💬 <strong>腾讯 IM</strong></td><td>快速集成社交聊天、客服会话、直播弹幕</td></tr>
</tbody>
</table>

---

## 📸 预览图

<table class="mci-doc-preview-gallery">
  <tr>
    <td colspan="3" align="center"><img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" alt="Microi吾码平台主界面" style="width:100%" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td colspan="3" align="center"><img src="https://static.itdos.com/upload/img/ScreenShot_2026-07-08_231038_158.jpg" alt="Microi吾码 AI 平台界面" style="width:100%" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td colspan="3" align="center"><img src="https://static.itdos.com/upload/img/microi-apiengine-20260208.jpg" alt="Microi 接口引擎在线开发界面" style="width:100%" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/csdn/应用商城.png" alt="应用商城" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/microi-apiengine-20260208.jpg" alt="接口引擎" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" alt="AI 应用开发" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" alt="V8 引擎本地 AI 编程连接配置" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" alt="V8 引擎本地 AI 编程运行调试" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/V8引擎本地AI编程VSCode插件.png" alt="Microi VS Code 插件" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" alt="模块引擎" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/表单引擎.png" alt="表单引擎" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/界面引擎.png" alt="界面引擎" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/csdn/数据大屏.png" alt="数据大屏" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/打印引擎.png" alt="打印引擎" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/AI数据分析.png" alt="AI 数据分析" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" alt="工作流引擎" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" alt="报表引擎" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" alt="SaaS 引擎" data-fancybox="platform-preview"/></td>
  </tr>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/csdn/移动端-扫一扫.jpg" alt="移动端扫一扫" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/移动端-蓝牙打印1.jpg" alt="移动端蓝牙打印连接" data-fancybox="platform-preview"/></td>
    <td><img src="https://static.itdos.com/upload/img/csdn/移动端-蓝牙打印2.jpg" alt="移动端蓝牙打印结果" data-fancybox="platform-preview"/></td>
  </tr>
</table>

---

## 💰 开源版、个人版、企业版区别

<table>
<thead><tr><th width="80">版本</th><th width="140">价格</th><th>说明</th></tr></thead>
<tbody>
<tr><td><strong>开源版</strong></td><td>免费</td><td>PC 传统界面 100% 源码、移动端 100% 源码、后端 99% 源码；可商用、随意修改、无限分发部署。<strong>开源版仅无法使用在线 AI 相关功能，本地 AI 不受影响</strong></td></tr>
<tr><td><strong>个人版</strong></td><td><strong>￥999 买断</strong></td><td>额外包含 <strong>WebOS 100% 完整源码</strong>，功能、开源程度与企业版完全一致，<strong>无任何限制、无限分发部署、无限商用、永久有效</strong>。不购买后续技术支持也可永久正常使用已获得授权的版本，只是购买满一年后新增的部分功能可能无法使用</td></tr>
<tr><td><strong>企业版</strong></td><td><strong>￥2.5w 买断</strong></td><td><strong>永久有效</strong>，并提供更多培训、咨询等售后服务，<strong>优先响应平台升级需求</strong>。不购买后续技术支持也可永久正常使用已获得授权的版本，只是购买满一年后新增的部分功能可能无法使用</td></tr>
</tbody>
</table>

> 个人版 ￥999、企业版 ￥2.5w 均为一次买断价格，授权永久有效。后续可选技术支持为个人版 ¥499/年、企业版 ¥1.5w/年，由用户自愿购买；不购买也不影响已有授权永久正常使用。吾码坚持“做一单生意、交一个朋友”，实际服务通常不会机械地卡得很严格，遇到具体情况可以先友好沟通。

> [→ 查看开源版、个人版、企业版的详细区别与选择建议](/doc/edition-comparison)

---

## 🏆 成功案例

> 2018~2025 基于 Microi吾码平台已交付软件 **200+ 套**，已应用客户 **500+**

| 行业 | 案例 |
|---|---|
| 🏠 房地产 | 互联网平台（大量前后端微服务定制） |
| 🏭 制造业 | 大型 MES（500+ 表，500+ 接口引擎）、大型电器 ERP（300+ 表，100+ 模块） |
| 👔 服装业 | 多个服装 ERP（100+ 表，1 人 1 月完成），纯低代码实现 |
| 📡 IoT | 物联网智能家居（亿级数据量）、植物工厂智能硬件控制 |
| 🏢 政企 | 多套集团、国企 OA 系统 |
| 🎓 教育 | 合作大学实训课程 |
| 📦 其他 | 停车场、潮汐检测、固定资产、CRM 等 |

> 📌 [100 余个案例持续更新中](https://microi.blog.csdn.net/category_12828272.html)

---

## 📂 源码目录说明

```
Microi.net/
├── Microi.Server/          # 🔧 后端 99% 源码（.NET10）
│   ├── Microi.net.Api/     #     Web API 层（ASP.NET Core 控制器）
│   ├── Microi.Core/        #     核心基础设施库（接口定义/模型/抽象）
│   ├── Microi.AI/          #     AI 领域实现（模型路由、Schema/NL2SQL、代理、计量、工作流）
│   ├── Microi.net/         #     表单、接口、模块、工作流等核心运行时
│   ├── Microi.V8Engine/    #     V8 引擎独立模块
│   ├── Microi.Cache/       #     缓存模块（Redis + 内存）
│   ├── Microi.MongoDB/     #     MongoDB 集成模块
│   ├── Microi.MQ/          #     RabbitMQ 消息队列模块
│   ├── Microi.MQTT/        #     MQTT 物联网服务模块
│   ├── Microi.SearchEngine/ #    Elasticsearch 搜索引擎模块
│   ├── Microi.Office/      #     Office 处理模块（Excel/Word/邮件）
│   ├── Microi.Job/         #     定时任务调度模块
│   ├── Microi.Spider/      #     采集引擎模块
│   ├── Microi.WeChat/      #     微信公众号/小程序集成
│   ├── Microi.Captcha/     #     验证码模块
│   ├── Microi.OCR/         #     OCR 租户网关
│   ├── Microi.HDFS/        #     分布式文件存储（OSS/MinIO/S3）
│   ├── Microi.Upgrade/     #     平台热更新模块
│   ├── Microi.Tests/       #     后端自动化测试
│   ├── Dos.ORM/            #     自研 ORM 基础库
│   └── Dos.Common/         #     通用工具类库
├── Microi.Client/          # 🖥️ PC 传统界面 100% 源码（Vue3 + Element-Plus + Vite + Pinia）
│   └── src/views/webos/     #     WebOS 桌面式门户（源码按对应版本授权）
├── Microi.UI/              # 🎨 Web / UniApp 统一设计系统
├── microi.uniapp/          # 📱 UniApp 移动端 100% 源码（小程序 / H5 / App）
├── microi.app/             # 📱 HBuilderX APK/IPA 套壳打包工程（Wap2App）
├── Microi.VSCode/          # 🧩 VS Code 插件与 Microi CLI
├── microi.mcp/             # 🔌 MCP Server 源码（AI Agent 工具）
├── microi.openclaw/        # 🦞 OpenClaw 远程 Agent 接入
├── Microi.Unity/           # 🌸 Unity UPM SDK 与 WebGL 集成
├── Microi.Spider.Chrome/   # 🕷️ 真实 Chrome 采集 Worker
├── microi.doc/             # 📝 官方文档（基于 VitePress）
├── Microi-V8-Engine/       # 🤖 各服务器/租户 AI 应用及应用商城发行源码
└── microi.skills/          # 🧠 AI Skills 知识库
```

各后端项目、前端入口、MCP、VS Code / CLI 与本地 `Microi-V8-Engine` 工作区的完整职责见 [源码架构与模块地图](/doc/getting-started/source-code-architecture)。

---

## 📚 相关文档

| 资源 | 地址 |
|---|---|
| 📖 官方文档 | [https://microi.net](https://microi.net) |
| 📝 CSDN 平台文档 | [https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html) |
| 🏆 CSDN 成功案例 | [https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html) |
| 🔗 CSDN 基于吾码的开源项目 | [https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html) |
---

## 📚 更新日志

> [https://microi.net/doc/about/update-log.html](https://microi.net/doc/about/update-log.html)

## 💬 加入交流群

欢迎加入官方 QQ 交流群，与开发团队和社区成员实时交流，获取最新资讯、答疑解惑、共同成长：

<p align="center">
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank">
    <img src="https://static.itdos.com/openclaw/preview/QQ交流群-51050055-12B7F5.svg" alt="点击加入 QQ 交流群" />
  </a>
</p>

<p align="center">
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank">
    <img src="https://static.itdos.com/openclaw/preview/qq-qun2.jpg" alt="扫码加入 QQ 交流群" style="max-width: 260px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);" />
  </a>
</p>

<p align="center">📌 群号：<b>51050055</b> &nbsp;·&nbsp; 点击徽章或扫描二维码即可加入</p>
