# Microi MCP Server

让 AI 工具（GitHub Copilot / Cursor / Claude Code）**直接连接 Microi 吾码平台**，实时查询数据库结构、读取接口引擎代码、远程执行引擎。

> MCP（Model Context Protocol）是 Anthropic 制定的开放协议，让 AI 以标准化方式连接外部系统。本项目是 Microi 吾码平台的官方 MCP Server 实现。

---

## 提供的 AI 能力（6 个 Tools）

| Tool | 功能 | 读/写 |
|------|------|-------|
| `microi_get_status` | 检查 Microi 后端连接状态 | 只读 |
| `microi_get_db_schema` | 获取数据库表结构（表名、字段、类型、描述） | 只读 |
| `microi_list_engines` | 列出所有接口引擎 | 只读 |
| `microi_get_engine_code` | 获取接口引擎 JavaScript 源码 | 只读 |
| `microi_run_engine` | 远程执行接口引擎（⚠️ 可能有副作用） | 读写 |
| `microi_list_events` | 列出所有 V8 表单事件 | 只读 |

---

## 快速开始：如何使用 MCP

### 第 1 步：选择运行模式

| 模式 | 适用场景 | 特点 |
|------|---------|------|
| **本地 stdio** | 个人开发 | AI 工具自动拉起 MCP 进程，零部署 |
| **远程 SSE** | 团队共享 / 生产环境 | Docker 部署一次，所有人连同一个地址 |

### 第 2 步：安装和构建

```bash
git clone https://gitee.com/microi-net/microi.mcp.git
cd microi.mcp
npm install
npm run build
```

### 第 3 步：配置到你的 AI 工具

---

## 📌 本地 stdio 模式（个人开发推荐）

AI 工具在每次启动时自动拉起 MCP Server 进程，无需单独部署。

### GitHub Copilot（VS Code）

在项目的 `.vscode/settings.json` 中添加：

```jsonc
{
  "mcp": {
    "servers": {
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
}
```

> 将 `/path/to/microi.mcp` 替换为实际克隆路径。`MICROI_OS_CLIENT` 留空则使用后端默认应用。

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

### Claude Code

```bash
claude mcp add microi -- \
  env MICROI_API_URL=https://api.microi.net \
  env MICROI_USERNAME=your_username \
  env MICROI_PASSWORD=your_password \
  node /path/to/microi.mcp/dist/index.js
```

---

## 📌 远程 SSE 模式（团队 / 生产推荐）

将 MCP Server 部署为 Docker 容器，所有人连同一个 SSE 地址。

### 部署方式 A：挂载到已有的 API 域名下（推荐，无需单独域名）

通过 Nginx 反向代理，将 MCP 挂载到已有的 API 域名下，如 `https://api.microi.net/mcp/sse`。

**1. 启动 MCP 容器**

```bash
cd microi.mcp
cp .env.example .env
# 编辑 .env 填入后端地址和管理员账号
```

```bash
docker compose up -d
```

**2. 配置 Nginx 反向代理**

将 `nginx-mcp.conf` 的内容添加到 api.microi.net 的 Nginx `server {}` 块中：

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

```bash
nginx -t && nginx -s reload
```

**3. 验证部署**

```bash
curl https://api.microi.net/mcp/health
# 应返回 {"status":"ok","server":"microi-mcp-server","version":"1.0.0"}
```

**4. AI 工具连接 SSE**

GitHub Copilot（`.vscode/settings.json`）：

```jsonc
{
  "mcp": {
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

> ⚠️ 配置文件包含敏感信息（密码），请加入 `.gitignore` 避免提交到 Git。

### 部署方式 B：独立域名

如果希望使用独立域名（如 `mcp.microi.net`），直接将容器的 3000 端口反向代理到该域名即可，AI 工具 URL 改为 `https://mcp.microi.net/sse`。

---

## 发布 Docker 镜像

```bash
# 开源版模板（需修改 Docker 帐号信息）
chmod +x publish-demo.sh
./publish-demo.sh
```

---

## 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `MICROI_API_URL` | ✅ | Microi 后端 API 地址 | `https://api.microi.net` |
| `MICROI_USERNAME` | ✅ | 登录账号 | `admin` |
| `MICROI_PASSWORD` | ✅ | 登录密码（明文，自动 RSA 加密） | |
| `MICROI_OS_CLIENT` | | 应用标识 | |
| `MICROI_RSA_PUBLIC_KEY` | | 自定义 RSA 公钥（PEM） | |
| `MCP_TRANSPORT` | | `stdio`（默认） 或 `sse` | |
| `MCP_PORT` | | SSE 端口（默认 `3000`） | |

---

## 使用示例

配置完成后，在 AI 对话中直接提问，AI 会自动调用 MCP Tool：

```
你：帮我查一下 Sys_User 表有哪些字段
AI：[调用 microi_get_db_schema] → 返回完整字段列表

你：列出所有和订单相关的接口引擎
AI：[调用 microi_list_engines] → 返回引擎列表

你：执行一下 order-statistics 接口引擎
AI：[调用 microi_run_engine] → 返回执行结果
```

---

## 安全性

- SSE 模式每个连接独立认证，必须提供帐号密码，仅知道 URL 无法访问
- 使用与 VS Code 插件完全相同的认证机制（RSA 加密登录 + JWT Token）
- 所有操作受 Microi 后端权限控制，用户只能访问自己有权限的数据
- 查询类 Tool 均为只读，`microi_run_engine` 是唯一的写操作
- Token 自动刷新（每 12 分钟），无需明文存储长期密码
- MCP Server 等同于用该用户身份登录平台，不会绕过任何权限
- 不同租户（OsClient）连接不同数据库，数据完全隔离

---

## 与 VS Code 插件 / Skills 的关系

| 方案 | 覆盖内容 | 适用场景 |
|------|---------|---------|
| **VS Code 插件** | V8 全部 API 知识 + 数据库表结构 + 代码补全 | 日常开发，自动化 |
| **MCP Server**（本项目） | 实时查询数据、远程执行引擎 | AI 实时操作平台 |
| **Skills** | 具体场景的编码最佳实践和代码模板 | 进阶模式，深度指导 |

> 💡 推荐三者搭配使用：插件提供 API 知识和表结构 → MCP 提供实时数据查询 → Skills 提供编码最佳实践。

## License

MIT

## License

MIT
