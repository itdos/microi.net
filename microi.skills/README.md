# Microi Skills

**Microi 吾码 V8 引擎 AI 编程技能集合** — 让 AI 工具在编写 V8 接口引擎代码时具备最佳实践知识。

## 什么是 Skills？

Skills 是一系列指令文件，告诉 AI 工具（GitHub Copilot / Cursor / Claude Code）在特定场景下应该如何编写代码。每个 Skill 覆盖一个 V8 开发场景，包含完整的 API 用法、代码模板和最佳实践。

## 包含的 Skills

| Skill | 场景 | 文件 |
|-------|------|------|
| **v8-crud-api** | 创建增删改查接口引擎 | `v8-crud-api/SKILL.md` |
| **v8-table-event** | 编写表单事件（提交前/后、打开/关闭） | `v8-table-event/SKILL.md` |
| **v8-sql-query** | 安全的 SQL 查询（参数化、_Where 语法） | `v8-sql-query/SKILL.md` |
| **v8-http-integration** | 调用外部 HTTP API（微信、支付、短信等） | `v8-http-integration/SKILL.md` |
| **v8-cache-pattern** | Redis 缓存模式（防缓存穿透、过期策略） | `v8-cache-pattern/SKILL.md` |
| **v8-security** | 安全最佳实践（权限校验、输入验证、防注入） | `v8-security/SKILL.md` |

## 部署方式

### 方式一：GitHub Copilot（推荐）

将整个 `microi.skills` 文件夹放到项目根目录或 VS Code 工作区中，然后在 `.github/copilot-instructions.md` 中引用：

```markdown
参考以下 Skill 文件来编写 V8 引擎代码：
- microi.skills/v8-crud-api/SKILL.md
- microi.skills/v8-table-event/SKILL.md
- microi.skills/v8-sql-query/SKILL.md
- microi.skills/v8-http-integration/SKILL.md
- microi.skills/v8-cache-pattern/SKILL.md
- microi.skills/v8-security/SKILL.md
```

或者在 VS Code 设置中配置 Copilot 自定义指令指向这些文件。

### 方式二：Cursor

将 Skill 内容合并追加到项目的 `.cursorrules` 文件中：

```bash
# 追加所有 Skill 到 .cursorrules
for f in microi.skills/*/SKILL.md; do
  echo -e "\n---\n" >> .cursorrules
  cat "$f" >> .cursorrules
done
```

或者在 Cursor Settings → Rules 中逐个添加 Skill 文件路径。

### 方式三：Claude Code

将 Skill 内容追加到项目的 `CLAUDE.md` 中：

```bash
# 追加所有 Skill 到 CLAUDE.md
for f in microi.skills/*/SKILL.md; do
  echo -e "\n---\n" >> CLAUDE.md
  cat "$f" >> CLAUDE.md
done
```

### 方式四：按需使用

不做全局配置，在 AI 对话中直接引用：

```
@workspace 参考 microi.skills/v8-crud-api/SKILL.md 帮我写一个用户管理的接口引擎
```

## 与 VS Code 插件的关系

| 方案 | 覆盖内容 | 适用场景 |
|------|---------|---------|
| **VS Code 插件**（自动生成） | V8 全部 API + 数据库表结构 | 日常开发，自动化 |
| **Skills**（本项目） | 具体场景的最佳实践和代码模板 | 进阶模式，深度指导 |
| **MCP Server** | 实时查询数据、远程执行引擎 | AI 实时操作平台 |

> 💡 推荐三者搭配使用：插件提供 API 知识和表结构 → Skills 提供编码最佳实践 → MCP 提供实时数据查询能力。

## License

MIT
