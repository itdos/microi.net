# 模块引擎配置参考

## 核心归属

| 配置 | 归属 |
|---|---|
| 表与字段元数据 | `diy_table`、`diy_field` |
| 菜单、列表列、按钮、打开方式、ViewSchema | `sys_menu` |
| 接口替换业务逻辑 | `sys_apiengine` |
| 左右树配置 | `diy_LeftJoinRightView` |
| MicroService 运行时/页面 | `sys_microiservice`、`sys_microiservice_page` |

## 查询与显示

| 逻辑配置 | sys_menu 侧含义 |
|---|---|
| `TableDiyFieldIds` | 当前模块可用字段全集 |
| `SelectFields` | 列表查询字段 |
| `SearchFieldIds` | 可搜索字段 |
| `SortFieldIds` | 可排序字段 |
| `NotShowFields` | 查询但不直接显示的字段 |
| `StatisticsFields` | 汇总字段 |
| `MobileListFields` | 移动端列表字段 |
| `CardTitleTagFields` | 卡片标题/标签字段 |
| `CardBottomTagFields` | 卡片底部字段 |
| `DefaultOrderBy` | 默认排序 |

默认隐藏 Id、外键、系统字段、布局字段、上传、富文本、地图和子表等重字段。
默认搜索优先名称、标题、编号、状态、类型、分类、负责人和时间；统计优先金额、
数量、价格、积分和余额。用户明确配置优先。

## 打开方式细节

### Diy

默认 `/diy/diy-table-rowlist`，绑定 `DiyTableId` 后自动具备列表、搜索、新增、
编辑、删除、导入和导出。

### Component

用于主前端源码已注册的组件。组件路径必须存在并经过目标前端构建验证。

### Iframe

仅允许受控 URL。地址接口引擎可返回动态 URL，但：

- 密钥只在后端使用；
- 外部 Token 短时缓存并按 `OsClient + 用户 + 目标系统` 隔离；
- URL 参数使用一次性交换码，不使用当前后台 JWT；
- 限制跳转域名并防 SSRF/开放重定向。

### SecondMenu

只承载子菜单，不绑定业务表；`HasChild` 与真实子菜单一致。

### Report

使用报表引擎虚拟表。读取 `report-engine/SKILL.md`。

### MicroService

必须同时绑定：

- `MicroServiceId`
- `MicroServicePageId`
- `MicroServiceRoutePath`
- `MicroServiceKey`
- `ComponentPath=/micro-app/host`

路由优先 `/micro-app/{MsKey}/{RoutePath}`，并兼容历史 Id 路由。

## 跨端 ViewSchema

专用物理字段：

| 字段 | 说明 |
|---|---|
| `EnableViewSchema` | 1 启用 |
| `ViewSchemaVersion` | 协议语义版本 |
| `ViewConfigVersion` | 每次发布递增，驱动缓存失效 |
| `ViewSchema` | Detail/Edit/List/Card JSON |

视图项常用字段：`Key`、`Scene`、`Device`、`RoleIds`、`Priority`、`Layout`。
标准区块包括 `EntityHero`、`MetricStrip`、`ActionGrid`、
`ResponsiveSection`。声明式动作包括：

`ApiEngine`、`OpenDetail`、`OpenList`、`OpenForm`、`Navigate`、
`Dial`、`Scan`、`Map`、`Refresh`、`Back`、`Copy`。

`ParamMap` 可使用经过白名单处理的 `$form.Field`、`$user.Field`、
`$menu.Field`。小程序端不下载/执行任意 V8Code。

## 动态按钮位置

| 字段 | 位置 |
|---|---|
| `MoreBtns` | 行操作 |
| `FormBtns` | 表单底部 |
| `BatchSelectMoreBtns` | 批量勾选后 |
| `PageTabs` | 页面顶部 Tab |
| `PageBtns` | 页面级 |
| `ExportMoreBtns` | 导出扩展 |

按钮对象必须有稳定唯一 Id、Sort、Name、显隐逻辑和动作。后台任务按钮还要配置
ApiEngineKey、Workload、幂等字段、并发 Key、业务状态/任务 Id/进度/ETA 字段。

## 接口替换

可替换查询、新增、更新、删除、导入、导入进度和导出接口。替换后仍要保持平台
返回契约、权限、分页、统计、错误码和租户隔离。

- 查询：返回 `Code/Data/DataCount`，不可丢失菜单权限。
- 导入：读取文件、校验、分片写入、真实进度、幂等恢复。
- 导出：大数据使用后台任务/流式文件，不在请求内无界物化。
- 所有路径变量只能使用平台明确支持的占位符，不拼接 Token。

## PageTabs 两种模式

- 无目标菜单：在当前模块执行 V8，通常 `V8.SearchSet(...)`。
- 有 `TargetSysMenuId`：加载目标模块。目标菜单即使隐藏导航，也必须给角色权限。

跨表 Tab 应让每个目标菜单配置同一组 PageTabs，不在前端按菜单名写死。

## URL 参数

兼容参数包括 `ShowClassicTop`、`ShowClassicLeft`、`FormDataId`。它们只控制
界面/默认打开记录，不建立授权；记录仍须通过当前菜单和数据权限校验。
