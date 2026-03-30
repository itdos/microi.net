---
title: AI MCP Integration
---

# AI MCP Integration

> MCP (Model Context Protocol) is an open protocol created by Anthropic that enables AI tools to connect to external systems in a standardized way. Microi MCP Server ([Open Source Repository](https://gitee.com/microi-net/microi.mcp)) allows AI tools to directly connect to the Microi platform, query database schemas in real-time, read engine code, and execute engines remotely.

## What is Microi MCP

Microi MCP Server enables AI tools like GitHub Copilot, Cursor, and Claude Code to **directly operate the Microi platform** — no more manually copying and pasting table structures or API docs. AI can retrieve your database schema and business code in real-time.

## AI Capabilities

| Tool | Function | Read/Write |
|------|----------|------------|
| `microi_get_status` | Check backend connection status | Read-only |
| `microi_get_db_schema` | Get database schema (table names, fields, types, descriptions) | Read-only |
| `microi_list_engines` | List all API engines | Read-only |
| `microi_get_engine_code` | Get API engine JavaScript source code | Read-only |
| `microi_save_engine_code` | Save API engine code | Read-write |
| `microi_create_engine` | Create a new API engine | Read-write |
| `microi_run_engine` | Execute API engine remotely | Read-write |
| `microi_list_events` | List all V8 form events | Read-only |
| `microi_get_event_code` | Get V8 event source code | Read-only |
| `microi_save_event_code` | Save V8 event code | Read-write |

## Prerequisites

- Microi backend service deployed
- An AI programming tool installed (GitHub Copilot / Cursor / Claude Code)

## Recommended: VS Code Extension (Zero Configuration)

::: tip Most users don't need manual MCP configuration
After installing the [Microi VS Code Extension](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine), MCP is automatically configured and ready to use out of the box.
:::

After installing the extension, it automatically:
- Generates `.vscode/mcp.json` (GitHub Copilot) and `.cursor/mcp.json` (Cursor)
- Auto-refreshes tokens, no password storage needed
- Injects AI instruction files (`.github/copilot-instructions.md`, `CLAUDE.md`, `.cursorrules`)

**Workflow:** Install extension → Configure server connection → Pull code → MCP is ready.

> The following content is for users who don't use the VS Code extension or need SSE remote deployment.

## Manual Configuration: Local stdio Mode

The AI tool automatically launches the MCP Server process on each startup.

### Installation

```bash
git clone https://gitee.com/microi-net/microi.mcp.git
cd microi.mcp
npm install
npm run build
```

### GitHub Copilot (VS Code)

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "microi": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://your-api-url",
        "MICROI_USERNAME": "username",
        "MICROI_PASSWORD": "password",
        "MICROI_OS_CLIENT": ""
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "microi": {
      "command": "node",
      "args": ["/path/to/microi.mcp/dist/index.js"],
      "env": {
        "MICROI_API_URL": "https://your-api-url",
        "MICROI_USERNAME": "username",
        "MICROI_PASSWORD": "password",
        "MICROI_OS_CLIENT": ""
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add microi -- \
  env MICROI_API_URL=https://your-api-url \
  env MICROI_USERNAME=username \
  env MICROI_PASSWORD=password \
  node /path/to/microi.mcp/dist/index.js
```

::: warning Security Notice
Configuration files contain sensitive information. Add `.vscode/mcp.json` and `.cursor/mcp.json` to `.gitignore` to prevent committing to Git.
:::

## Remote SSE Mode (Team / Production Recommended)

Deploy MCP Server as a Docker container so everyone connects to the same SSE endpoint.

### Docker Deployment

```bash
cd microi.mcp
cp .env.example .env
# Edit .env with backend URL and admin credentials
docker compose up -d
```

### Nginx Reverse Proxy

Recommended to mount under your existing API domain:

```nginx
# MCP SSE endpoint
location /mcp/sse {
    proxy_pass http://127.0.0.1:3000/sse;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
}

# MCP message endpoint
location /mcp/messages {
    proxy_pass http://127.0.0.1:3000/messages;
    proxy_http_version 1.1;
}

# MCP health check
location /mcp/health {
    proxy_pass http://127.0.0.1:3000/health;
}
```

### Verify Deployment

```bash
curl https://api.example.com/mcp/health
# Should return {"status":"ok","server":"microi-mcp-server","version":"1.0.0"}
```

### Connect AI Tools via SSE

**GitHub Copilot** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "microi": {
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "X-Microi-Username": "username",
        "X-Microi-Password": "password",
        "X-Microi-OsClient": ""
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "microi": {
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "X-Microi-Username": "username",
        "X-Microi-Password": "password",
        "X-Microi-OsClient": ""
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MICROI_API_URL` | ✅ | Microi backend API URL | `https://api.microi.net` |
| `MICROI_USERNAME` | ※ | Login username (required without Token) | `admin` |
| `MICROI_PASSWORD` | ※ | Login password (required without Token) | `password` |
| `MICROI_OS_CLIENT` | No | Application identifier (multi-tenant) | `myApp` |
| `MICROI_TOKEN` | ※ | Direct Token (takes priority over username/password) | `Bearer xxx` |

## Usage Examples

After configuring MCP, you can directly operate the platform in AI conversations:

```
You: Show me all tables in the current database
AI: (calls microi_get_db_schema) The current database has 42 tables...

You: Create an API engine to query the order list
AI: (calls microi_get_db_schema to understand schema → generates code → calls microi_create_engine)
    API engine created with Key: get-order-list...

You: Execute it and show me the results
AI: (calls microi_run_engine) Returned 20 order records...
```

## Relationship with Skills and VS Code Extension

| Solution | Capabilities | Use Case |
|----------|-------------|----------|
| **VS Code Extension** | V8 API knowledge + database schema + code push/pull + debugging | Daily development |
| **MCP Server** (this document) | Real-time database query, read/save engine code, remote execution | AI real-time platform operations |
| **[Skills](/en/doc/ai-integrate/ai-skills-integrate)** | Scenario-specific coding best practices and code templates | Coding standards, in-depth guidance |

::: tip Recommended: Use all three together
VS Code Extension provides API knowledge and schema → MCP provides real-time data query and remote execution → Skills provide coding best practices.
:::
