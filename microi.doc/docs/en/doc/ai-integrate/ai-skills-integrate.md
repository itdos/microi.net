---
title: AI Skills Integration
---

# AI Skills Integration

> Skills are a set of structured instruction files (SKILL.md) that tell AI tools how to write code in specific scenarios. Each Skill covers a development scenario with complete API usage, code templates, and security standards.

## What are Microi Skills

Microi Skills ([Open Source Repository](https://gitee.com/microi-net/microi.skills)) are a set of **AI programming best practice files** that enable AI tools like GitHub Copilot, Cursor, and Claude Code to automatically follow correct API usage and security standards when writing Microi platform code.

**Without Skills:** AI may write non-standard code (SQL concatenation, missing permission checks, unvalidated parameters, etc.).

**With Skills:** AI automatically references Skill files to generate code that follows platform best practices (parameterized queries, permission checks, standard return formats, etc.).

## Available Skills

| Skill | Scenario | File Path |
|-------|----------|-----------|
| **v8-crud-api** | V8 API Engine CRUD | `microi.skills/v8-crud-api/SKILL.md` |
| **v8-table-event** | Form V8 Event Development | `microi.skills/v8-table-event/SKILL.md` |
| **v8-sql-query** | Secure SQL Queries | `microi.skills/v8-sql-query/SKILL.md` |
| **v8-http-integration** | External HTTP API Calls | `microi.skills/v8-http-integration/SKILL.md` |
| **v8-cache-pattern** | Redis Cache Patterns | `microi.skills/v8-cache-pattern/SKILL.md` |
| **v8-security** | Security Best Practices | `microi.skills/v8-security/SKILL.md` |
| **v8-workflow** | Workflow Approval Events | `microi.skills/v8-workflow/SKILL.md` |
| **v8-mongodb** | MongoDB Operations | `microi.skills/v8-mongodb/SKILL.md` |
| **v8-mq-mqtt** | Message Queue & MQTT | `microi.skills/v8-mq-mqtt/SKILL.md` |
| **page-engine** | UI Engine Page JSON Generation | `microi.skills/page-engine/SKILL.md` |
| **print-engine** | Print Engine Template JSON Generation | `microi.skills/print-engine/SKILL.md` |

## Prerequisites

- An AI programming tool installed (GitHub Copilot / Cursor / Claude Code)
- Microi development environment set up

## Quick Integration

### Step 1: Get Skills

```bash
git clone https://gitee.com/microi-net/microi.skills.git
```

Place the `microi.skills` folder in your workspace root directory.

### Step 2: Configure Your AI Tool

Choose the configuration method based on your AI tool.

---

### GitHub Copilot (VS Code)

::: tip Recommended
Install the [Microi VS Code Extension](https://marketplace.visualstudio.com/items?itemName=microi.v8-engine), which automatically generates `.github/copilot-instructions.md` and references all Skills — **no manual configuration needed**.
:::

**Manual configuration:** Append to `.github/copilot-instructions.md` in your project root:

```markdown
## V8 Engine Coding Best Practices

When writing V8 engine code, refer to the following Skill files:
- microi.skills/v8-crud-api/SKILL.md — CRUD operations
- microi.skills/v8-table-event/SKILL.md — Form events
- microi.skills/v8-sql-query/SKILL.md — SQL queries
- microi.skills/v8-http-integration/SKILL.md — HTTP integration
- microi.skills/v8-cache-pattern/SKILL.md — Redis cache
- microi.skills/v8-security/SKILL.md — Security standards
- microi.skills/page-engine/SKILL.md — UI Engine
- microi.skills/print-engine/SKILL.md — Print Engine
```

You can also reference Skills on demand in conversations:

```
@workspace Refer to microi.skills/v8-crud-api/SKILL.md to help me write a user management API engine
```

---

### Cursor

**Method A: Add rule files in `.cursor/rules/` (Recommended)**

Create `.cursor/rules/microi-skills.mdc`:

```yaml
---
description: Microi V8 Engine code writing best practices
globs: ["microi-v8-engine/**/*.js"]
---

When writing V8 engine code, refer to the following Skill files for API usage and best practices:
- @microi.skills/v8-crud-api/SKILL.md
- @microi.skills/v8-table-event/SKILL.md
- @microi.skills/v8-sql-query/SKILL.md
- @microi.skills/v8-http-integration/SKILL.md
- @microi.skills/v8-cache-pattern/SKILL.md
- @microi.skills/v8-security/SKILL.md
```

**Method B: Merge into `.cursorrules`**

```bash
for f in microi.skills/*/SKILL.md; do
  echo -e "\n---\n" >> .cursorrules
  cat "$f" >> .cursorrules
done
```

---

### Claude Code

Append to `CLAUDE.md` in the project root:

```markdown
## V8 Engine Coding Skills

When writing V8 engine code, refer to the following files:
- microi.skills/v8-crud-api/SKILL.md
- microi.skills/v8-table-event/SKILL.md
- microi.skills/v8-sql-query/SKILL.md
- microi.skills/v8-http-integration/SKILL.md
- microi.skills/v8-cache-pattern/SKILL.md
- microi.skills/v8-security/SKILL.md
```

## Usage Results

After configuring Skills, AI code generation quality improves significantly:

**❌ Without Skills:**
```
You: Write an API engine for paginated user list query
AI: (May concatenate SQL, no permission check, non-standard return format)
```

**✅ With Skills:**
```
You: Write an API engine for paginated user list query
AI: (References v8-crud-api Skill)
    ✅ Uses V8.FormEngine.GetTableData + _Where parameterized query
    ✅ Includes pagination parameter validation
    ✅ Uses V8.CurrentUser for permission check
    ✅ Standard DosResult return format
```

## Relationship with MCP and VS Code Extension

| Solution | Capabilities | Use Case |
|----------|-------------|----------|
| **VS Code Extension** | Complete V8 API knowledge + database schema + code push/pull | Daily development, automation |
| **[MCP Server](/en/doc/ai-integrate/ai-mcp-integrate)** | Real-time database schema query, read/save engine code, remote execution | AI real-time platform operations |
| **Skills** (this document) | Scenario-specific coding best practices and code templates | Coding standards, in-depth guidance |

::: tip Recommended: Use all three together
VS Code Extension provides API knowledge and schema → MCP provides real-time data query → Skills provide coding best practices.
:::

## Custom Skills

You can create custom Skill files for your business scenarios:

1. Create a new directory under `microi.skills/`, e.g., `my-business/`
2. Create a `SKILL.md` file following the format of existing Skills
3. Add the reference path in your AI configuration file

**Basic SKILL.md format:**

```markdown
# Skill Title

You are developing xxx feature for the Microi platform.

## Core Rules
- Rule 1
- Rule 2

## Code Templates

(Code examples)

## Common Mistakes
- ❌ Wrong approach
- ✅ Correct approach
```
