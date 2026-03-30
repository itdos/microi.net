---
title: AI MCP 集成
---

# AI MCP 集成

> MCP（Model Context Protocol）是 Anthropic 制定的开放协议，让 AI 工具以标准化方式连接外部系统。Microi MCP Server（[开源仓库](https://gitee.com/microi-net/microi.mcp)）让 AI 工具直接连接 Microi 吾码平台，实时查询数据库结构、读取引擎代码、远程执行引擎。

## 什么是 Microi MCP

Microi MCP Server 让 GitHub Copilot、Cursor、Claude Code 等 AI 工具**直接操作 Microi 平台**——不再需要手动复制粘贴表结构或 API 文档，AI 可以实时获取你的数据库结构和业务代码。

## 提供的 AI 能力

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

## 前置条件

- 已部署 Microi 吾码后端服务
- 已安装 AI 编程工具（GitHub Copilot / Cursor / Claude Code 任一）

## 推荐方式：VS Code 插件（零配置）

::: tip 大多数用户无需手动配置 MCP
安装 [Microi 吾码 VS Code 插件](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine) 后，MCP 自动配置，开箱即用。
:::

安装插件后自动完成：
- 生成 `.vscode/mcp.json`（GitHub Copilot）和 `.cursor/mcp.json`（Cursor）
- Token 自动刷新，无需存储密码
- 同时注入 AI 指令文件（`.github/copilot-instructions.md`、`CLAUDE.md`、`.cursorrules`）

**流程：** 安装插件 → 配置服务器连接 → 拉取代码 → MCP 立即可用。

> 以下内容适用于不使用 VS Code 插件或需要 SSE 远程部署的场景。

## 手动配置：本地 stdio 模式

AI 工具在每次启动时自动拉起 MCP Server 进程。

### 安装

```bash
git clone https://gitee.com/microi-net/microi.mcp.git
cd microi.mcp
npm install
npm run build
```

### GitHub Copilot（VS Code）

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

### Cursor

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

### Claude Code (CLI)

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

## 远程 SSE 模式（团队 / 生产推荐）

将 MCP Server 部署为 Docker 容器，所有人连同一个 SSE 地址。

### Docker 部署

```bash
cd microi.mcp
cp .env.example .env
# 编辑 .env 填入后端地址和管理员账号
docker compose up -d
```

### Nginx 反向代理

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

### 验证部署

```bash
curl https://api.example.com/mcp/health
# 应返回 {"status":"ok","server":"microi-mcp-server","version":"1.0.0"}
```

### AI 工具连接 SSE

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

## 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `MICROI_API_URL` | ✅ | Microi 后端 API 地址 | `https://api.microi.net` |
| `MICROI_USERNAME` | ※ | 登录账号（无 Token 时必填） | `admin` |
| `MICROI_PASSWORD` | ※ | 登录密码（无 Token 时必填） | `password` |
| `MICROI_OS_CLIENT` | 否 | 应用标识（多租户场景） | `myApp` |
| `MICROI_TOKEN` | ※ | 直接传 Token（优先于账号密码） | `Bearer xxx` |

## 使用场景示例

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

## 与 Skills、VS Code 插件的关系

| 方案 | 提供的能力 | 适用场景 |
|------|---------|---------|
| **VS Code 插件** | V8 API 知识 + 数据库表结构 + 代码拉取/推送 + 断点调试 | 日常开发 |
| **MCP Server**（本文档） | 实时查询数据库、读取/保存引擎代码、远程执行 | AI 实时操作平台 |
| **[Skills](/doc/ai-skills-integrate)** | 具体场景的编码最佳实践和代码模板 | 编码规范，深度指导 |

::: tip 推荐三者搭配使用
VS Code 插件提供 API 知识和表结构 → MCP 提供实时数据查询和远程执行 → Skills 提供编码最佳实践。
:::
