# Microi MCP Server

让 AI 工具（GitHub Copilot / Cursor / Claude Code）**直接查询 Microi 吾码平台的真实数据**。

MCP（Model Context Protocol）是 Anthropic 制定的开放协议，让 AI 工具以标准化方式连接外部系统。本项目实现了 Microi 吾码平台的 MCP Server，AI 不仅能写代码，还能实时查看数据库结构、查询接口引擎、远程执行代码。

## 提供的 AI 能力（Tools）

| Tool | 功能 | 读/写 |
|------|------|-------|
| `microi_get_status` | 检查 Microi 后端连接状态 | 只读 |
| `microi_get_db_schema` | 获取数据库表结构（表名、字段、类型、描述） | 只读 |
| `microi_list_engines` | 列出所有接口引擎 | 只读 |
| `microi_get_engine_code` | 获取接口引擎源码 | 只读 |
| `microi_run_engine` | 远程执行接口引擎（⚠️ 可能有副作用） | 读写 |
| `microi_list_events` | 列出所有 V8 事件 | 只读 |

## 与 VS Code 插件的区别

| 能力 | VS Code 插件 | MCP Server |
|------|-------------|------------|
| AI 知识库（API + 表结构） | ✅ 自动生成本地文件 | ✅ 实时从后端获取 |
| 写代码 + 智能补全 | ✅ | ✅ |
| 远程执行 / 调试 | ✅ 在 VS Code 内 | ✅ AI 直接调用 |
| 查询真实数据 | ❌ | ✅ AI 可直接查询 |
| 需要 VS Code | 是 | 否（任何支持 MCP 的 AI 工具） |

> 💡 **推荐两者搭配使用**：VS Code 插件负责代码编写 + 调试 + 本地知识库；MCP Server 负责让 AI 实时查询数据、了解最新表结构。

## 安全性

- **使用与 VS Code 插件相同的认证机制**（RSA 加密登录 + JWT Token）
- **所有操作受 Microi 后端权限控制**，用户只能访问自己有权限的数据
- **查询类 Tool 均为只读**，`microi_run_engine` 是唯一的写操作
- **Token 自动刷新**，无需明文存储长期密码
- MCP Server 本质上等同于用该用户身份登录平台，不会绕过任何权限

---

## 部署方式

### 方式一：本地 stdio（推荐开发使用）

适用于 VS Code / Cursor / Claude Code 在本地直接启动 MCP Server 进程。

**1. 安装依赖并构建**

```bash
cd microi.mcp
npm install
npm run build
```

**2. 配置 AI 工具**

#### VS Code (GitHub Copilot)

在 `.vscode/settings.json` 中添加：

```json
{
  "mcp": {
    "servers": {
      "microi": {
        "command": "node",
        "args": ["<path-to>/microi.mcp/dist/index.js"],
        "env": {
          "MICROI_API_URL": "https://api.example.com",
          "MICROI_USERNAME": "your_username",
          "MICROI_PASSWORD": "your_password",
          "MICROI_OS_CLIENT": "your_os_client"
        }
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
      "args": ["<path-to>/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://api.example.com",
        "MICROI_USERNAME": "your_username",
        "MICROI_PASSWORD": "your_password",
        "MICROI_OS_CLIENT": "your_os_client"
      }
    }
  }
}
```

#### Claude Code

```bash
claude mcp add microi -- node <path-to>/microi.mcp/dist/index.js \
  --env MICROI_API_URL=https://api.example.com \
  --env MICROI_USERNAME=your_username \
  --env MICROI_PASSWORD=your_password \
  --env MICROI_OS_CLIENT=your_os_client
```

### 方式二：Docker SSE（推荐团队 / 生产部署）

适用于将 MCP Server 部署为远程服务，多人共用。

**1. 配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 填入实际的 Microi 后端地址和登录账号
```

**2. 启动容器**

```bash
docker compose up -d
```

**3. 配置 AI 工具连接 SSE**

#### VS Code (GitHub Copilot)

```json
{
  "mcp": {
    "servers": {
      "microi": {
        "url": "http://your-server:3000/sse"
      }
    }
  }
}
```

#### Cursor

```json
{
  "mcpServers": {
    "microi": {
      "url": "http://your-server:3000/sse"
    }
  }
}
```

**4. 检查健康状态**

```bash
curl http://localhost:3000/health
```

### 方式三：开发模式（tsx 热重载）

```bash
cd microi.mcp
cp .env.example .env
# 编辑 .env

# 直接运行（自动热重载）
npm run dev
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `MICROI_API_URL` | ✅ | Microi 后端 API 地址 |
| `MICROI_USERNAME` | ✅ | 登录账号 |
| `MICROI_PASSWORD` | ✅ | 登录密码 |
| `MICROI_OS_CLIENT` | | 应用标识（OsClient） |
| `MICROI_RSA_PUBLIC_KEY` | | 自定义 RSA 公钥（PEM） |
| `MCP_TRANSPORT` | | `stdio`（默认） 或 `sse` |
| `MCP_PORT` | | SSE 端口（默认 `3000`） |

## 使用示例

配置完成后，在 AI 对话中直接提问：

```
> 帮我查一下 SysUser 表有哪些字段

AI 调用 microi_get_db_schema(tableName: "SysUser") → 返回完整字段列表

> 列出所有和订单相关的接口引擎

AI 调用 microi_list_engines(keyword: "订单") → 返回引擎列表

> 执行一下 order-statistics 接口引擎

AI 调用 microi_run_engine(apiEngineKey: "order-statistics") → 返回执行结果
```

## License

MIT
