---
name: microi-form-engine
description: Microi 表单引擎设计与控件配置指南。用于创建或修改 diy_table、diy_field、表单组件、字段属性、选项/SQL/数据源引擎数据源、子表、关联表单、定制组件、表单布局和字段事件。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

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

## `JoinForm` 与 `TableChild` 硬性判定

这两个控件都能在表单内显示另一张表，但数据关系和运行组件完全不同，生成表/字段前
必须先确定基数，不得因为名称里出现“关联”就默认使用 `JoinForm`。

| 判断项 | `JoinForm`（关联表单） | `TableChild`（子表） |
|---|---|---|
| 关系 | 当前记录关联**一个**独立目标记录，通常为 N:1 或 1:1 | 一条主表记录拥有 0..N 条明细，标准 1:N |
| 关系存储 | 主表字段保存目标记录 `Id` | **子表物理外键**保存主表 `Id`/指定主键值 |
| 界面 | 嵌入一张 `diy-form`，只展示/编辑一条目标记录 | 嵌入一张 `diy-table`，提供明细列表、分页及行级增删改 |
| 核心配置 | `Config.JoinForm.{TableId,TableName,JoinFieldName,FormMode,Id,_SearchEqual}` | `Config` 根节点的子表/菜单/外键 Id，加 `Config.TableChild` 运行选项 |
| 目标限制 | 目标表必须与当前表不同；相同则组件拒绝渲染 | 子表应是独立明细表，并通过外键限定到当前父记录 |

### 决策规则（强制）

- 需求出现“子表、明细、清单、条目、行项目、多个、若干条、记录列表”，且没有明确说明
  “只关联一条已有记录”时，默认建模为 `TableChild`。
- 只要一条父记录可能有 0..N 条目标记录，或需要在父表单内列表、分页、新增、编辑、删除
  多行，就必须用 `TableChild`。
- 只有主表保存一个目标记录 Id、并需要把该独立记录的完整表单嵌入当前表单时，才用
  `JoinForm`。选择一条记录但无需嵌入完整表单时，优先 `OpenTable`/`Select`。
- 语义仍不明确时必须在任何 MCP 写入前询问基数；禁止静默退化为 `JoinForm`。
- 禁止把“明细”设计为主表 `XxxId + JoinForm`；禁止让 `JoinForm.TableId/TableName`
  指向当前表；禁止把 1:N 外键放在主表。
- 完整系统 Manifest 中，`JoinForm` / `TableChild` 字段必须声明 `relation.cardinality`；
  `microi_plan_system` 与 `microi_generate_system` 会在任何写入前执行本节门禁。直接调用
  `microi_add_field` / `microi_update_field` 时，后端仍会校验目标表、主/子外键、隐藏菜单
  和子表索引，不能靠绕过 Manifest 写入未初始化配置。

示例：

- “订单包含多个商品明细” → `order_detail.OrderId` + `TableChild`。
- “访客单包含多件携带物品” → `fk_carry_item.VisitId` + `TableChild`，不能用
  `GuestId + JoinForm`，也不能把 `JoinForm` 指回 `fk_carry_item` 自己。
- “工单关联一个客户，并在工单内展开客户档案” → 主表 `CustomerId` + `JoinForm`。

### MCP 创建 `TableChild` 的两阶段流程

1. 创建主表和独立子表；在子表创建真实外键（如 `VisitId varchar(50)`）。
2. 在子表为回查创建租户组合索引（通常 `(OsClient, VisitId)`），索引写入 Manifest
   `tables[].indexes`，并以 `microi_get_table_indexes` 回读。
3. 为子表创建绑定其 `diyTableId` 的隐藏 CRUD 菜单：`Display=0`、`AppDisplay=0`、
   `HasChild=0`。
4. 在完整系统 Manifest 的主表字段声明：

   ```json
   {
     "name": "Items",
     "label": "明细",
     "component": "TableChild",
     "formWidth": 24,
     "relation": {
       "cardinality": "1:N",
       "targetTable": "Biz_OrderItem",
       "childForeignKey": "OrderId",
       "childModule": "订单明细（隐藏）",
       "primaryTableFieldName": "Id"
     }
   }
   ```

   `microi_generate_system` 会先创建全部表与普通字段，再创建隐藏菜单，最后回读并写入
   当前租户真实的 `diy_table.Id` / `sys_menu.Id`。禁止在 Manifest 中编造这些 Id，禁止
   因依赖尚未创建而退化成 `JoinForm`。
5. `TableChild` 控件字段通常只是表单配置位，关系事实存放在子表外键。至少保存：

```json
{
  "TableChildTableId": "<子表 diy_table.Id>",
  "TableChildSysMenuId": "<子表 sys_menu.Id>",
  "TableChildSysMenuName": "携带物品明细",
  "TableChildFkFieldName": "VisitId",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "Data": [],
    "SearchAppend": {},
    "ImportAutoFillFk": true,
    "FieldRelations": [],
    "LastTableId": "",
    "LastSysMenuId": "",
    "LastSysMenuName": "",
    "DisablePagination": false,
    "NoneDefaultHeight": false
  }
}
```

`FieldRelations` 使用紧凑格式 `[["父表字段","子表字段",true?], ...]`。全部关系用于新增回写和导入回填；第三位 `true` 仅标记参与导入反查父表的关系。后端兼容旧三项配置，新版前端会合并去重并在字段下次保存时清除旧键。

`OpenTable` 用于弹出列表选择数据，固定授权范围用 `V8.OpenTableSetWhere`；`JoinTable`
用于展示关联集合，不能用前端拼接代替数据权限。

### 子表验收与复盘

- 回读主表字段、子表字段、隐藏子菜单和索引，确认配置中的表 Id、菜单 Id、外键名均真实存在。
- 用父记录 A 新增/编辑/删除多条子记录；打开父记录 B，确认 A 的数据不可见且不可越权操作。
- 新增主表尚无真实 Id 时，不得产生孤儿子记录；保存后重新打开仍能正确回显。
- 若曾误选组件，复盘必须记录：触发用语、误判基数、正确关系、应增加的生成前断言；通用结论
  回写本节，不能只修一张业务表。

## 自定义组件边界

优先使用现有 44 类标准控件。只有标准控件无法表达交互、且该交互会长期复用时，
才使用 `DevComponent`：

- 多租户共用且与主框架强耦合的 Vue 组件，路径必须稳定并纳入 `Microi.Client` 源码/构建。
- 支持 Add/Edit/View、只读、必填、清空、校验、移动端和暗色主题。
- 不在组件内绕过 FormEngine 权限直接访问任意表。
- 复杂但租户独有、需要固定嵌入表单的区域，优先使用 `DevComponent` + MicroService 路由；临时打开的复杂页面使用 `V8.OpenAppDialog`，都避免把客户逻辑打进主前端。
- MicroService 表单嵌入使用 `microi.routes.json` 页面级 `LegacyComponentPaths` 作为稳定别名，字段 `Config.DevComponentPath` 与其匹配。主前端存在同路径 Vue 文件时本地优先；不存在时平台自动加载对应 `sys_microiservice_page.RoutePath`。新别名不得与 `/src/views` 真实文件冲突。
- 组件宿主下发 `componentMode=true`、可序列化 `componentData` 与 `permissionContext`；子应用用 `dev-component:resize` 同步高度，用 `dev-component:event` 回传 `update:modelValue`、`CallbackFormValueChange`、`FormSet` 或 `ParentFormSet`。不传 Vue 实例、函数、循环引用或 `ParentV8`，不直接操作父页面 DOM。
- 表单嵌入验收必须覆盖 Add/Edit/View/只读、初始值与回写、自动高度、窄屏、暗色主题，以及当前菜单 `ModuleEngineKey` 下的有权/无权账号。
- `DevComponent` 配置了非空字段标题时必须正常渲染 Label；只有标题本身为空时才允许隐藏，
  不能按组件类型全局吞掉业务标题。`el-form--label-top` 下的字段级 `Button` 仍保留与其它
  控件等高的不可见 Label 占位，使按钮对齐控件区而不是对齐标题行。

## 固定审计字段

- `Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted` 是 DIY 表的正常固定字段。物理列存在时必须有对应 `diy_field` 元数据，不能长期出现在“异常字段修复”列表；`diy_table.DisplayDefaultField` 只控制设计器默认是否显示这些字段，不等于删除元数据。
- 统一通过平台修复接口或 MCP `microi_repair_audit_fields` 补齐/恢复元数据。修复必须按 `OsClient` 使用共享租约锁，可重复执行，只处理已存在的固定物理列，不借机执行 DDL，并在成功后清理字段缓存。
- 表格里的创建人、创建时间、修改时间等审计列应与普通字段共用列头高级搜索、权限和格式化逻辑。

## 验收

- 物理列与 `diy_field` 一致，字段缓存已刷新。
- 新增、编辑、查看、列表、搜索、导入/导出至少覆盖适用场景。
- 选项显示 Label、保存 Key，回显和筛选一致。
- 子表新增/编辑/删除与父表外键正确，不能跨父记录串数据。
- PC 与移动端字段顺序、Tabs、整行控件无截断。
- 前端校验只改善体验；绕过前端直接 HTTP 提交时后端事件仍能阻止非法数据。
