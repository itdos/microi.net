# 🤖 AI 编程

> **在线 + 本地双模式 AI 编程，让 AI 充分了解你的 V8 API 与数据库结构**

平台全部源码开源：[GitHub](https://github.com/itdos/microi.net) / [Gitee](https://gitee.com/ITdos/microi.net)

<MciNugetStats variant="feature" />

::: tip 在线 AI 默认不需要向量数据库
平台已内置“大模型关键词扩展 + 权限感知 Schema/Skill 搜索 + 准确字段回读”。未开启 `mic_ai.EnableVectorDatabase` 时，不安装 Ollama、`nomic-embed-text` 和 Qdrant 也可使用 NL2SQL、NL2V8 与在线 AI 数据分析；默认模式部署更轻、启动更快、Schema 更新更及时。只有确有高度模糊语义召回需求时，才建议把向量数据库作为增强通道启用。
:::

## 📌 推荐提示词

::: tip 推荐工作流
先通过 [Microi吾码 AI 开发工具：VS Code 插件 + CLI](./vs-code-plugin.md) 完成服务器登录、Skills 与 MCP 初始化。纯命令行用户运行 `microi init --pull` 后，应新开一个 AI 对话，让 Codex、Claude Code 或 Trae 加载新增 MCP。

提示词不需要重复粘贴全部 V8 API，也不要写真实密码。只需明确目标租户、需求事实源、交付范围、写入闸门和验收标准。

### 最短可用提示词

```text
使用当前工作区已经配置好的 Microi MCP 和 microi.skills，为【目标 OsClient】完成
【具体需求】。先调用 microi_get_status 核对 API Server、OsClient 和登录用户，再读取
现有业务蓝图、数据库结构、菜单、接口、事件、工作流和在线应用；不要猜字段或重复
创建已有资源。

先给出业务蓝图、菜单树、数据关系、状态机和 Manifest dry-run，列明会新增/修改的资源；
我确认后再真实写入。写入后逐项远端回读，运行 microi_validate_system、必要的接口与
Playwright 验收，并报告本地未推送、远端较新和冲突数量。不要只给方案或示例代码。
```

### 完整系统交付提示词模板

把方括号内容替换成真实信息；没有的资料可删除对应行。

```text
你是资深企业架构师、业务产品经理、Microi吾码低代码/V8 工程师、UI/UX 设计师和
自动化测试工程师。请使用当前工作区已注入的 Microi Skills，并只使用指定 MCP
【MCP 名称】操作【API Server】【OsClient】。

目标：交付一套可实际运行的【系统名称】。
需求事实源：【需求文档路径 / 现有系统说明 / 截图目录】。
验收入口：【PC/H5 地址】；测试帐号从安全环境或已登录浏览器读取，不得写入文档、
源码、命令行输出或提交记录。

一、事实盘点
1. 先调用 microi_get_status，明确回报当前 API Server、OsClient 和登录身份；不一致立即停止写入。
2. 读取需求文档、业务蓝图、实时 Schema、索引、菜单、角色、接口引擎、V8 事件、
   工作流、页面/打印和在线应用。已有能力采用幂等升级，不重复建表、菜单或接口。
3. 关系基数、状态机、权限或资金/库存口径无法从事实源确定时，列为真正阻塞项；
   其它可由 Schema、Skills、MCP 或浏览器发现的问题自行查明，不反复询问。

二、规划与写入闸门
4. 更新或生成可持续维护的业务蓝图，列出角色、两级菜单树、表关系、状态流转、
   接口、按钮、任务、工作流、页面、打印和验收标准。
5. 调用 microi_get_manifest_schema 形成 Manifest，依次执行 microi_plan_system 和
   microi_generate_system(dryRun:true)。先展示新增、修改、跳过和风险清单。
6. 未得到我对本轮写入的明确确认前，不执行 dryRun:false；确认后再真实生成，并立即
   microi_validate_system 和逐资源回读。超时先回读，不盲目重复写入。

三、建模与体验
7. 建立符合业务语义的表、字段、唯一约束和查询索引。1:N 明细使用 TableChild；
   N:1/1:1 才使用 JoinForm。复杂业务按钮调用后端接口引擎，前端 V8 只负责交互。
8. Select、Radio、Checkbox、MultipleSelect 等选择控件必须有完整数据源，保存稳定 Key、
   展示中文 Label；列表列、搜索列、隐藏列、统计列、默认排序、移动端卡片字段都要完整。
9. 普通短字段采用合理栅格；长文本、富文本、上传、地图、代码和子表使用整行布局。
   12 个以内字段不强行分组；中等表单优先折叠分组；只有大业务域或字段很多时使用 Tabs。
10. 表格宽度、主副字段、状态样式、关键统计角标、模块标题/副标题和业务指标按真实场景设计；
    不为每个菜单堆角标，不用无意义“总数”代替业务指标。

四、数据、安全与验收
11. 测试数据只写测试租户或明确测试资源；每个核心表准备 5～10 条可重复、可清理且关系正确
    的数据。不得把测试数据伪装为生产数据，不修改真实资金、库存、积分或订单。
12. 后端代码遵守参数化查询、租户隔离、权限、幂等和分布式部署规范；定时任务和消息消费
    不能只依赖进程内锁或本机状态。
13. 完成后验证真实 API、数据库/平台回读、核心业务闭环、网络 4xx/5xx、页面错误和截图；
    涉及定时任务或消息时补充至少两节点的重复执行与故障恢复验证。
14. 最终按“源码/配置、构建、远端写入回读、自动化测试、截图、同步状态、未覆盖风险”
    分项报告。关闭本轮启动的浏览器和临时进程，不影响用户原有服务。
```

### 已有系统的局部优化提示词

```text
请只优化【模块/接口/页面】的【具体问题】。先读取远端当前配置与源码，说明根因和最小
影响范围；先做 dry-run/diff，我确认后写入。保留其它正确配置和用户修改，写后回读
目标资源并运行定向测试，最后报告远端是否生效以及同步状态。不要顺带重构无关模块。
```
:::

---

## 🎬 视频演示：AI本地编程环境搭建

> 快速在本地搭建AI编程环境

<iframe src="https://meeting.tencent.com/crm/lvDYAP1Dff" width="100%" height="500" frameborder="0" allowfullscreen style="border-radius: 8px; margin: 8px 0;"></iframe>


- 录制: Microi吾码-AI本地编程环境搭建
- 日期: 2026-06-08 05:50:29
- 录制文件：[https://meeting.tencent.com/crm/lvDYAP1D09](https://meeting.tencent.com/crm/lvDYAP1D09)


---

## 🎬 视频演示：AI快速搭建进销存系统

> 利用 AI + Microi吾码低代码平台，在约 20 分钟内从零搭建一套完整的进销存系统（含建表、菜单、接口引擎、表单事件）。

<iframe src="https://meeting.tencent.com/cw/NLLyRZ4ne1" width="100%" height="500" frameborder="0" allowfullscreen style="border-radius: 8px; margin: 8px 0;"></iframe>


- 录制: Microi吾码-AI快速搭建进销存系统
- 日期: 2026-04-20 03:42:04
- 录制文件：[https://meeting.tencent.com/crm/NLLyRZ4n83](https://meeting.tencent.com/crm/NLLyRZ4n83)


---

## 🎯 为什么说 Microi吾码做到了真正的 AI + 低代码？

传统低代码的"AI 能力"停留在建表、建表单的表层，而 Microi吾码选择了一条更本质的路径：

**V8 接口引擎 = 标准 JavaScript 后端代码**，AI 最擅长的就是写代码。

- 接口引擎代码就是标准 JavaScript，AI 可以直接生成且正确率极高
- 将数据库表结构、字段含义、菜单关系一键喂给 AI，AI 就能精准理解你的业务数据
- **在线 AI 编程**：浏览器中用 DeepSeek / ChatGPT / Kimi 等工具写代码，复制粘贴到平台
- **本地 AI 编程**：VS Code 插件或 `@microi.net/cli` 自动注入 Skills、Schema 与 MCP；可选择编辑器内调试，也可由 Codex/Claude/Trae 在纯终端完成交付
- **从 V8 代码中调用 AI 大模型**：在接口引擎里直接请求 DeepSeek 等接口，实现 ReAct 模式

如果要复用吾码已经封装的模型路由、会话、License、租户身份与中转计量，不要在每个页面重新保存供应商密钥。前端和后端 V8 均可直接使用第一等 `V8.AI.Chat/ChatStream/NL2SQL`，外部 Agent 使用专用 `microi_chat` MCP Tool；身份、租户、Endpoint 和 ApiKey 由可信宿主控制。GET/POST、Token 鉴权、SSE 打字机示例与服务器 License/中转 ApiKey 的区别见 [AI 引擎与 Microi.AI 中转站](../system-engine/ai-engine.md)。

> 博主某 MES 项目：500+ 张表，大量接口引擎均由 AI 生成。

<a id="ai-efficiency"></a>

### 相比传统定制代码 + AI，为什么更省 Token、更快？

AI 能不能提高效率，不只取决于模型本身，更取决于模型要生成多少代码、每轮需要理解多少上下文，以及生成结果能否直接进入可验证的运行环境。

| 对比维度 | 传统定制代码 + AI | Microi吾码 + AI |
|---|---|---|
| 交付起点 | 从技术选型、项目骨架和通用基础设施开始 | 表单、模块、接口、工作流、权限、SaaS、报表、消息等 20+ 引擎开箱即用 |
| AI 生成范围 | 数据访问、权限、CRUD、流程、页面、缓存和部署胶水代码都可能重复生成 | AI 主要生成业务模型、Manifest、V8 业务逻辑和必要的前端扩展 |
| 上下文与 Token | 反复携带框架说明、数据库 DDL、接口规范和大量历史代码 | Skills、V8 类型提示、实时 Schema、业务蓝图和 MCP 按需提供结构化事实 |
| 开发速度 | 生成后还要补基础能力、编译、联调和搭建部署链路 | 规划、dry-run、确认写入、远程执行、调试、回读和测试形成闭环 |
| 稳定性 | 每个项目拥有不同的通用代码与集成实现，回归面随代码量扩大 | AI 只修改较小的业务增量，成熟引擎继续承担权限、事务、租户和分布式边界 |
| 持续维护 | 新需求需要重新理解并修改整套定制工程 | 元数据、业务逻辑与平台底座边界清晰，可持续升级并保留项目扩展 |

::: tip 10 倍以上改善的适用边界
在表单、CRUD、权限、流程、报表、SaaS 等平台能力高度复用的典型企业应用中，相比从零生成整套定制代码，**AI Token 消耗与开发周期都有机会获得 10 倍以上的改善**。原因不是压缩提示词，而是复用了稳定的产品能力，让 AI 少生成、少解释、少联调大量通用代码。

实际结果取决于需求与平台的匹配度、模型、上下文质量、团队熟练度、定制深度和验收范围。高度定制的算法、特殊硬件协议、极致交互或平台尚未覆盖的基础能力，仍可能需要 Vue、C#、第三方服务或专用工程扩展，因此“10 倍以上”不应理解为对所有项目的无条件工期或费用承诺。
:::

这种模式带来的不只是速度：

- **更省 Token**：实时 Schema 和 Skills 代替重复粘贴文档，AI 聚焦当前业务差异；
- **更快交付**：常见企业能力直接复用，保存或显式推送后即可远程执行和回读；
- **更稳定、更成熟**：平台自 2014 年持续演进，通用能力不由每个项目临时生成；
- **开箱即用**：权限、多租户、表单、工作流、报表、缓存、消息、部署与多端能力已经形成产品；
- **仍可深度扩展**：低代码覆盖通用部分，V8、Vue、C#、HTTP 和微服务承接真正需要定制的部分。

---

## 💻 本地 AI 编程（VS Code 插件 + microi.net/cli）

Microi吾码提供同一套 AI 开发能力的两个入口：VS Code 插件负责资源树、Diff、远程执行和逐行调试；`@microi.net/cli` 负责无需 IDE 的连接、登录、AI/MCP 初始化、代码拉取、差异检查和显式推送。两者共用工作区配置、Token、Skills、MCP 和同步基线，完整功能与命令以 [AI 开发工具文档](./vs-code-plugin.md) 为准。

### 工作原理

```text
安装 VS Code 插件                  npm install -g @microi.net/cli
        ↓                                      ↓
可视化添加服务器并登录               microi init --pull
        └──────────────┬───────────────────────┘
                       ↓
          AI 指令 + Skills + V8 typings + MCP
                       ↓
    实时 Schema / 业务蓝图 / V8 源码 / 在线应用上下文
                       ↓
       AI 规划 → dry-run → 确认写入 → 远端回读 → 测试
                       ↓
       VS Code 可视化调试，或 CLI/Codex 纯终端交付
```

初始化只建立知识与工具连接，不等于无条件修改远端。普通文件保存只标记本地变化；必须执行插件“推送当前文件”或 CLI `microi push <file>`，并通过冲突预检后才会写入数据库。

### 安装一种入口

- **VS Code**：在扩展市场搜索 **Microi吾码**，适合可视化编辑、Diff 与调试。
- **纯命令行**：执行 `npm install -g @microi.net/cli`，再进入工作区运行 `microi init --pull`。

首次生成 MCP 配置后应新开 AI 对话，已打开的 Codex/Claude/Trae 会话通常不会热加载新工具。

### 初始化、拉取与知识注入

插件用户执行 **`Microi: 初始化AI配置`**，需要本地源码时再点击服务器节点的“拉取此服务器代码”。CLI 用户执行：

```bash
microi init --pull
```

两种入口都会完成以下工作：

| 步骤 | 内容 |
|---|---|
| ① 拉取接口引擎 | 所有 `ApiEngineKey.js` 保存到本地目录 |
| ② 拉取 V8 事件 | 所有表单 V8 事件 `.js` 保存到本地目录 |
| ③ 拉取数据库结构 | 表名、字段名、类型、说明、菜单树一并拉取 |
| ④ 自动生成知识库 | `AGENTS.md` / `CLAUDE.md` / Copilot/Cursor 指令 / `microi.skills/` / V8 typings |
| ⑤ 配置 MCP | 幂等写入 VS Code、Cursor、Trae、Claude Code 与 Codex 配置，保留其它 MCP |

知识库生成后，你在 VS Code 中打开任意 `.js` 文件，AI 助手已经了解：

- **V8 引擎完整 API**（不需要你手动告诉 AI 怎么用 `V8.FormEngine.GetTableData`）
- **你的数据库表结构**（AI 知道你的表叫什么，字段叫什么，业务含义是什么）
- **_Where 条件用法**（AI 能自动写出正确的查询条件）

### 写代码 → 执行 → 调试，全闭环

| 操作 | 方式 |
|---|---|
| AI 辅助写代码 | Copilot 自动补全，或在 Copilot Chat / Claude Code 输入需求 |
| 远程执行 | 右键 → `Microi: 远程执行当前接口引擎`（弹出参数输入框） |
| 逐行调试 | 右键 → `Microi: 远程逐行调试`，支持断点 / Step Over / 变量观察 |
| 推送保存 | 保存只更新本地状态；显式执行插件推送或 `microi push`，并先检查冲突 |

所有右下角的信息、警告和错误通知都会同步保存在 VS Code 的【输出 → Microi 吾码】中，包括微服务构建/推送、代码拉取/同步、登录和远程执行结果。日志时间使用运行 VS Code 电脑的本地时区；带按钮的通知还会记录用户最终选择，通知消失后仍可继续追查。后台身份维护使用静默状态探测，服务器临时不可达不会反复产生无内容的 `GetStatus Error:`；用户主动操作失败时则会保留错误码、地址和端口等诊断明细。

<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" style="margin: 5px;">

### 单独更新 AI 知识库

数据库结构发生变化后，无需重新拉取全部代码，单独执行：

```
Microi: 拉取数据库结构到AI知识库
```

CLI 用户可执行 `microi pull --scope schema`。两种方式都会更新当前 OsClient 的结构快照，让 AI 感知最新表结构。

### 效率对比

| 开发模式 | 准备上下文 | 写代码 | 执行调试 | 推送部署 |
|---|---|---|---|---|
| 传统手写 | 无 | 手写 | 打开浏览器平台 | 浏览器平台 |
| 在线 AI 编程 | 手动上传文档 + db.json | AI + 复制粘贴 | 浏览器平台 | 浏览器平台 |
| **VS Code 插件** | **自动注入 Skills/MCP，按需拉取** | **AI + 可视化编辑器** | **执行与逐行调试** | **显式推送并检查冲突** |
| **microi.net/cli** | **`microi init --pull`** | **Codex/Claude/Trae/终端** | **AI 通过 MCP 执行并回读** | **`microi push` 显式推送** |

---

## 🧩 AI Skills 集成指南

> Skills 是一系列结构化指令文件（`SKILL.md`），告诉 AI 工具在特定场景下应该如何编写代码。每个 Skill 覆盖一个开发场景，包含完整的 API 用法、代码模板和安全规范。

### 什么是 Microi Skills

Microi Skills 是一组 **AI 编程最佳实践文件**，内置于平台源码中，让 GitHub Copilot、Cursor、Claude Code 等 AI 工具在编写 Microi 平台代码时，自动遵循正确的 API 用法和安全规范。

- **平台源码**：[GitHub](https://github.com/itdos/microi.net) / [Gitee](https://gitee.com/ITdos/microi.net)
- **Skills 目录**：[GitHub](https://github.com/itdos/microi.net/tree/master/microi.skills) / [Gitee](https://gitee.com/ITdos/microi.net/tree/master/microi.skills)

**没有 Skills 时：** AI 可能写出不规范的代码（拼接 SQL、缺少权限校验、参数未验证等）。

**有 Skills 时：** AI 自动参考 Skill 文件，生成符合平台最佳实践的代码（参数化查询、权限校验、规范的返回格式等）。

::: warning Skills 不是“可选提示”
凡是平台新增了授权、租户隔离、上传配额、私有文件、Token 续签、SSRF/CORS 或分布式执行规则，都必须同步写入官方文档、相关 Skill、VS Code 类型/知识库和平台 AI 内嵌资源。否则平台用户和 AI 都无法正确使用这些能力。发布前必须校验源码 Skills、插件 `dist`、VSIX、空工作区初始化产物和 AI 内嵌镜像的一致性。
:::

### 平台内置 AI 的 Skill 镜像

后端 `Microi.AI` 会把官方仓库中的完整 Skills 清单作为嵌入资源，供当前 `NL2V8EngineService` 建立检索知识库，覆盖 V8、前端事件、FormEngine HTTP、文件/租户安全、系统引擎、页面/打印、UniApp、MCP 交付与测试验收；普通 `Chat/ChatStream` 当前不会自动注入这套完整 corpus。嵌入资源必须从 `microi.skills/*/SKILL.md` 机械同步，禁止长期维护另一份手工简化版；新增、删除或修改 Skill 时，源码目录、嵌入资源、项目资源清单和向量文档清单必须一起校验。公共镜像不得包含客户名称、真实 `OsClient`、客户域名、项目路径或定制业务枚举。

知识库 collection 名包含当前嵌入文档的 SHA-256 版本片段。新旧服务节点滚动发布时分别使用自己的版本化 collection，通过确定性 point id 幂等写入；初始化不会删除其它节点仍在使用的旧 collection。旧版本 collection 应在旧节点全部退出后由运维按保留策略清理，而不是在应用启动时抢占式删除。

### 完整 Skills 目录

当前官方 Skills 持续随平台版本增加，以 `microi.skills/README.md`（[GitHub](https://github.com/itdos/microi.net/blob/master/microi.skills/README.md) / [Gitee](https://gitee.com/ITdos/microi.net/blob/master/microi.skills/README.md)）的实时清单为准，主要覆盖：

- 后端 V8：CRUD、SQL、表单事件、缓存、HTTP、MongoDB、MQ/MQTT、工作流、接口配置、SaaS、图片、文件、导入导出、调试、安全和爬虫；
- 前端 V8：字段/表单/列表事件、模板、菜单按钮、FormEngine HTTP；
- 平台引擎：界面、打印、数据源、任务、搜索、报表、翻译、AI、应用商城、数据库结构、表单布局、左右树表和 Microi.UI；
- AI 零代码交付：业务蓝图、MCP 系统交付、前端 SDK、UniApp、移动质量、数据源映射、Playwright、性能测试、生产只读巡检和工作区规范。

完整且随版本维护的清单以源码中的 `microi.skills/README.md`（[GitHub](https://github.com/itdos/microi.net/blob/master/microi.skills/README.md) / [Gitee](https://gitee.com/ITdos/microi.net/blob/master/microi.skills/README.md)）为准，不要在 AI 提示词里长期复制一份静态子集。

### 快速集成

#### 第 1 步：使用 VS Code 插件或 CLI 生成 AI 指令（推荐）

任选一种入口：安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=Microi.v8-engine) 并执行“初始化AI配置”，或安装 `@microi.net/cli` 后执行 `microi init --pull`。两者都会安装完整 Skills，并为 Codex、GitHub Copilot、Claude Code、Cursor、Trae 等生成对应项目指令。升级时按清单与哈希做差异更新，保留用户自行修改的 Skill。

无法使用插件时，再从源码手工获取：

```bash
# 方式一：从 GitHub 克隆整个平台源码（含 Skills）
git clone https://github.com/itdos/microi.net.git
# 国内网络也可使用 Gitee 镜像：git clone https://gitee.com/ITdos/microi.net.git

# 方式二：从 GitHub 仅克隆 Skills（通过 sparse-checkout）
git clone --no-checkout https://github.com/itdos/microi.net.git
# 国内网络也可使用 Gitee 镜像：git clone --no-checkout https://gitee.com/ITdos/microi.net.git
cd microi.net
git sparse-checkout set microi.skills
git checkout master
```

将 `microi.skills` 文件夹放到工作区根目录。不要把全部 Skill 全文拼接成一个超长提示词；AI 应按任务类型读取相关 `SKILL.md`。

#### 第 2 步：配置 AI 工具

---

**GitHub Copilot（VS Code）**

::: tip 推荐方式
安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=Microi.v8-engine)，插件会自动生成 `.github/copilot-instructions.md` 并引用所有 Skills，**无需手动配置**。
:::

**手动配置方式：** 在项目根目录 `.github/copilot-instructions.md` 末尾追加：

```markdown
## V8 引擎编码最佳实践

编写 V8 引擎代码时，参考以下 Skill 文件：
- microi.skills/v8-crud-api/SKILL.md — 增删改查
- microi.skills/v8-table-event/SKILL.md — 表单事件
- microi.skills/v8-sql-query/SKILL.md — SQL 查询
- microi.skills/v8-http-integration/SKILL.md — HTTP 集成
- microi.skills/v8-cache-pattern/SKILL.md — Redis 缓存
- microi.skills/v8-security/SKILL.md — 安全规范
- microi.skills/page-engine/SKILL.md — 界面引擎
- microi.skills/print-engine/SKILL.md — 打印引擎
```

也可以在对话中按需引用：

```
@workspace 参考 microi.skills/v8-crud-api/SKILL.md 帮我写一个用户管理的接口引擎
```

---

**Cursor**

**方式 A：在 `.cursor/rules/` 目录中添加规则文件（推荐）**

创建 `.cursor/rules/microi-skills.mdc`：

```yaml
---
description: Microi V8 引擎代码编写最佳实践
globs: ["microi-v8-engine/**/*.js"]
---

编写 V8 引擎代码时，参考以下 Skill 文件获取 API 用法和最佳实践：
- @microi.skills/v8-crud-api/SKILL.md
- @microi.skills/v8-table-event/SKILL.md
- @microi.skills/v8-sql-query/SKILL.md
- @microi.skills/v8-http-integration/SKILL.md
- @microi.skills/v8-cache-pattern/SKILL.md
- @microi.skills/v8-security/SKILL.md
```

**方式 B：在 `.cursorrules` 中只写路由说明**

在规则中要求 AI 按任务类型读取对应 `microi.skills/*/SKILL.md`；不要把全部 Skills 拼接成一个巨型 `.cursorrules`，否则会增加上下文噪声，也无法可靠升级用户未修改的文件。

---

**Claude Code**

在项目根目录 `CLAUDE.md` 中追加：

```markdown
## V8 引擎编码 Skills

编写 V8 引擎代码时，参阅以下文件：
- microi.skills/v8-crud-api/SKILL.md
- microi.skills/v8-table-event/SKILL.md
- microi.skills/v8-sql-query/SKILL.md
- microi.skills/v8-http-integration/SKILL.md
- microi.skills/v8-cache-pattern/SKILL.md
- microi.skills/v8-security/SKILL.md
```

### 使用效果

配置 Skills 后，AI 代码生成质量会显著提升：

**❌ 没有 Skills：**
```
你：帮我写一个分页查询用户列表的接口引擎
AI：（可能拼接 SQL、没有权限校验、返回格式不规范）
```

**✅ 有 Skills：**
```
你：帮我写一个分页查询用户列表的接口引擎
AI：（参考 v8-crud-api Skill）
    ✅ 使用 V8.FormEngine.GetTableData + _Where 参数化查询
    ✅ 包含分页参数校验
    ✅ 使用 V8.CurrentUser 做权限校验
    ✅ 规范的 DosResult 返回格式
```

### 自定义 Skills

你可以为自己的业务场景创建自定义 Skill 文件：

1. 在 `microi.skills/` 下创建新目录，如 `my-business/`
2. 创建 `SKILL.md` 文件，参考现有 Skill 的格式编写
3. 在 AI 配置文件中添加引用路径

**SKILL.md 基本格式：**

```markdown
# Skill 标题

你正在开发 Microi 吾码平台的 xxx 功能。

## 核心规则
- 规则1
- 规则2

## 代码模板

（代码示例）

## 常见错误
- ❌ 错误写法
- ✅ 正确写法
```

---

## 🔌 AI MCP 集成指南

> MCP（Model Context Protocol）是 Anthropic 制定的开放协议，让 AI 工具以标准化方式连接外部系统。Microi MCP Server（[GitHub](https://github.com/itdos/microi.net) / [Gitee](https://gitee.com/ITdos/microi.net)）让 AI 工具直接连接 Microi 吾码平台，实时查询数据库结构、读取引擎代码、远程执行引擎。

完整工具分类、安装方式、写入确认与回读规则参见 [MCP Server 专题](/doc/v8-engine/mcp-server)。

::: warning 当前实现边界
本节的“AI 可以调用 MCP”指 Codex、GitHub Copilot、Cursor、Claude Code 等已经实现 MCP Host/Agent Loop 的外部客户端。平台普通 `Chat/ChatStream` 使用服务端会话上下文和固定核心规范 Prompt，不检索完整知识库；`NL2SQL` 默认使用当前租户 Schema 关键词检索与准确字段回读；`NL2V8` 默认使用 Skill 镜像与当前租户 Schema 关键词检索。只有 `mic_ai.EnableVectorDatabase=1` 时，两条检索链路才增加 Ollama/Embedding/Qdrant 向量融合；向量服务异常会回退到关键词结果。当前 `Microi.Server/Microi.AI` 没有向模型注册 MCP Tools，也没有执行 `tool_calls` 循环，因此不会自动调用 MCP。仅在 Prompt 中写“使用 MCP”并不等于已经接入工具。

NL2SQL 当前由服务端生成不可被 JSON 伪造的授权上下文：白名单仅包含当前租户非受保护业务表；普通角色的 AI 角色策略还会与缓存的 FormEngine 列表读取权限取交集，关键词候选和可选向量候选都会在进入 Prompt 前再次过滤。执行层要求精确非空白名单，逐个校验每个 `FROM`/`JOIN` 表，拒绝注释、多语句、CTE、`UNION`、写操作和危险函数，并按数据库施加 `MaxRows + 1` 行限制与 30 秒超时。

这仍是词法安全门禁而不是 SQL AST；模型生成的动态值当前不会自动改写为数据库参数，通用 NL2SQL 也不会执行菜单 `SqlWhere`/`SqlJoin` 行级范围。带行级范围的表对普通角色失败关闭；部门、本人或关联记录范围查询必须通过经过审核、显式参数化并记录审计的业务 ApiEngine，不能把“拥有菜单读取权限”描述成“NL2SQL 已继承行级权限”。

平台在线 AI 若在后续版本增加 Tool/Agent Loop，应复用后端现有授权服务并继承当前用户和租户身份；禁止使用平台超级管理员 Token 自调用 MCP 绕过权限。模型提出工具调用后，服务端仍需校验参数、确认写操作、限制循环次数/时长/结果大小、记录审计并回读验证。
:::

### 什么是 Microi MCP

Microi MCP Server 让 Codex、GitHub Copilot、Cursor、Trae、Claude Code 等外部 AI 客户端在明确权限和确认规则下**读取或操作 Microi 平台**——无需手工复制表结构和 V8 文档，AI 可以实时获取当前租户事实并在写后回读。

### 提供的 AI 能力（代表）

| 领域 | 代表能力 | 写入保护 |
|------|----------|----------|
| 状态与事实发现 | 当前服务器/OsClient、实时 Schema、菜单、角色、接口、事件、应用和业务蓝图 | 只读 |
| 全系统建模 | Manifest Schema、规划、dry-run、表/字段/菜单/权限/数据源/任务生成与系统验证 | 真实生成需确认 |
| V8 与接口引擎 | 列表、源码读取、创建、保存、运行、表单/字段/模块/流程 V8 | 保存前校验，写后回读 |
| 页面、打印与工作流 | Page Engine、打印模板、流程拓扑、条件路线和节点代码 | 先校验再保存 |
| 在线 AI 应用 | 发现 Web/UniApp/MicroService、读取源码、创建、同步和发布 | 分阶段确认与版本回读 |
| 测试与运维 | E2E 上下文、验收、文件、Redis、MongoDB 日志 | 高风险操作显式确认 |

完整工具清单以当前 MCP 的 `tools/list` 为准；Codex 大工具集场景还可通过 `microi_codex` 的 `list_tools` / `describe_tool` 发现原始工具。

### 前置条件

- 已部署 Microi 吾码后端服务
- 已安装支持 MCP 的 AI 客户端（Codex / GitHub Copilot / Cursor / Trae / Claude Code 任一）

### 推荐方式：VS Code 插件或 CLI（无需手工部署 MCP）

::: tip 大多数用户无需手动配置 MCP
安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=Microi.v8-engine)，或安装 `@microi.net/cli` 后运行 `microi init --pull`。VSIX 与 CLI npm 包都内置 MCP Server 和 Skills，普通用户无需克隆或构建 `microi.mcp`。
:::

两种入口都会：

- 幂等生成 `.vscode/mcp.json`、`.cursor/mcp.json`、`.trae/mcp.json`、`.mcp.json` 和 Codex `config.toml`，保留用户已有 MCP；
- 使用工作区 Token 文件，CLI 不落盘保存密码，插件密码保存在 VS Code `SecretStorage`；
- 注入 `AGENTS.md`、`CLAUDE.md`、Copilot/Cursor 指令、V8 typings 和完整 Skills；
- 提供真实诊断或 `microi doctor`，区分“配置存在”与“MCP 当前可调用”。

**流程：** 安装一种入口 → 添加服务器并登录 → 初始化 AI/MCP → 新开 AI 对话 → 按需拉取代码。

> 以下手工配置只适用于 MCP 源码开发者或需要自建远程 SSE 的团队；普通 CLI 用户不需要执行。

### 手动配置：本地 stdio 模式

AI 工具在每次启动时自动拉起 MCP Server 进程。

#### 安装

```bash
# MCP Server 源码内置于平台仓库 microi.mcp 目录
git clone https://github.com/itdos/microi.net.git
# 国内网络也可使用 Gitee 镜像：git clone https://gitee.com/ITdos/microi.net.git
cd microi.net/microi.mcp
npm install
npm run build
```

#### GitHub Copilot（VS Code）

在项目 `.vscode/mcp.json` 中添加：

```json
{
  "servers": {
    "microi": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://你的API地址",
        "MICROI_USERNAME": "账号",
        "MICROI_PASSWORD": "密码",
        "MICROI_OS_CLIENT": ""
      }
    }
  }
}
```

#### Cursor

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "microi": {
      "command": "node",
      "args": ["/path/to/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://你的API地址",
        "MICROI_USERNAME": "账号",
        "MICROI_PASSWORD": "密码",
        "MICROI_OS_CLIENT": ""
      }
    }
  }
}
```

#### Claude Code (CLI)

```bash
claude mcp add microi -- \
  env MICROI_API_URL=https://你的API地址 \
  env MICROI_USERNAME=账号 \
  env MICROI_PASSWORD=密码 \
  node /path/to/microi.mcp/dist/index.js
```

::: warning 安全提示
配置文件包含敏感信息，请将 `.vscode/mcp.json` 和 `.cursor/mcp.json` 加入 `.gitignore`，避免提交到 Git。
:::

### 远程 SSE 模式（团队 / 生产推荐）

将 MCP Server 部署为 Docker 容器，所有人连同一个 SSE 地址。

#### Docker 部署

```bash
cd microi.mcp
cp .env.example .env
# 编辑 .env 填入后端地址和管理员账号
docker compose up -d
```

#### Nginx 反向代理

推荐挂载到已有 API 域名下：

```nginx
# MCP SSE 端点
location /mcp/sse {
    proxy_pass http://127.0.0.1:3000/sse;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
}

# MCP 消息端点
location /mcp/messages {
    proxy_pass http://127.0.0.1:3000/messages;
    proxy_http_version 1.1;
}

# MCP 健康检查
location /mcp/health {
    proxy_pass http://127.0.0.1:3000/health;
}
```

#### 验证部署

```bash
curl https://api.example.com/mcp/health
# 应返回 {"status":"ok","server":"microi-mcp-server","version":"1.0.0"}
```

#### AI 工具连接 SSE

**GitHub Copilot**（`.vscode/mcp.json`）：

```json
{
  "servers": {
    "microi": {
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "X-Microi-Username": "账号",
        "X-Microi-Password": "密码",
        "X-Microi-OsClient": ""
      }
    }
  }
}
```

**Cursor**（`.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "microi": {
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "X-Microi-Username": "账号",
        "X-Microi-Password": "密码",
        "X-Microi-OsClient": ""
      }
    }
  }
}
```

### 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `MICROI_API_URL` | ✅ | Microi 后端 API 地址 | `https://api.microi.net` |
| `MICROI_USERNAME` | ※ | 登录账号（无 Token 时必填） | `admin` |
| `MICROI_PASSWORD` | ※ | 登录密码（无 Token 时必填） | `password` |
| `MICROI_OS_CLIENT` | 否 | 应用标识（多租户场景） | `myApp` |
| `MICROI_TOKEN` | ※ | 直接传 Token（优先于账号密码） | `Bearer xxx` |

### 使用场景示例

在支持 MCP Host 的外部 AI 客户端中配置 MCP 后，可以直接在对话中操作平台：

```
你：查看当前数据库有哪些表
AI：（调用 microi_get_db_schema）当前数据库共 42 张表...

你：帮我创建一个查询订单列表的接口引擎
AI：（调用 microi_get_db_schema 了解表结构 → 生成代码 → 调用 microi_create_engine 创建引擎）
    接口引擎已创建，Key 为 get-order-list...

你：执行一下看看结果
AI：（调用 microi_run_engine）返回了 20 条订单数据...
```

---

## 📌 四种 AI 能力对比

| 方案 | 提供的能力 | 适用场景 |
|------|-----------|---------|
| **AI 开发工具（VS Code + CLI）** | 连接登录、Skills/typings、MCP、实时 Schema、V8 同步；插件补充资源树/Diff/断点调试，CLI 支持无 IDE 工作流 | 外部 AI 日常开发与完整交付 |
| **MCP Server** | 为具备 MCP Host 的客户端提供实时查询、保存和执行工具 | AI 受控操作平台 |
| **Skills** | 具体场景的编码最佳实践和代码模板 | 编码规范，深度指导 |
| **平台在线 AI** | 普通会话上下文、NL2SQL Schema 双模式检索、NL2V8 Skill + Schema 双模式检索 | 默认关键词检索，可选向量融合；当前不自动调用 MCP |

::: tip 推荐组合
外部开发场景由 VS Code 插件或 CLI 建立工作区，Skills 提供规范，MCP 提供最新事实和受控执行；平台在线 AI 在 NL2SQL/NL2V8 等明确入口默认使用大模型关键词扩展与权限感知 Schema/Skill 检索，只有管理员显式开启向量数据库后才增加向量召回。MCP 是工具协议，关键词/向量索引都是检索手段，三者不能互相替代。

平台源码（含 Skills、MCP）：[GitHub](https://github.com/itdos/microi.net) / [Gitee](https://gitee.com/ITdos/microi.net)
:::

## 📌 Codex 接入 Microi 的要点

Codex 的帐号、订阅、安装和网络要求应以其当前官方说明为准，本页不维护容易过期的注册、支付、地区或代理教程。Microi 侧只需要完成以下步骤：

1. 在准备作为项目工作区的目录安装并运行 `@microi.net/cli`：

   ```bash
   npm install -g @microi.net/cli
   microi init --pull
   ```

2. 运行 `microi doctor`，确认 Profile、Token、Skills、工作区指令与 Codex MCP 配置均正常。
3. 关闭当前 Codex 对话并新开一个对话；已打开的会话通常不会热加载新增 MCP。
4. 先让 Codex 调用 `microi_get_status` 核对 API Server、OsClient 和登录身份，再使用本页推荐提示词。
5. 代理地址属于用户本机环境，不要把固定端口、地区规则、帐号、密码或 Token 写进项目文档和仓库。

如果 Codex 能看到 MCP 配置却不能调用工具，先运行 `microi doctor`；仍失败时，在 VS Code 插件中执行 **`Microi MCP: 诊断 MCP 可调用性`**，区分配置错误、Node 启动失败、Token 失效和服务器不可达。
