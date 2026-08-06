---
name: module-engine
description: Microi 模块引擎与 sys_menu 配置指南。用于创建或修改后台菜单、菜单统计角标、模块标题指标、复合列表列、移动端业务卡片、查询列、接口替换、跨端 ViewSchema、动态按钮、PageTabs、树形加表格布局和 MicroService 菜单。
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
- 表单平铺、CollapseGroup 与 Tabs 决策：`../microi-form-layout/SKILL.md`
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

顶层 PC 数据列表默认使用紧凑的新模块标题样式；即使未启用 ViewSchema，也不能退回无标题的旧外观。无指标头部固定 `44px`、含指标头部固定 `62px`，连同间距总纵向占用约 `50px / 68px`。子表、关联表、嵌入表不重复显示，移动端由固定导航栏承载标题。`ViewSchema` 只负责个性化标题、指标、复合列和卡片，不改变 Detail/Edit 的显式启用语义。

PC 列表的固定结构顺序是“模块 Hero（标题/副标题/动态指标）→ PageTabs → 查询与表格”，Hero 必须渲染在页面多 Tab 上方。头部只使用一次性入场和一次性轻量光效，禁止持续循环动画；`prefers-reduced-motion: reduce` 必须关闭动画和过渡。

`ViewSchema` 是模块级视图，不写入已废弃的通用 `DiyConfig`。优先通过 sys_menu“跨端视图”的 `DiyModulePresentationDesigner` 配置；需要角色视图或 Detail/Edit 高级布局时再使用设计器的高级 JSON。启用后仍须：

- 配置 `EnableViewSchema`、语义版本和递增配置版本。
- 按 Scene、Device、RoleIds、Priority 选择视图。
- 配置损坏或客户端不支持时回退标准 `sys_menu + diy_table + diy_field`，不能白屏。
- 小程序只消费声明式动作，不执行 PC 的任意 `V8Code`。
- 声明式动作中的 ParamMap/VisibleWhen 只允许白名单字段，不使用 `eval`。

### 重要模块的统计与信息层级

- 待办、库存预警、未读、逾期、待收/待付等有行动含义的菜单，主动询问并配置
  `MenuBadgeEnabled=1` 与 `MenuBadgeApiEngineKey`。接口统一返回
  `{ Code:1, Data:{ Value: number } }`，并按当前用户权限统计。
- `Scene=List` 的 `Layout.Hero` 用 `Eyebrow/Title/Description/Metrics` 建立模块标题与
  指标条。相同 `ApiEngineKey` 的指标必须由一个聚合接口批量返回，使用 `ValuePath`
  取值；禁止一个指标一次请求。
- PC Hero 有指标时采用“左侧标题说明约 25%~30% + 右侧指标区弹性占满”的信息层级，
  中间只允许一条弱化渐变分隔；指标条容器和单个指标不得叠加多层描边。无指标时标题说明
  自动占满整行，不保留空指标区。每个指标必须显式配置 `Icon`，并通过不同的 `Tone` 或
  `Color` 形成可辨识的图标色块与轻背景；同一 Hero 内不得让全部指标使用相同图标和颜色。
- Hero 指标可用 `Source=DataCount` 读取当前筛选总记录数、用 `Source=PageCount` 读取本页
  已加载记录数；两者复用列表结果，不调用额外接口。字段汇总继续用 `Field`，跨表或复合
  统计才用 `ApiEngineKey + ValuePath`。
- `Layout.List.Columns[]` 用 `Field + Lines + TrailingFields` 配置双行/多行列和右侧
  图标状态；声明支持 `Tone/Color/Icon/ShowLabel/Prefix/Suffix`，引用字段必须进入查询列。
- `Scene=Card, Device=Mobile` 用 `Layout.Card` 配置 `AvatarTextField/TitleField/TopFields/
  SubtitleFields/RightFields/Fields/MetaFields/BottomFields`。未配置时继续兼容
  `MobileListFields/CardTitleTagFields/CardBottomTagFields`。
- `PageTabs/MoreBtns/PageBtns/BatchSelectMoreBtns/ExportMoreBtns/FormBtns` 需要数量时配置
  `BadgeEnabled/BadgeApiEngineKey`；一个接口接收当前页 `Ids + ButtonKeys` 并一次返回
  `Data.Buttons` 与 `Data.Rows`，禁止逐行调用。
- 能直接用字段表达的信息优先配置复合列/卡片字段；只有确需 HTML 样式或组合逻辑时
  才使用字段的 `V8TmpEngineTable`，且仍需遵守 DOMPurify 和查询字段范围。

### 表单布局协同

- `<=6` 个核心可见字段优先平铺；`7~29` 个字段按基础、业务、状态、附件等信息域使用
  `CollapseGroup`；`30+` 个字段，或存在多个大型子表、扫码/代码编辑等强任务域时使用
  表级 `diy_table.Tabs`。最终还要按有效表单行校正，避免产生只有少量字段的空洞 Tab。
- 新增 `Tabs/CollapseGroup/Divider/Alert` 等布局节点必须走明确的“仅元数据”专用路径。
  普通新增字段接口可能同步对业务表执行物理 DDL，不能把向 `diy_field` 新增一行误认为
  仅保存布局配置；写入后要同时回读元数据并核对业务表结构未新增实体列。

## 验收

- `Display/AppDisplay` 除明确隐藏外为 1，父子菜单层级正确。
- 路由刷新、直接访问、切换菜单均不 404/白屏。
- 列表字段、筛选、排序、统计、移动端卡片与预期一致。
- 权限用户可访问，未授权用户不能靠 URL、`_SysMenuId` 或前端字段绕过。
- MoreBtns/FormBtns/PageTabs/BatchSelectMoreBtns 显隐、调用和刷新正确；PageTabs 数字角标使用稳定 Tab Id 取 `Data.Buttons`。
- 菜单角标、模块指标和按钮角标按真实权限返回，零值/超限/接口失败降级正确且无 N+1。
- Hero 在有指标、无指标、长标题和 3~5 个指标时均层级清晰；指标无多层线框，同一组图标与
  语义色可区分，并在浅色/深色主题下保持可读。
- PC 复合列和 Mobile Card 引用的附加字段均在查询结果中；长文本、空值、模板值不破版。
- PC 和移动端分别验证；MicroService 还要验证运行时、页面路由和宿主上下文。
