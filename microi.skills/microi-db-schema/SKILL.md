---
name: microi-db-schema
description: Microi 吾码数据库结构与字典指南。用于检查或解释 AI-Project/microi/db.json 中的 Microi 平台表，梳理 diy_table/diy_field/sys_menu 关系，定位 V8 事件存储字段，生成安全的系统表 V8 FormEngine 查询，或分析工作流、SaaS、权限、菜单、接口引擎、数据源和系统配置结构。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi DB Schema

使用本 skill 回答数据库结构问题，并编写依赖 Microi 吾码平台表名、字段名和关系的代码。

## 快速流程

1. 阅读 `references/schema.md` 获取完整数据库结构：固定字段、核心关系、V8 事件字段、全部表分类，以及每张核心表的字段明细。
2. 编写感知结构的 V8 代码时，优先使用带 `_Where` 的 `V8.FormEngine`。只有联表、聚合或 FormEngine 无法表达的场景才使用 `V8.Db.FromSql`，并且必须参数化动态值。
3. 将 `AI-Project/microi/db.json` 视为当前导出字段列表的权威来源。它列出可配置字段；DIY 表还带有导出中未列出的固定系统字段（`Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted`）。

## 核心模型

- `diy_table` 存储表单/表元数据和表级 V8 事件。
- `diy_field` 存储每张 DIY 表的字段，包括组件类型、校验、可见性、数据源、字段事件和模板 V8。
- DIY 表固定物理字段 `Id/CreateTime/UpdateTime/UserId/UserName/IsDeleted` 也必须有正常的 `diy_field` 元数据；设计器通过 `DisplayDefaultField` 默认隐藏，而不是把它们当异常字段。自然语言“修复审计字段/默认字段异常”应调用 `microi_repair_audit_fields`，由平台幂等补元数据，禁止直接用 SQL 临时修租户数据。
- `sys_menu` 将 DIY 表转换为菜单/模块页面，并存储查询、按钮、导入导出、卡片/移动端、工作流和权限相关的模块配置。
- `sys_apiengine` 存储接口引擎定义；通过 `V8.ApiEngine.Run(ApiEngineKey, params)` 调用。
- `sys_datasource` 存储组件和页面可复用的数据源。
- `microi_database` 将扩展数据库 key 映射到 `V8.Dbs.<DbKey>`。
- `wf_*` 表存储工作流设计、节点、连线、实例、待办和历史。

### 外部数据库结构发现

- `microi_get_db_schema` 只读取当前吾码租户自身的 DIY/物理表结构，不接受第三方连接串。
- 用户提供 MySQL、SQL Server、Oracle、PostgreSQL、达梦或人大金仓连接信息时，先用 `microi_list_database_types` 归一化类型，再用 `microi_inspect_external_database` 读取表、字段、类型、空值、默认值、主键和说明。
- 临时读取不等于保存连接。只有用户明确确认后才能调用 `microi_save_database_connection`；结果与工作记录不得回显连接字符串。
- 默认抽样使用只读的 `microi_query_external_database`。用户明确要求数据库管理级操作时，可使用独立的 `microi_execute_external_database` 执行 DML、DDL、存储过程和多语句；该接口必须由后端验证当前用户 `Level >= 9999`、显式确认并写脱敏审计。
- 外部结构映射到吾码时仍需走 Manifest 计划、`dryRun:true`、确认写入和 `microi_validate_system`，不能把第三方物理 DDL 直接复制到吾码主库。
- 大批量同步使用稳定业务键、唯一约束和 upsert；MCP 适合结构发现和抽样，持续搬运应生成接口引擎、Job 或 MQ 消费者。

## AI 应用持久化表创建规则（强制）

- AI 创建的应用、业务模块或演示项目，只要需要持久化业务数据，默认必须通过 `microi_create_table`、Manifest + `microi_generate_system` 等 MCP 标准建模入口创建表，确保物理表、`diy_table` 和 `diy_field` 同步落地。不得只执行 `CREATE TABLE`、只导入物理表，或只写 `diy_table` 元数据。
- 这样创建的业务表必须能在表单引擎中查看，并能由 `V8.FormEngine` / FormEngine HTTP API 正常查询和写入。接口引擎应优先通过 FormEngine 操作这些表；只有联表、聚合或 FormEngine 无法表达的场景才使用参数化 SQL。
- 平台框架表、第三方组件自维护表、迁移中间表、数据库运维表等确实不适合表单引擎的物理表可以例外，但必须在交付记录中说明用途和例外原因，不能把普通 AI 应用业务表归入例外。
- 建模完成后必须回读验收：`microi_get_db_schema` 能看到物理表及字段；`diy_table.Name` 唯一对应物理表；`diy_field.TableId` 均正确关联；至少执行一次 FormEngine 查询或可回滚 CRUD 验证。发现“物理表存在、表单引擎不可见”时，应补齐标准元数据或删除孤儿物理表，不能把它当作已交付。
- 统计表数量时必须区分三个口径：物理表总数、有效 `diy_table` 元数据数、应用安装包内表引用数。安装包引用数可能包含平台基础表并跨应用重复，不能直接相加后当成租户实际唯一表数。

## 数据库索引建模与 MCP 执行规则（强制）

数据库索引是低代码数据模型的一部分，不是上线后的临时 SQL 调优。只要需求、蓝图、接口、Job、工作流或评审明确指出“某表的某些字段需要索引/唯一约束”，就必须把索引写入 Manifest 的 `tables[].indexes`，并通过 `microi_create_table_index` 创建；禁止用 `V8.Db`、接口引擎、原生 FormEngine、一次性维护引擎或手写 `CREATE INDEX` 绕过 MCP。

标准流程：

1. `microi_get_db_schema` 核对表和字段。
2. `microi_get_table_indexes(tableName)` 读取真实物理索引，不能根据 `diy_field.Unique` 或源码猜测。
3. 根据真实查询的 `WHERE / JOIN / ORDER BY / GROUP BY` 设计有序字段，先写入 Manifest `tables[].indexes`。
4. `microi_plan_system` / `microi_generate_system(dryRun:true)` 检查字段引用；单独变更时直接调用 `microi_create_table_index`，并传 `confirmExecution=tableName`。
5. 再次调用 `microi_get_table_indexes` 回读；DIY 表还必须在 `Microi.Client` 的“开发设计 → 索引管理”中看到同名索引、正确字段顺序和唯一性。
6. 删除前先回读精确名称，只能用 `microi_drop_table_index`；主键索引禁止删除，删除确认值使用 `tableName:indexName`。

必须评估并通常建立索引的字段组合：

- 租户业务表：所有租户内高频查询的组合索引通常以 `OsClient` 开头，例如 `(OsClient, Status, CreateTime)`；不能只给 `Status` 建低选择性单列索引。
- 业务唯一键和幂等键：订单号、外部流水号、`EventId`、`IdempotencyKey` 等必须按真实隔离边界建立唯一索引，例如 `(OsClient, OrderNo)`，不能只做“先查再新增”。
- 外键和子表回查：高频 `JOIN`、`TableChildFkFieldName`、`XxxId` 明细列表必须覆盖关联字段；如果查询同时固定租户和状态，按等值字段在前、范围/排序字段在后的顺序设计组合索引。
- 待办、Job、outbox/inbox、重试队列：按实际抢占语句建立 `(OsClient, Status, NextRetryTime)`、`(OsClient, JobKey, ScheduleTime)` 等索引，并为稳定事件/任务键增加唯一索引。
- 高频时间范围列表：常用租户/类型/状态等值条件在前，`CreateTime`、`UpdateTime` 等范围或排序字段在后。

禁止机械建索引：

- 不得把 `SearchFieldIds`、`SortFieldIds`、`StatisticsFields` 中每个字段都自动变成单列索引；必须结合真实查询与选择性。
- `Status`、开关、性别、删除标记等低基数字段通常不能单独建索引；只有作为高频组合索引的一部分才有价值。
- `LIKE '%keyword%'`、富文本、长文本、JSON、上传、地图、布局、子表控件等不能靠普通 B-tree 索引解决；应改为前缀查询、专用搜索引擎、生成列或其它明确方案。
- 组合索引遵守最左前缀；重复/被更长索引左前缀完全覆盖的索引应合并。索引过多会增加写放大和锁等待，必须在交付中说明查询依据。
- 唯一索引是业务约束。创建前必须检查并处理历史重复数据与 `NULL` 语义；不得为了让 DDL 通过而静默删改生产数据。

平台核心表的发布变更还必须同步正式升级资源/迁移，确保新租户和旧租户升级一致；但对指定在线租户的实际创建、修复和回读仍必须通过上述 MCP 索引工具完成，不能只提交迁移源码便宣称线上已生效。

## diy_table 命名规则

创建或修复 `diy_table` 时必须区分三个字段职责：

- `Name`：英文物理表名或表 Key，例如 `edu_exam_question`、`mci_spider_rule`。不要写中文，不要写长说明。
- `Description`：简短中文表名，例如 `商品`、`订单`、`采集规则`。不要写一整段用途说明。
- `Remark`：备注/表详细说明，用于写业务用途、维护规则、交付说明、注意事项等长文本。

AI 或 MCP 生成低代码系统时，必须默认遵守此规则。发现已有数据把长说明写进 `Description` 时，应将短中文名保留在 `Description`，把详细说明迁移到 `Remark`，并回读 `diy_table` 验证。

## sys_menu 生成默认配置

后台菜单默认必须是有分类的树形结构。AI/MCP 创建真实业务后台时，先创建业务域或系统域父菜单，再把 CRUD、报表、规则、任务、日志、设置等叶子模块挂到父级；不要把一批叶子模块直接创建到根级。改造已有菜单时必须回读 `sys_menu`，更新 `ParentId`/`Sort`，补管理员角色权限，并再次回读验证最终树结构。

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

### 1:N 子表建模门禁

- “子表、明细、清单、条目、行项目、多个记录”默认表示主表 1:N 子表；必须创建独立子表，
  并把真实外键放在子表。不得创建主表 `XxxId` 后用 `JoinForm` 冒充子表。
- `JoinForm` 仅用于主表保存一个目标 Id 并嵌入一条独立目标记录；目标表不能与当前表相同。
  关系基数不明确时，MCP 写入前必须询问，不能把 `JoinForm` 当安全默认值。
- 子表外键通常建立 `(OsClient, ParentId)` 组合索引。子表还要有绑定同一子表的隐藏菜单，
  `Display=0`、`AppDisplay=0`、`HasChild=0`。
- Manifest/蓝图审查时，只要发现 1:N 关系对应 `JoinForm`、缺少子表外键、缺少隐藏子菜单
  或缺少回查索引，就必须判定计划不合格，停止写入。
- 新建子表的 `diy_table.Id` / `sys_menu.Id` 尚未回读时，分两阶段创建并用
  `microi_update_field` 补 `TableChild` Config；不得猜 Id，也不得为了单次生成而换成
  `JoinForm`。

`TableChild` 配置中的表、菜单和外键位于 `diy_field.Config` 根节点；主表列名和导入选项
位于 `diy_field.Config.TableChild`。例如：

```json
{
  "TableChildTableId": "子表 diy_table.Id",
  "TableChildSysMenuId": "子表 sys_menu.Id",
  "TableChildSysMenuName": "项目成品清单",
  "TableChildFkFieldName": "XiangmuId",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "ImportAutoFillFk": true,
    "FieldRelations": [
      ["Code", "XiangmuBM", true],
      ["Name", "XiangmuMC"]
    ],
    "DisablePagination": false
  }
}
```

`FieldRelations` 每项依次为 `[主表字段, 子表字段, 是否参与导入匹配]`。全部关系用于新增子表时回写父表值，也用于导入找到父表后回填空的子表字段；只有第三项为 `true` 的关系才用子表/Excel 值反查主表，多项为 `true` 时表示组合匹配。典型场景是 `Code -> XiangmuBM` 参与匹配，而 `Name -> XiangmuMC` 只回填，因此不能把全部关系无条件当作组合匹配。

后端继续读取旧版 `TableChildCallbackField`、`ImportRelations`、`ImportBackfillFields` 和单字段匹配配置。新版前端加载 TableChild 字段时按字段对去重合并为 `FieldRelations`，删除内存中的旧键，并在下一次正常保存字段配置时持久化新格式，避免重复合并。修改后按现有流程刷新结构缓存。

更多表单组件配置项见 `references/form-component-options.md`。新增或修改 `Microi.Client/src/views/form-engine/diy-field-component/` 组件配置时，同步更新该参考文档和官方表单组件文档。

## 简单枚举统一使用 Key-Value（强制）

- 只要字段会跨 PC、UniApp、小程序、Web、接口或多语言使用，`Select`、`Radio`、`MultipleSelect`、`Checkbox` 的简单枚举默认必须使用 `KeyValue`，不得把中文展示文字同时当作数据库值。
- `Key` 使用稳定、简短、大小写固定的英文或 ASCII 标识，不随界面语言和文案调整；`Value` 是给用户展示的中文或当前语言文字。
- 字段配置必须保持 `DataSource:"KeyValue"`、`SelectLabel:"Value"`、`SelectSaveField:"Key"`；数据库、URL 查询参数和接口筛选条件统一保存/传递 `Key`，界面只展示 `Value`。
- 客户端不得各自硬编码另一套中文到英文映射。由字段元数据或业务接口返回公开的 `{Key,Value}` 投影，客户端按 `Value` 渲染、按 `Key` 提交和筛选。
- 旧表若已经保存中文 `Value`，上线时必须提供明确的 `Value -> Key` 数据迁移，并在过渡期让读取接口兼容 Key 和 Value；迁移后回读确认数据库只剩合法 Key，并刷新字段缓存。
- 只有展示值与存储值永远相同、无需搜索筛选、无需多语言且不会跨客户端使用的纯静态字段，才允许使用简单 `Data` 数组。

### 复盘：Key-Value 展示值与筛选值混用

当字段元数据已改为 Key-Value、但历史记录仍保存中文 Value 时，界面按钮传英文 Key 会造成等值筛选全部为 0。修复不能只改按钮文案或只加前端映射，必须同时核对字段 Data/Config、存量物理数据、接口入参归一化和接口返回值；以“数据库存 Key、接口筛 Key、界面显 Value”的端到端回读为验收标准。

## 安全注意

- 不要假设 `_Fields` 中列出的每个字段都是物理数据库列。`TableChild`、`Button`、`Divider`、`DevComponent`、`OpenTable` 和 `PhoneSMS` 是配置或交互组件。
- 记住 DIY 表固定字段：`Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted`。
- 使用原生 SQL 时，默认只查询未删除数据（`IsDeleted != 1`）。
- 修改结构元数据时，要考虑缓存失效和物理表变化；改动范围保持收敛。
- 新增或更新低代码字段时，优先使用 `microi_add_field` / `microi_update_field` 等 MCP 原生工具，不要临时手写 V8 元数据。`diy_field.TableId = null` 的字段行可能导致物理列存在，但 FormEngine/表结构加载不可见。
- 修改业务枚举字段时，将 `diy_field.Data` 和 `diy_field.Config` 视为事实源元数据。确认 KeyValue 键与接口引擎、前端筛选使用的值一致，刷新结构缓存，并回读字段行，不要只相信本地常量。
- 普通生成字段的 `diy_field.FormWidth` 保持 null/省略。只有 `CodeEditor`、`Textarea`、`RichText`、上传、`TableChild`、地图/布局或自定义组件等整行控件才使用 `24`。
- 结构变更后，用 `microi_get_db_schema` 验证，并在需要时用 `microi_refresh_schema_cache` 刷新 `diy_table_field_list` 缓存。
