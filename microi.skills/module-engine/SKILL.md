---
name: module-engine
description: Microi 模块引擎与 sys_menu 配置指南。用于创建或修改后台菜单、模块打开方式、列表查询列、搜索/排序/统计列、接口替换、跨端 ViewSchema、动态按钮、PageTabs、树形加表格布局和 MicroService 菜单。
---

# Microi 模块引擎

模块引擎决定同一张表在某个菜单、角色和终端中“如何查询、展示和操作”。
配置实体是 `sys_menu`，不是 `sys_module`；表结构与字段仍属于
`diy_table/diy_field`。

## 必读参考

- 字段、打开方式、查询配置、ViewSchema 和接口替换：
  `references/module-config.md`
- 动态按钮 JSON 与后台任务：`../v8-menu-buttons/SKILL.md`
- 树形+表格：`../microi-left-right-layout/SKILL.md`
- 表单控件：`../microi-form-engine/SKILL.md`
- MicroService 菜单：`../microi-microservice/SKILL.md`

## 创建/修改标准流程

1. `microi_get_db_schema` 读取真实 `diy_table`、字段、已有菜单和父菜单。
2. 绑定表的菜单使用 `microi_create_module`/Manifest，不直接写 `sys_menu`。
3. 明确 `openType`、父菜单、路由、PC/移动端显隐和角色范围。
4. 用字段名配置 `listFields/searchFields/sortFields/hiddenFields/mobileFields`；
   MCP 解析为字段 Id 和 `SelectFields/SearchFieldIds/...`。
5. 同一次创建配齐业务按钮、FormBtns、PageTabs 和批量按钮。
6. 写后回读模块，检查字段映射、按钮 JSON、路由和目标页面。
7. 为管理员/目标角色分配菜单权限，并以真实登录用户验收。

## 绑定表菜单不能只写两个字段

除 `Name` 和 `DiyTableId` 外，至少配置或允许平台推断：

- `TableDiyFieldIds`
- `SelectFields`
- `SearchFieldIds`
- `SortFieldIds`
- `NotShowFields`
- `StatisticsFields`
- `MobileListFields`
- `CardTitleTagFields`
- `CardBottomTagFields`
- `DefaultOrderBy`

普通状态、开关等低基数字段不能机械创建单列索引。只有真实查询、关联、唯一约束
或扫描需要的索引才进入 Manifest 并通过 MCP 创建、回读。

## 打开方式

| OpenType | 用途 |
|---|---|
| `Diy` | 标准表单引擎列表/表单 |
| `Component` | 主前端已注册 Vue 组件 |
| `Iframe` | 受控外部页面 |
| `SecondMenu` | 仅作为父菜单 |
| `Report` | 虚拟报表 |
| `MicroService` | 已发布前端微服务页面 |

Iframe 不把长期 Token、密码或连接串放 URL。第三方单点登录使用短期、一次性、
可撤销的服务端交换票据，限制 redirect/scope，并在落地后清理地址栏。

## 数据与业务逻辑

- 单表 CRUD 已由绑定表菜单提供，不额外创建重复接口引擎。
- 后端 V8 可用 `V8.ModuleEngine.GetTableData({...})`，通过
  `ModuleEngineKey` 应用模块的关联表查询配置；标准前端 V8 不挂载
  `V8.ModuleEngine`。
- 查询接口替换、导入/导出替换和跨表动作属于复杂逻辑时，使用接口引擎。
- 前端按钮只做确认、收集少量参数、调用接口和刷新；事务与最终校验在后端。
- 预计超过 2 分钟、500 条、1000 个扇出或 100 次外部调用时使用真实后台任务。
- 不复制官网旧“Redis 文本进度 + 长事务循环”导入示例作为新实现；必须有稳定
  幂等键、业务任务状态、真实 Current/Total、失败恢复和必要的 checkpoint 分片。

## 跨端 ViewSchema

`ViewSchema` 是模块级视图，不写入已废弃的通用 `DiyConfig`。启用后仍须：

- 配置 `EnableViewSchema`、语义版本和递增配置版本。
- 按 Scene、Device、RoleIds、Priority 选择视图。
- 配置损坏或客户端不支持时回退标准 `sys_menu + diy_table + diy_field`，不能白屏。
- 小程序只消费声明式动作，不执行 PC 的任意 `V8Code`。
- 声明式动作中的 ParamMap/VisibleWhen 只允许白名单字段，不使用 `eval`。

## 验收

- `Display/AppDisplay` 除明确隐藏外为 1，父子菜单层级正确。
- 路由刷新、直接访问、切换菜单均不 404/白屏。
- 列表字段、筛选、排序、统计、移动端卡片与预期一致。
- 权限用户可访问，未授权用户不能靠 URL、`_SysMenuId` 或前端字段绕过。
- MoreBtns/FormBtns/PageTabs/BatchSelectMoreBtns 显隐、调用和刷新正确。
- PC 和移动端分别验证；MicroService 还要验证运行时、页面路由和宿主上下文。
