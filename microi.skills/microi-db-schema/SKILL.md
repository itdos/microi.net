---
name: microi-db-schema
description: Microi吾码 database schema and dictionary guidance. Use when Codex needs to inspect or explain Microi platform tables from ai-helper/microi/db.json, map diy_table/diy_field/sys_menu relationships, locate V8 event storage fields, generate safe V8 FormEngine queries against system tables, or reason about workflow, SaaS, permission, menu, API engine, datasource, and system configuration schemas.
---

# Microi DB Schema

Use this skill to answer schema questions and write code that depends on Microi吾码 platform table names, field names, and relationships.

## Quick Workflow

1. Read `references/schema-overview.md` first for the core mental model, table categories, fixed fields, and relationship map.
2. Read `references/core-tables.md` when the task touches `diy_table`, `diy_field`, `sys_menu`, V8 event storage, API engine, data source, SaaS, permissions, or workflow tables.
3. Read `references/table-catalog.md` only when exact fields for non-core tables are needed.
4. Prefer `V8.FormEngine` with `_Where` for schema-aware V8 code. Use `V8.Db.FromSql` only for joins, aggregates, or cases FormEngine cannot express, and always parameterize values.
5. Treat `ai-helper/microi/db.json` as the source dictionary for current exported fields. It lists configurable fields; DIY tables also carry fixed system fields documented in the overview reference.

## Core Model

- `diy_table` stores table/form metadata and table-level V8 events.
- `diy_field` stores fields for each DIY table, including component type, validation, visibility, data source, field events, and template V8.
- `sys_menu` turns a DIY table into a menu/module page and stores query, button, import/export, card/mobile, workflow, and permission-facing module configuration.
- `sys_apiengine` stores interface engine definitions; call them with `V8.ApiEngine.Run(ApiEngineKey, params)`.
- `sys_datasource` stores reusable data sources for components and pages.
- `microi_database` maps extension database keys to `V8.Dbs.<DbKey>`.
- `wf_*` tables store workflow design, nodes, lines, instances, work items, and history.

## Safety Notes

- Do not assume every field listed in `_Fields` is a physical DB column. `TableChild`, `Button`, `Divider`, `DevComponent`, `OpenTable`, and `PhoneSMS` are configuration or interaction components.
- Remember fixed fields on DIY tables: `Id`, `CreateTime`, `UpdateTime`, `UserId`, `UserName`, `IsDeleted`.
- Query non-deleted rows by default (`IsDeleted != 1`) when using raw SQL.
- When changing schema metadata, account for cache invalidation and physical table changes; keep edits narrowly scoped.
