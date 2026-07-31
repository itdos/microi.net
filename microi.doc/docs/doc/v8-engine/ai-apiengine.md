# 🤖 AI 编程

> **在线 + 本地双模式 AI 编程，让 AI 充分了解你的 V8 API 与数据库结构**

平台全部源码开源：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)

::: tip 在线 AI 默认不需要向量数据库
平台已内置“大模型关键词扩展 + 权限感知 Schema/Skill 搜索 + 准确字段回读”。未开启 `mic_ai.EnableVectorDatabase` 时，不安装 Ollama、`nomic-embed-text` 和 Qdrant 也可使用 NL2SQL、NL2V8 与在线 AI 数据分析；默认模式部署更轻、启动更快、Schema 更新更及时。只有确有高度模糊语义召回需求时，才建议把向量数据库作为增强通道启用。
:::

## 📌 推荐提示词

::: tip AI开发推荐提示词
你是一名资深企业架构师、业务产品经理、Microi吾码低代码专家、V8工程师、UI/UX设计师、数据工程师和自动化测试工程师。请直接使用指定 MCP 完成指定的需求，不要只给方案、示例代码或待办清单：

1、请根据mcp【microi_itdos】帮我开发一套非常完整、完善的【xx系统】，请认真仔细的深度分析需求文档【doc\xxx.doc】，生成一份非常完善、详细的md文档在同目录下，以便你后面可以随时读写这个md文档（如需求变更）

2、请根据需求文档以及吾码skills相关规范，帮我创建相关的菜单、表、字段、V8按钮、V8事件等等，并且每一张表你至少帮我添加100条左右测试数据，但是不要显示测试相关的字眼，看上去像是真实正式运行的数据环境。数据的流程操作、流转都要合理，表与表之间的关系是正确的，一些带数据源的字段控件也请完善好Key-Value数据源源，该创建多个账号就创建。开始前先读取数据库 Schema、表、字段、索引、菜单、接口引擎、事件、工作流、页面、角色和数据；已有能力采用幂等更新，不得重复建表、重复建菜单或覆盖正确配置。建立满足成熟业务需要的表、字段、唯一约束、普通索引和组合索引。复杂业务按钮必须调用接口引擎，前端 V8 只负责确认、参数收集、提示和刷新。

3、对过程中的合理技术细节自行决策并继续执行，不要把可以通过 Schema、Skills、MCP 或浏览器发现的问题重新询问用户。先调用 microi_get_db_schema 和 microi_get_manifest_schema，再形成 Manifest；依次执行 microi_plan_system、dryRun 验证、确认后的真实生成和 microi_validate_system。

4、所有表单宽度设置80%，子表打开设置为75%，子表的子表70%，如果还有子表就这样递减5%，并且开启数据日志，数据评论，数据版本，菜单不要汇总在一个总菜单里面；根据业务需求可以通过界面引擎多设计一些【看板报表】，界面要做的漂亮合理。普通短字段默认双列或合理栅格排列；长文本、富文本、上传、地图、代码、子表等整行控件使用 FormWidth=24。

5、一些Key-Value字段（如类似状态、分类）的模板引擎也请完善，使用不同样式来达到更好的用户视觉体验，所有 Select、Radio、Checkbox、MultipleSelect 必须有完整 KeyValue 数据源或其它数据源，保存 Key、展示中文 Label；禁止空下拉。

6、表单设计请尽量多的使用【折叠分组】来达到更好的表单视觉效果，而不是少量的字段都分配到了表单Tab分组中去（表单某个信息块字段比较多时[比如30个字段以上]、或子表比较多时仍然推荐使用表单Tab分组来达到更好的表单视觉效果），表单里的折叠组尽量默认展开（除非一些确实是非关键数据可以默认折叠）；同时模块引擎中的【页面多Tab】也请合理的使用，让用户可以方便快捷的查看类似不同类别/状态的数据

7、根据实际情况，为了让用户有更好的视觉体验：【表格每一列的宽度、菜单动态统计角标（不要所有菜单都统计，不然会很丑，只挑那种比较重要的菜单进行统计角标）、数据表格【页面多Tab】角标统计、模块顶部标题/副标题及多个动态统计指标、更多V8按钮统计角标、表格主字段/多行副字段、表格右侧图标/状态字段（注意当配置了表格多行副字段、表格右侧图标/状态字段时，其它列就没必要重复显示了）、移动端卡片图片/标题/副标题/顶部标签/右侧金额/状态/内容/Meta/底部字段等动态区域】，这些元素都应该做的很完善、设计的很合理，不要什么都不做或漏做，特别是【模块顶部标题/副标题及多个动态统计指标】需要每个模块都做（根据每个模块对应的表进行分析设计动态业务数据统计指标，而不是毫无意义的单纯数据总数统计）

8、请随时通过本地访问【https://xxx.itdos.com（帐号admin密码xxxxxx）对应mcp【microi_itdos】】进行全自动化截图测试验收，页面有报错就修复错误。完成后关闭 AI 启动的浏览器和其它临时进程，不得遗留孤儿进程。
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
- **本地 AI 编程**：VS Code + GitHub Copilot / Claude Code / Cursor，知识库自动注入，写代码 → 执行 → 调试全在编辑器内完成，无需离开
- **从 V8 代码中调用 AI 大模型**：在接口引擎里直接请求 DeepSeek 等接口，实现 ReAct 模式

> 博主某 MES 项目：500+ 张表，大量接口引擎均由 AI 生成。

---

## 💻 本地 AI 编程（VS Code 插件）

这是本次更新带来的全新一体化开发模式：**在 VS Code 中直接用 GitHub Copilot / Claude Code / Cursor 编写接口引擎，知识库自动注入，无需离开编辑器。**

### 工作原理

```
安装 VS Code 插件「Microi吾码」
        ↓
  登录并点击「拉取」
        ↓
  插件自动完成：
  ① 拉取所有接口引擎 .js 到本地
  ② 拉取所有 V8 事件 .js 到本地
  ③ 拉取数据库结构（表名 / 字段名 / 字段描述 / 菜单结构）
        ↓
  自动生成 AI 知识库文件（放在本地工作区）：
  • .github/copilot-instructions.md  ← GitHub Copilot 读取
  • CLAUDE.md                        ← Claude Code 读取
  • .cursorrules                     ← Cursor 读取

  知识库内容包含：
  ✅ V8 引擎全部 API（FormEngine / Db / Cache / Http / ApiEngine 等）
  ✅ _Where 查询条件语法
  ✅ 你的数据库所有表结构（表名 / 字段名 / 类型 / 业务说明）
  ✅ 菜单树结构（哪个菜单对应哪张表）
        ↓
  打开任意 .js 接口引擎文件
        ↓
  GitHub Copilot / Claude Code / Cursor 自动获得完整上下文
  → 直接 AI 辅助编写接口引擎代码，无需额外的"喂文档"步骤
        ↓
  保存 → 自动推送到数据库（或手动 Ctrl+S）
  远程执行 / 远程逐行调试，全在 VS Code 内完成
```

### 安装插件

在 VS Code 扩展市场搜索 **Microi吾码** 安装，或从 [OpenClaw](https://gitee.com/microi-net/microi.openclaw) 下载 `.vsix` 文件手动安装。

### 一键拉取 + 自动建立知识库

登录成功后，点击左侧 Microi 侧栏顶部的 **↓（拉取）** 按钮，或执行命令：

```
Microi: 拉取V8引擎代码
```

插件会自动完成以下操作（支持多服务器并发）：

| 步骤 | 内容 |
|---|---|
| ① 拉取接口引擎 | 所有 `ApiEngineKey.js` 保存到本地目录 |
| ② 拉取 V8 事件 | 所有表单 V8 事件 `.js` 保存到本地目录 |
| ③ 拉取数据库结构 | 表名、字段名、类型、说明、菜单树一并拉取 |
| ④ 自动生成知识库 | `copilot-instructions.md` / `CLAUDE.md` / `.cursorrules` |

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
| 推送保存 | 文件保存时自动同步到数据库，无需编译发布 |

所有右下角的信息、警告和错误通知都会同步保存在 VS Code 的【输出 → Microi 吾码】中，包括微服务构建/推送、代码拉取/同步、登录和远程执行结果。日志时间使用运行 VS Code 电脑的本地时区；带按钮的通知还会记录用户最终选择，通知消失后仍可继续追查。后台身份维护使用静默状态探测，服务器临时不可达不会反复产生无内容的 `GetStatus Error:`；用户主动操作失败时则会保留错误码、地址和端口等诊断明细。

<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" style="margin: 5px;">

### 单独更新 AI 知识库

数据库结构发生变化后，无需重新拉取全部代码，单独执行：

```
Microi: 拉取数据库结构到AI知识库
```

即可更新三个知识库文件，让 AI 立即感知最新的表结构。

### 效率对比

| 开发模式 | 准备上下文 | 写代码 | 执行调试 | 推送部署 |
|---|---|---|---|---|
| 传统手写 | 无 | 手写 | 打开浏览器平台 | 浏览器平台 |
| 在线 AI 编程 | 手动上传文档 + db.json | AI + 复制粘贴 | 浏览器平台 | 浏览器平台 |
| **本地 AI 编程（推荐）** | **全自动，拉取时自动生成** | **AI 在 VS Code 实时辅助** | **VS Code 内执行/调试** | **保存自动推送** |

---

## 🧩 AI Skills 集成指南

> Skills 是一系列结构化指令文件（`SKILL.md`），告诉 AI 工具在特定场景下应该如何编写代码。每个 Skill 覆盖一个开发场景，包含完整的 API 用法、代码模板和安全规范。

### 什么是 Microi Skills

Microi Skills 是一组 **AI 编程最佳实践文件**，内置于平台源码中，让 GitHub Copilot、Cursor、Claude Code 等 AI 工具在编写 Microi 平台代码时，自动遵循正确的 API 用法和安全规范。

- **平台源码**：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
- **Skills 目录**：[https://gitee.com/ITdos/microi.net/tree/master/microi.skills](https://gitee.com/ITdos/microi.net/tree/master/microi.skills)

**没有 Skills 时：** AI 可能写出不规范的代码（拼接 SQL、缺少权限校验、参数未验证等）。

**有 Skills 时：** AI 自动参考 Skill 文件，生成符合平台最佳实践的代码（参数化查询、权限校验、规范的返回格式等）。

::: warning Skills 不是“可选提示”
凡是平台新增了授权、租户隔离、上传配额、私有文件、Token 续签、SSRF/CORS 或分布式执行规则，都必须同步写入官方文档、相关 Skill、VS Code 类型/知识库和平台 AI 内嵌资源。否则平台用户和 AI 都无法正确使用这些能力。发布前必须校验源码 Skills、插件 `dist`、VSIX、空工作区初始化产物和 AI 内嵌镜像的一致性。
:::

### 平台内置 AI 的 Skill 镜像

后端 `Microi.AI` 会把官方仓库全部 48 个 Skill 作为嵌入资源，供当前 `NL2V8EngineService` 建立检索知识库，覆盖 V8、前端事件、FormEngine HTTP、文件/租户安全、系统引擎、页面/打印、UniApp、MCP 交付与测试验收；普通 `Chat/ChatStream` 当前不会自动注入这套完整 corpus。嵌入资源必须从 `microi.skills/*/SKILL.md` 机械同步，禁止长期维护另一份手工简化版；新增、删除或修改 Skill 时，源码目录、嵌入资源、项目资源清单和向量文档清单必须一起校验。公共镜像不得包含客户名称、真实 `OsClient`、客户域名、项目路径或定制业务枚举。

知识库 collection 名包含当前嵌入文档的 SHA-256 版本片段。新旧服务节点滚动发布时分别使用自己的版本化 collection，通过确定性 point id 幂等写入；初始化不会删除其它节点仍在使用的旧 collection。旧版本 collection 应在旧节点全部退出后由运维按保留策略清理，而不是在应用启动时抢占式删除。

### 完整 Skills 目录

当前官方仓库包含 48 个 Skill，覆盖：

- 后端 V8：CRUD、SQL、表单事件、缓存、HTTP、MongoDB、MQ/MQTT、工作流、接口配置、SaaS、图片、文件、导入导出、调试、安全和爬虫；
- 前端 V8：字段/表单/列表事件、模板、菜单按钮、FormEngine HTTP；
- 平台引擎：界面、打印、数据源、任务、搜索、报表、翻译、AI、应用商城、数据库结构、表单布局、左右树表和 Microi.UI；
- AI 零代码交付：业务蓝图、MCP 系统交付、前端 SDK、UniApp、移动质量、数据源映射、Playwright、性能测试、生产只读巡检和工作区规范。

完整且随版本维护的清单以源码中的 [`microi.skills/README.md`](https://gitee.com/ITdos/microi.net/blob/master/microi.skills/README.md) 为准，不要在 AI 提示词里长期复制一份静态子集。

### 快速集成

#### 第 1 步：使用插件安装并生成 AI 指令（推荐）

安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine)，在工作区执行初始化/拉取。插件会安装完整 Skills，并为 Codex、GitHub Copilot、Claude Code、Cursor 等生成对应项目指令。升级时按清单与哈希做差异更新，保留用户自行修改的 Skill。

无法使用插件时，再从源码手工获取：

```bash
# 方式一：克隆整个平台源码（含 Skills）
git clone https://gitee.com/ITdos/microi.net.git

# 方式二：仅克隆 Skills（通过 sparse-checkout）
git clone --no-checkout https://gitee.com/ITdos/microi.net.git
cd microi.net
git sparse-checkout set microi.skills
git checkout master
```

将 `microi.skills` 文件夹放到工作区根目录。不要把 48 个 Skill 全文拼接成一个超长提示词；AI 应按任务类型读取相关 `SKILL.md`。

#### 第 2 步：配置 AI 工具

---

**GitHub Copilot（VS Code）**

::: tip 推荐方式
安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine)，插件会自动生成 `.github/copilot-instructions.md` 并引用所有 Skills，**无需手动配置**。
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

**方式 B：合并到 `.cursorrules`**

```bash
for f in microi.skills/*/SKILL.md; do
  echo -e "\n---\n" >> .cursorrules
  cat "$f" >> .cursorrules
done
```

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

> MCP（Model Context Protocol）是 Anthropic 制定的开放协议，让 AI 工具以标准化方式连接外部系统。Microi MCP Server（[开源仓库](https://gitee.com/ITdos/microi.net)）让 AI 工具直接连接 Microi 吾码平台，实时查询数据库结构、读取引擎代码、远程执行引擎。

::: warning 当前实现边界
本节的“AI 可以调用 MCP”指 Codex、GitHub Copilot、Cursor、Claude Code 等已经实现 MCP Host/Agent Loop 的外部客户端。平台普通 `Chat/ChatStream` 使用服务端会话上下文和固定核心规范 Prompt，不检索完整知识库；`NL2SQL` 默认使用当前租户 Schema 关键词检索与准确字段回读；`NL2V8` 默认使用 Skill 镜像与当前租户 Schema 关键词检索。只有 `mic_ai.EnableVectorDatabase=1` 时，两条检索链路才增加 Ollama/Embedding/Qdrant 向量融合；向量服务异常会回退到关键词结果。当前 `Microi.Server/Microi.AI` 没有向模型注册 MCP Tools，也没有执行 `tool_calls` 循环，因此不会自动调用 MCP。仅在 Prompt 中写“使用 MCP”并不等于已经接入工具。

NL2SQL 当前由服务端生成不可被 JSON 伪造的授权上下文：白名单仅包含当前租户非受保护业务表；普通角色的 AI 角色策略还会与缓存的 FormEngine 列表读取权限取交集，关键词候选和可选向量候选都会在进入 Prompt 前再次过滤。执行层要求精确非空白名单，逐个校验每个 `FROM`/`JOIN` 表，拒绝注释、多语句、CTE、`UNION`、写操作和危险函数，并按数据库施加 `MaxRows + 1` 行限制与 30 秒超时。

这仍是词法安全门禁而不是 SQL AST；模型生成的动态值当前不会自动改写为数据库参数，通用 NL2SQL 也不会执行菜单 `SqlWhere`/`SqlJoin` 行级范围。带行级范围的表对普通角色失败关闭；部门、本人或关联记录范围查询必须通过经过审核、显式参数化并记录审计的业务 ApiEngine，不能把“拥有菜单读取权限”描述成“NL2SQL 已继承行级权限”。

平台在线 AI 若在后续版本增加 Tool/Agent Loop，应复用后端现有授权服务并继承当前用户和租户身份；禁止使用平台超级管理员 Token 自调用 MCP 绕过权限。模型提出工具调用后，服务端仍需校验参数、确认写操作、限制循环次数/时长/结果大小、记录审计并回读验证。
:::

### 什么是 Microi MCP

Microi MCP Server 让 GitHub Copilot、Cursor、Claude Code 等 AI 工具**直接操作 Microi 平台**——不再需要手动复制粘贴表结构或 API 文档，AI 可以实时获取你的数据库结构和业务代码。

### 提供的 AI 能力

| Tool | 功能 | 读/写 |
|------|------|-------|
| `microi_get_status` | 检查后端连接状态 | 只读 |
| `microi_get_db_schema` | 获取数据库表结构（表名、字段、类型、描述） | 只读 |
| `microi_list_engines` | 列出所有接口引擎 | 只读 |
| `microi_get_engine_code` | 获取接口引擎 JavaScript 源码 | 只读 |
| `microi_save_engine_code` | 保存接口引擎代码 | 读写 |
| `microi_create_engine` | 创建新的接口引擎 | 读写 |
| `microi_run_engine` | 远程执行接口引擎 | 读写 |
| `microi_list_events` | 列出所有 V8 表单事件 | 只读 |
| `microi_get_event_code` | 获取 V8 事件源码 | 只读 |
| `microi_save_event_code` | 保存 V8 事件代码 | 读写 |

### 前置条件

- 已部署 Microi 吾码后端服务
- 已安装 AI 编程工具（GitHub Copilot / Cursor / Claude Code 任一）

### 推荐方式：VS Code 插件（零配置）

::: tip 大多数用户无需手动配置 MCP
安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine) 后，MCP 自动配置，开箱即用。
:::

安装插件后自动完成：
- 生成 `.vscode/mcp.json`（GitHub Copilot）和 `.cursor/mcp.json`（Cursor）
- Token 自动刷新，无需存储密码
- 同时注入 AI 指令文件（`.github/copilot-instructions.md`、`CLAUDE.md`、`.cursorrules`）

**流程：** 安装插件 → 配置服务器连接 → 拉取代码 → MCP 立即可用。

> 以下内容适用于不使用 VS Code 插件或需要 SSE 远程部署的场景。

### 手动配置：本地 stdio 模式

AI 工具在每次启动时自动拉起 MCP Server 进程。

#### 安装

```bash
# MCP Server 源码内置于平台仓库 microi.mcp 目录
git clone https://gitee.com/ITdos/microi.net.git
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
| **VS Code 插件** | V8 全部 API 知识 + 数据库表结构 + 代码拉取/推送 + 断点调试 | 日常开发，自动化 |
| **MCP Server** | 为具备 MCP Host 的客户端提供实时查询、保存和执行工具 | AI 受控操作平台 |
| **Skills** | 具体场景的编码最佳实践和代码模板 | 编码规范，深度指导 |
| **平台在线 AI** | 普通会话上下文、NL2SQL Schema 双模式检索、NL2V8 Skill + Schema 双模式检索 | 默认关键词检索，可选向量融合；当前不自动调用 MCP |

::: tip 推荐组合
外部开发场景由 VS Code 插件提供编辑体验，Skills 提供规范，MCP 提供最新事实和受控执行；平台在线 AI 在 NL2SQL/NL2V8 等明确入口默认使用大模型关键词扩展与权限感知 Schema/Skill 检索，只有管理员显式开启向量数据库后才增加向量召回。MCP 是工具协议，关键词/向量索引都是检索手段，三者不能互相替代。

平台源码（含 Skills、MCP）：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
:::

## 📌 Codex开通流程

> 1、准备一部苹果手机，设置-通用-语言与地区-地区-修改为美国

> 2、准备一个邮箱，优先Gmail，163也行

> 3、苹果手机-设置-App-邮件-邮件账户-添加账户-从列表中选取-iCloud-创建新Apple账户，填写姓名、邮箱，电话号码使用国内的即可，运气好直接就能注册成功，运气不好多试几次

> 4、IOS26.5 + 在设置-Apple账户、iCloud等-媒体与购买项目-退出旧的app store账户，然后打开App Store登录上面注册的账号，首次登录会提示需要验证Apple ID账户，去邮箱查看邮件通过AppleID帐号密码进行验证，然后再次尝试登录一般会成功

> 5、支付宝搜索【PockyShop】,使用支付宝登录，首页-App Store & iTunes USA-购买对应礼品卡卡号

> 6、app store 头像-兑换代码-手动输入兑换码，并搜索ChatGPT下载

> 7、手机VPN翻墙，打开ChatGPT，使用上面的邮箱进行注册，然后订阅Plus $20，支付时会提示补充app store信息：街道【1234 SW Main Street】，城市【Portland】，州【俄勒冈州】，邮政编码【97205】，电话【212-5551234】，然后重新支付订阅（可能会提示【你的购买无法完成，请联系iTunes支持】，这一般是AppleID被风控，暂时无解）

> 8、进入VS Code Codex插件，通过ChatGPT登录（在手机成功订阅之前，网页登录会需要验证手机号，手机订阅成功后再登录网页就不需要验证手机号了），OVER

> 9、常见问题
```
# 1、创建一个.env文件
# 修复Codex五次websocket连接失败、Codex的移动端无法连接的问题
# 存放路径：~/.codex/.env 或 C:\Users\Administrator\.codex\.env
# 注意：Clash Verge的默认端口是7897，而v2ray的默认端口是10808（设置-参数设置-本地混合监听端口）
HTTP_PROXY=http://127.0.0.1:10808
HTTPS_PROXY=http://127.0.0.1:10808
ALL_PROXY=http://127.0.0.1:10808
NO_PROXY=localhost,127.0.0.1,::1

# 2、windows powershell需要执行以下2条命令，然后可通过【curl.exe -4 https://ipinfo.io/json】测试地区
$env:HTTP_PROXY="http://127.0.0.1:10808"
$env:HTTPS_PROXY="http://127.0.0.1:10808"

# 3、不要使用新加坡、中国香港、中国台湾地区节点
```
