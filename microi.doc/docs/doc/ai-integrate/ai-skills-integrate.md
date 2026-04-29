---
title: AI Skills 集成
---

# AI Skills 集成

> Skills 是一系列结构化指令文件（SKILL.md），告诉 AI 工具在特定场景下应该如何编写代码。每个 Skill 覆盖一个开发场景，包含完整的 API 用法、代码模板和安全规范。

## 什么是 Microi Skills

Microi Skills（[开源仓库](https://gitee.com/microi-net/microi.skills)）是一组 **AI 编程最佳实践文件**，让 GitHub Copilot、Cursor、Claude Code 等 AI 工具在编写 Microi 平台代码时，自动遵循正确的 API 用法和安全规范。

**没有 Skills 时：** AI 可能写出不规范的代码（拼接 SQL、缺少权限校验、参数未验证等）。

**有 Skills 时：** AI 自动参考 Skill 文件，生成符合平台最佳实践的代码（参数化查询、权限校验、规范的返回格式等）。

## 可用的 Skills

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

## 前置条件

- 已安装 AI 编程工具（GitHub Copilot / Cursor / Claude Code 任一）
- 已搭建 Microi 吾码开发环境

## 快速集成

### 第 1 步：获取 Skills

```bash
git clone https://gitee.com/microi-net/microi.skills.git
```

将 `microi.skills` 文件夹放到你的工作区根目录下。

### 第 2 步：配置 AI 工具

根据你使用的 AI 工具，选择对应的配置方式。

---

### GitHub Copilot（VS Code）

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

### Cursor

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

### Claude Code

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

## 使用效果

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

## 与 MCP、VS Code 插件的关系

| 方案 | 提供的能力 | 适用场景 |
|------|---------|---------|
| **VS Code 插件** | V8 全部 API 知识 + 数据库表结构 + 代码拉取/推送 | 日常开发，自动化 |
| **[MCP Server](https://microi.net/doc/ai-integrate/ai-mcp-integrate)** | 实时查询数据库结构、读取/保存引擎代码、远程执行 | AI 实时操作平台 |
| **Skills**（本文档） | 具体场景的编码最佳实践和代码模板 | 编码规范，深度指导 |

::: tip 推荐三者搭配使用
VS Code 插件提供 API 知识和表结构 → MCP 提供实时数据查询 → Skills 提供编码最佳实践。
:::

## 自定义 Skills

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
