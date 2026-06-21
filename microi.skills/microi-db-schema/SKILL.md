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

## sys_menu 生成默认配置

通过自然语言 + MCP 创建后端菜单时，不能只写 `Name`、`DiyTableId` 和基础路由。绑定 `diyTableId` 的 CRUD 菜单应显式配置，或允许 MCP/后端自动推断以下字段：

- `TableDiyFieldIds` / `SelectFields`：列表列优先选择名称、标题、编号、状态、类型、负责人、金额、数量、时间等业务可读字段。
- `SearchFieldIds`：默认选择名称/标题/编号、状态/类型/分类、负责人/部门/客户、日期时间等常用筛选字段；`Select`、`Radio`、`Checkbox`、`Switch`、`Department`、树/级联/地址等控件默认按等值筛选。
- `NotShowFields`：默认隐藏 `Id`、`XxxId`、`XxxIds`、租户/系统字段、布局控件，以及富文本、上传、地图、子表、代码编辑器等不适合表格展示的重字段。
- `SortFieldIds` / `DefaultOrderBy`：默认包含日期时间、`Sort`、金额/数量等排序字段，并优先按 `CreateTime DESC`。
- `StatisticsFields`：金额、价格、数量、积分、余额、人数、总计等数值字段默认配置 `Sum` 统计。
- `MobileListFields` / `CardTitleTagFields` / `CardBottomTagFields`：移动端或卡片列表默认保留 3-4 个高信息密度字段，标题标签优先状态/类型/分类，底部标签优先金额/数量/时间。

显式配置优先级最高；未指定时由 MCP 生成器或后端 `CreateModule` 兜底补齐，避免空白菜单配置。

隐藏子表菜单规则：用于 `TableChild`、附件明细、微服务页面/路由子表等表单内嵌承载的 `sys_menu`，必须设置 `Display=0`、`AppDisplay=0`、`HasChild=0`。隐藏菜单不应再开启“是否有子集”，否则 PC/移动端菜单树会把上级业务菜单误判为空父菜单。

## 表单控件与布局

表单控件以 `Microi.Client/src/views/form-engine/diy-field-component/` 和 `diy-component-list.json` 为事实源。当前常用组件包括：`Text`、`Guid`、`Textarea`、`NumberText`、`DateTime`、`Select`、`MultipleSelect`、`Radio`、`Checkbox`、`Switch`、`Rate`、`Progress`、`Slider`、`ColorPicker`、`AutoNumber`、`Button`、`Divider`、`CollapseGroup`、`Tabs`、`Alert`、`StaticText`、`Html`、`RichText`、`CodeEditor`、`JsonTable`、`ImgUpload`、`FileUpload`、`Autocomplete`、`TagInput`、`Transfer`、`Cascader`、`Address`、`Department`、`SelectTree`、`TreeCheckbox`、`OpenTable`、`JoinTable`、`JoinForm`、`TableChild`、`Map`、`MapArea`、`Qrcode`、`FontAwesome`、`DevComponent`。

字段较多的表单不要全部堆在一页：优先设置 `diy_table.Tabs`，并给字段写入 `diy_field.Tab`，常见分组为基础信息、联系信息、业务信息、附件备注、扩展信息。局部区域再用 `CollapseGroup` 或字段级 `Tabs` 控件做折叠/分段；`Textarea`、`RichText`、`CodeEditor`、上传、地图、子表、布局/自定义控件等使用 `FormWidth=24` 独占整行。

## 安全注意

- 不要假设 `_Fields` 中列出的每个字段都是物理数据库列。`TableChild`、`Button`、`Divider`、`DevComponent`、`OpenTable` 和 `PhoneSMS` 是配置或交互组件。
- 记住 DIY 表固定字段：`Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted`。
- 使用原生 SQL 时，默认只查询未删除数据（`IsDeleted != 1`）。
- 修改结构元数据时，要考虑缓存失效和物理表变化；改动范围保持收敛。
- 新增或更新低代码字段时，优先使用 `microi_add_field` / `microi_update_field` 等 MCP 原生工具，不要临时手写 V8 元数据。`diy_field.TableId = null` 的字段行可能导致物理列存在，但 FormEngine/表结构加载不可见。
- 修改业务枚举字段时，将 `diy_field.Data` 和 `diy_field.Config` 视为事实源元数据。确认 KeyValue 键与接口引擎、前端筛选使用的值一致，刷新结构缓存，并回读字段行，不要只相信本地常量。
- 普通生成字段的 `diy_field.FormWidth` 保持 null/省略。只有 `CodeEditor`、`Textarea`、`RichText`、上传、`TableChild`、地图/布局或自定义组件等整行控件才使用 `24`。
- 结构变更后，用 `microi_get_db_schema` 验证，并在需要时用 `microi_refresh_schema_cache` 刷新 `diy_table_field_list` 缓存。
