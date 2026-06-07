# 🤖 AI 编程

> **在线 + 本地双模式 AI 编程，让 AI 充分了解你的 V8 API 与数据库结构，接口引擎代码生成准确率高达 99%**

平台全部源码开源：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)

---

## 🎬 视频演示：AI本地编程环境搭建

> 快速在本地搭建AI编程环境

<iframe src="https://meeting.tencent.com/crm/lvDYAP1Dff" width="100%" height="500" frameborder="0" allowfullscreen style="border-radius: 8px; margin: 8px 0;"></iframe>

---

## 🎬 视频演示：20 分钟快速开发一套进销存系统

> 利用 AI + Microi吾码低代码平台，在约 20 分钟内从零搭建一套完整的进销存系统（含建表、菜单、接口引擎、表单事件）。

<iframe src="https://meeting.tencent.com/cw/NLLyRZ4ne1" width="100%" height="500" frameborder="0" allowfullscreen style="border-radius: 8px; margin: 8px 0;"></iframe>

---

## 🎯 为什么说 Microi吾码做到了真正的 AI + 低代码？

传统低代码的"AI 能力"停留在建表、建表单的表层，而 Microi吾码选择了一条更本质的路径：

**V8 接口引擎 = 标准 JavaScript 后端代码**，AI 最擅长的就是写代码。

- 接口引擎代码就是标准 JavaScript，AI 可以直接生成且正确率极高
- 将数据库表结构、字段含义、菜单关系一键喂给 AI，AI 就能精准理解你的业务数据
- **在线 AI 编程**：浏览器中用 DeepSeek / ChatGPT / Kimi 等工具写代码，复制粘贴到平台
- **本地 AI 编程**：VS Code + GitHub Copilot / Claude Code / Cursor，知识库自动注入，写代码 → 执行 → 调试全在编辑器内完成，无需离开
- **从 V8 代码中调用 AI 大模型**：在接口引擎里直接请求 DeepSeek 等接口，实现 ReAct 模式

> 博主某 MES 项目：500+ 张表，大量接口引擎由 AI 一次生成，准确率高达 **99%**。

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

### 可用的 Skills

| Skill | 场景 | 文件路径 |
|-------|------|----------|
| **v8-crud-api** | V8 接口引擎增删改查 | `microi.skills/v8-crud-api/SKILL.md` |
| **v8-table-event** | 表单 V8 事件开发 | `microi.skills/v8-table-event/SKILL.md` |
| **v8-sql-query** | 安全 SQL 查询 | `microi.skills/v8-sql-query/SKILL.md` |
| **v8-http-integration** | 调用外部 HTTP API | `microi.skills/v8-http-integration/SKILL.md` |
| **v8-cache-pattern** | Redis 缓存模式 | `microi.skills/v8-cache-pattern/SKILL.md` |
| **v8-security** | 安全最佳实践 | `microi.skills/v8-security/SKILL.md` |
| **v8-workflow** | 工作流审批事件 | `microi.skills/v8-workflow/SKILL.md` |
| **v8-mongodb** | MongoDB 操作 | `microi.skills/v8-mongodb/SKILL.md` |
| **v8-mq-mqtt** | 消息队列与 MQTT | `microi.skills/v8-mq-mqtt/SKILL.md` |
| **page-engine** | 界面引擎页面 JSON 生成 | `microi.skills/page-engine/SKILL.md` |
| **print-engine** | 打印引擎模板 JSON 生成 | `microi.skills/print-engine/SKILL.md` |

### 快速集成

#### 第 1 步：获取 Skills

Skills 已内置在平台源码的 `microi.skills` 目录中，克隆整个平台或单独获取均可：

```bash
# 方式一：克隆整个平台源码（含 Skills）
git clone https://gitee.com/ITdos/microi.net.git

# 方式二：仅克隆 Skills（通过 sparse-checkout）
git clone --no-checkout https://gitee.com/ITdos/microi.net.git
cd microi.net
git sparse-checkout set microi.skills
git checkout master
```

将 `microi.skills` 文件夹放到你的工作区根目录下。

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

配置 MCP 后，你可以直接在 AI 对话中操作平台：

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

## 📌 三种 AI 能力对比

| 方案 | 提供的能力 | 适用场景 |
|------|-----------|---------|
| **VS Code 插件** | V8 全部 API 知识 + 数据库表结构 + 代码拉取/推送 + 断点调试 | 日常开发，自动化 |
| **MCP Server** | 实时查询数据库结构、读取/保存引擎代码、远程执行 | AI 实时操作平台 |
| **Skills** | 具体场景的编码最佳实践和代码模板 | 编码规范，深度指导 |

::: tip 推荐三者搭配使用
VS Code 插件提供 API 知识和表结构 → MCP 提供实时数据查询和远程执行 → Skills 提供编码最佳实践。

平台源码（含 Skills、MCP）：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
:::
