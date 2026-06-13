---
name: microi-db-schema
description: Microi 吾码数据库结构与字典指南。用于检查或解释 AI-Project/microi/db.json 中的 Microi 平台表，梳理 diy_table/diy_field/sys_menu 关系，定位 V8 事件存储字段，生成安全的系统表 V8 FormEngine 查询，或分析工作流、SaaS、权限、菜单、接口引擎、数据源和系统配置结构。
---

# Microi DB Schema

使用本 skill 回答数据库结构问题，并编写依赖 Microi 吾码平台表名、字段名和关系的代码。

## 快速流程

1. 阅读 `references/schema.md` 获取完整数据库结构：固定字段、核心关系、V8 事件字段、全部表分类，以及每张核心表的字段明细。
2. 编写感知结构的 V8 代码时，优先使用带 `_Where` 的 `V8.FormEngine`。只有联表、聚合或 FormEngine 无法表达的场景才使用 `V8.Db.FromSql`，并且必须参数化动态值。
3. 将 `AI-Project/microi/db.json` 视为当前导出字段列表的权威来源。它列出可配置字段；DIY 表还带有导出中未列出的固定系统字段（`Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted`）。

## 核心模型

- `diy_table` 存储表单/表元数据和表级 V8 事件。
- `diy_field` 存储每张 DIY 表的字段，包括组件类型、校验、可见性、数据源、字段事件和模板 V8。
- `sys_menu` 将 DIY 表转换为菜单/模块页面，并存储查询、按钮、导入导出、卡片/移动端、工作流和权限相关的模块配置。
- `sys_apiengine` 存储接口引擎定义；通过 `V8.ApiEngine.Run(ApiEngineKey, params)` 调用。
- `sys_datasource` 存储组件和页面可复用的数据源。
- `microi_database` 将扩展数据库 key 映射到 `V8.Dbs.<DbKey>`。
- `wf_*` 表存储工作流设计、节点、连线、实例、待办和历史。

## 安全注意

- 不要假设 `_Fields` 中列出的每个字段都是物理数据库列。`TableChild`、`Button`、`Divider`、`DevComponent`、`OpenTable` 和 `PhoneSMS` 是配置或交互组件。
- 记住 DIY 表固定字段：`Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted`。
- 使用原生 SQL 时，默认只查询未删除数据（`IsDeleted != 1`）。
- 修改结构元数据时，要考虑缓存失效和物理表变化；改动范围保持收敛。
- 新增或更新低代码字段时，优先使用 `microi_add_field` / `microi_update_field` 等 MCP 原生工具，不要临时手写 V8 元数据。`diy_field.TableId = null` 的字段行可能导致物理列存在，但 FormEngine/表结构加载不可见。
- 修改业务枚举字段时，将 `diy_field.Data` 和 `diy_field.Config` 视为事实源元数据。确认 KeyValue 键与接口引擎、前端筛选使用的值一致，刷新结构缓存，并回读字段行，不要只相信本地常量。
- 普通生成字段的 `diy_field.FormWidth` 保持 null/省略。只有 `CodeEditor`、`Textarea`、`RichText`、上传、`TableChild`、地图/布局或自定义组件等整行控件才使用 `24`。
- 结构变更后，用 `microi_get_db_schema` 验证，并在需要时用 `microi_refresh_schema_cache` 刷新 `diy_table_field_list` 缓存。
