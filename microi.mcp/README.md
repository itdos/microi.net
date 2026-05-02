# Microi MCP Server

让 AI 工具（GitHub Copilot / Cursor / Claude Code）**直接连接 Microi 吾码平台**，实时查询数据库结构、读取接口引擎代码、远程执行引擎。

> MCP（Model Context Protocol）是 Anthropic 制定的开放协议，让 AI 以标准化方式连接外部系统。本项目是 Microi 吾码平台的官方 MCP Server 实现。

---

## ⭐ 推荐方式：安装 VS Code 插件（零配置）

**大多数用户无需手动配置 MCP。** 安装 [Microi吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine) 后，MCP 自动配置，开箱即用：

- 自动生成 `.vscode/mcp.json`（GitHub Copilot）和 `.cursor/mcp.json`（Cursor）
- Token 自动刷新，无需存储密码
- 同时注入 AI 指令文件（`.github/copilot-instructions.md`、`CLAUDE.md`、`.cursorrules`）

安装插件 → 配置服务器连接 → 拉取代码 → **MCP 立即可用**，支持 GitHub Copilot、Cursor、Claude Code for VS Code。

> 以下内容适用于 **不使用 VS Code 插件** 或需要 **SSE 远程部署** 的场景。

---

## 提供的 AI 能力（17 个 Tools）

| Tool | 功能 | 读/写 |
|------|------|-------|
| `microi_get_status` | 检查 Microi 后端连接状态 | 只读 |
| `microi_get_db_schema` | 获取数据库表结构（表名、字段、类型、描述） | 只读 |
| `microi_list_engines` | 列出所有接口引擎 | 只读 |
| `microi_get_engine_code` | 获取接口引擎 JavaScript 源码 | 只读 |
| `microi_save_engine_code` | 保存接口引擎代码 | 读写 |
| `microi_create_engine` | 创建新的接口引擎 | 读写 |
| `microi_run_engine` | 远程执行接口引擎（⚠️ 可能有副作用） | 读写 |
| `microi_list_events` | 列出所有 V8 表单事件 | 只读 |
| `microi_get_event_code` | 获取 V8 事件源码 | 只读 |
| `microi_save_event_code` | 保存 V8 事件代码 | 读写 |
| `microi_create_table` | 创建低代码自定义表（diy_table + 物理表） | 读写 |
| `microi_add_field` | 为自定义表添加字段和表单控件配置 | 读写 |
| `microi_create_module` | 创建菜单模块并绑定表、按钮、Tab、列表配置 | 读写 |
| `microi_set_role_permission` | 为角色授予菜单权限 | 读写 |
| `microi_list_pages` | 列出界面引擎页面 | 只读 |
| `microi_get_page` | 获取界面引擎页面 JSON | 只读 |
| `microi_save_page` | 创建或更新界面引擎页面 | 读写 |

---

## 手动配置：本地 stdio 模式

适用于不使用 VS Code 插件的开发者。AI 工具在每次启动时自动拉起 MCP Server 进程。

### 安装

```bash
git clone https://gitee.com/microi-net/microi.mcp.git
cd microi.mcp
npm install
npm run build
```

### GitHub Copilot（VS Code）

在项目的 `.vscode/mcp.json` 中添加：

```json
{
  "servers": {
    "microi": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://api.microi.net",
        "MICROI_USERNAME": "your_username",
        "MICROI_PASSWORD": "your_password",
        "MICROI_OS_CLIENT": ""
      }
    }
  }
}
```

### Cursor

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "microi": {
      "command": "node",
      "args": ["/path/to/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://api.microi.net",
        "MICROI_USERNAME": "your_username",
        "MICROI_PASSWORD": "your_password",
        "MICROI_OS_CLIENT": ""
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add microi -- \
  env MICROI_API_URL=https://api.microi.net \
  env MICROI_USERNAME=your_username \
  env MICROI_PASSWORD=your_password \
  node /path/to/microi.mcp/dist/index.js
```

> 将 `/path/to/microi.mcp` 替换为实际克隆路径。`MICROI_OS_CLIENT` 留空则使用后端默认应用。

---

## 远程 SSE 模式（团队 / 生产推荐）

将 MCP Server 部署为 Docker 容器，所有人连同一个 SSE 地址。

### 部署

```bash
cd microi.mcp
cp .env.example .env
# 编辑 .env 填入后端地址和管理员账号
docker compose up -d
```

### Nginx 反向代理（推荐挂载到已有 API 域名下）

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

### 验证

```bash
curl https://api.microi.net/mcp/health
# 应返回 {"status":"ok","server":"microi-mcp-server","version":"1.0.0"}
```

### AI 工具连接 SSE

GitHub Copilot（`.vscode/mcp.json`）：

```json
{
  "servers": {
    "microi": {
      "url": "https://api.microi.net/mcp/sse",
      "headers": {
        "X-Microi-Username": "your_username",
        "X-Microi-Password": "your_password",
        "X-Microi-OsClient": ""
      }
    }
  }
}
```

Cursor（`.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "microi": {
      "url": "https://api.microi.net/mcp/sse",
      "headers": {
        "X-Microi-Username": "your_username",
        "X-Microi-Password": "your_password",
        "X-Microi-OsClient": ""
      }
    }
  }
}
```

> ⚠️ 配置文件包含敏感信息，请加入 `.gitignore` 避免提交到 Git。

---

## 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `MICROI_API_URL` | ✅ | Microi 后端 API 地址 | `https://api.microi.net` |
| `MICROI_USERNAME` | ※ | 登录账号（无 Token 时必填） | `admin` |
| `MICROI_PASSWORD` | ※ | 登录密码（明文，自动 RSA 加密） | |
| `MICROI_TOKEN` | ※ | JWT Token（VS Code 插件自动管理） | |
| `MICROI_TOKEN_FILE` | | Token 文件路径（VS Code 插件自动管理） | |
| `MICROI_OS_CLIENT` | | 应用标识 | |
| `MICROI_RSA_PUBLIC_KEY` | | 自定义 RSA 公钥（PEM） | |
| `MCP_TRANSPORT` | | `stdio`（默认） 或 `sse` | |
| `MCP_PORT` | | SSE 端口（默认 `3000`） | |

> ※ 认证优先级：`MICROI_TOKEN_FILE` > `MICROI_TOKEN` > `MICROI_USERNAME` + `MICROI_PASSWORD`

---

## 使用示例

配置完成后，在 AI 对话中直接提问：

```
你：帮我查一下 Sys_User 表有哪些字段
AI：[调用 microi_get_db_schema] → 返回完整字段列表

你：列出所有和订单相关的接口引擎
AI：[调用 microi_list_engines] → 返回引擎列表

你：执行一下 order-statistics 接口引擎
AI：[调用 microi_run_engine] → 返回执行结果

你：帮我生成一套 CRM 客户管理模块，包含客户表、字段、菜单和管理员权限
AI：[调用 microi_get_db_schema → microi_create_table → microi_add_field → microi_create_module → microi_set_role_permission] → 平台中直接出现可用模块

你：给订单列表增加“审核通过/驳回”行按钮，并把业务逻辑放到接口引擎
AI：[调用 microi_create_engine → microi_create_module 或 microi_save_engine_code] → 生成按钮配置和后端 V8 逻辑
```

---

## 安全性

- 所有操作受 Microi 后端权限控制，用户只能访问自己有权限的数据
- 使用 RSA 加密登录 + JWT Token 认证
- SSE 模式每个连接独立认证，仅知道 URL 无法访问
- Token 自动刷新（每 12 分钟），无需明文存储长期密码
- 不同租户（OsClient）数据完全隔离

---

## 与 VS Code 插件的关系

| 方案 | 覆盖内容 | 适用场景 |
|------|---------|---------|
| **VS Code 插件**（推荐） | MCP 自动配置 + API 知识库 + 代码补全 + 表结构文档 | 日常开发，开箱即用 |
| **MCP Server**（本项目） | 实时查询数据、远程执行引擎 | 不使用插件 / 团队 SSE 部署 |

> 💡 安装 VS Code 插件即可获得 MCP 全部能力，无需单独配置本项目。

## License

MIT
