---
name: microi-form-engine
description: Microi 表单引擎设计与控件配置指南。用于创建或修改 diy_table、diy_field、表单组件、字段属性、选项/SQL/数据源引擎数据源、子表、关联表单、定制组件、表单布局和字段事件。
---

# Microi 表单引擎设计

表单引擎同时驱动数据模型、表单、列表、模块、接口配置和工作流配置。处理“新增字段”
不能只做物理 `ALTER TABLE`：必须让 `diy_table`、`diy_field`、物理列、组件
Config/Data、菜单查询列与缓存保持一致。

平台创建 DIY 表时会自动加入 `DiyCommon.FixedDiyField` 定义的 Id、创建/更新时间、
创建人、租户等固定字段。业务 Manifest 不重复声明这些字段；读取 `db.json` 时也不能
因为 `_Fields` 只列出可配置字段，就误判物理表缺少固定字段。

## 必读参考

- 控件完整目录、推荐物理类型和选择规则：`references/component-catalog.md`
- 数据源、字段属性、事件与定制组件：`references/data-source-events.md`
- 表单分组与宽度：`../microi-form-layout/SKILL.md`
- 后端表单事件：`../v8-table-event/SKILL.md`
- 前端字段事件：`../v8-frontend-events/SKILL.md`

## 标准工作流

1. 先通过 `microi_get_db_schema` 读取目标租户的真实表、字段和菜单。
2. 从当前源码
   `Microi.Client/src/views/form-engine/diy-field-component/diy-component-list.json`
   核对控件名；官网页面可能含历史控件。
3. 新表用 `microi_create_table`；字段用 `microi_add_field`，不得直接写
   `diy_field` 或执行临时 DDL。
4. 选项控件同时设置 `data/config`；关联控件明确保存字段和显示字段。
5. 字段多时设置 `diy_table.Tabs` 与字段 `Tab`；只有整行控件设置
   `FormWidth=24`，普通字段省略。
6. 绑定菜单后补齐/允许平台推断列表列、搜索列、隐藏列、排序列、移动端列和默认排序。
7. 回读 `diy_field`、刷新 schema 缓存，再在真实新增/编辑/查看表单中验收。

## 物理类型底线

MCP 建模只使用：

- `varchar(N)`
- `mediumtext` / `longtext`
- `int` / `bigint`
- `decimal(18,N)`

日期时间用 `varchar(25)` 保存 `yyyy-MM-dd HH:mm:ss`，组件用 `DateTime`；
开关用 `int`。不得生成 `datetime/date/timestamp/float/double/boolean/bool/string/text/nvarchar`。
前端设计器 JSON 中的历史默认类型不能覆盖服务器建模规则。

## 选项字段

`Select`、`MultipleSelect`、`Radio`、`Checkbox` 没有数据源时会显示空选项：

```text
1|启用,0|禁用
```

推荐保存稳定 Key、显示可翻译 Label。修改 `Data/Config/KeyValue` 后必须
`microi_get_field_list` 回读，并执行 `microi_refresh_schema_cache`。

## 关联与子表

- `JoinForm`：保存关联记录 Id，同时配置显示字段。
- `OpenTable`：通过弹出列表选择数据；固定授权范围用 `V8.OpenTableSetWhere`。
- `TableChild`：子表必须有真实外键并为回查建立合适的租户组合索引。
- `JoinTable`：用于展示关联集合；不要用前端拼接代替数据权限。

索引一律在 Manifest `tables[].indexes` 声明，通过
`microi_get_table_indexes` → `microi_create_table_index` → 回读完成。

## 自定义组件边界

优先使用现有 44 类标准控件。只有标准控件无法表达交互、且该交互会长期复用时，
才使用 `DevComponent`：

- Vue 组件路径必须稳定并纳入 `Microi.Client` 源码/构建。
- 支持 Add/Edit/View、只读、必填、清空、校验、移动端和暗色主题。
- 不在组件内绕过 FormEngine 权限直接访问任意表。
- 复杂但租户独有的页面优先使用 MicroService + `V8.OpenAppDialog`，避免把客户逻辑打进主前端。

## 验收

- 物理列与 `diy_field` 一致，字段缓存已刷新。
- 新增、编辑、查看、列表、搜索、导入/导出至少覆盖适用场景。
- 选项显示 Label、保存 Key，回显和筛选一致。
- 子表新增/编辑/删除与父表外键正确，不能跨父记录串数据。
- PC 与移动端字段顺序、Tabs、整行控件无截断。
- 前端校验只改善体验；绕过前端直接 HTTP 提交时后端事件仍能阻止非法数据。
