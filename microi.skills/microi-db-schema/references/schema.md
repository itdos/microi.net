# Microi 平台标准数据库结构

> 来源：`AI-Project/microi/db.json`（共 75 张表，975 个可配置字段）

---

## 固定字段

所有由平台创建的 DIY 表，均自动包含以下固定字段（不在 `_Fields` 导出列表中，但物理列存在）：

| 字段 | 说明 |
|---|---|
| `Id` | 主键 |
| `CreateTime` | 创建时间 |
| `UpdateTime` | 更新时间 |
| `UserId` | 创建人 Id |
| `UserName` | 创建人姓名 |
| `IsDeleted` | 软删除标记，原始 SQL 查询时需加 `IsDeleted != 1` |

---

## 核心关系

| 关联 | 含义 |
|---|---|
| `diy_table.Id` → `diy_field.TableId` | 一张表有多个字段定义 |
| `diy_table.Name` | V8.FormEngine 使用的表名 Key |
| `sys_menu.DiyTableId` → `diy_table.Id` | 模块绑定表单 |
| `sys_menu.DiyTableName` → `diy_table.Name` | 运行时模块表名 |
| `diy_field.TableChildTableId` → `diy_table.Id` | 子表组件目标表 |
| `diy_field.TableChildSysMenuId` → `sys_menu.Id` | 子表组件目标菜单 |
| `wf_flowdesign.TableId` → `diy_table.Id` | 工作流设计绑定表单 |
| `wf_flow.TableRowId` → 业务表 `Id` | 工作流实例指向业务记录 |
| `sys_apiengine.ApiEngineKey` | `V8.ApiEngine.Run` 的调用 Key |
| `microi_database.DbKey` | `V8.Dbs.<DbKey>` 的扩展库 Key |

---

## V8 事件字段

| 表 | 字段 | 运行端 | 用途 |
|---|---|---|---|
| `diy_table` | `InFormV8` | 前端 | 表单打开时初始化字段显隐/默认值/联动 |
| `diy_table` | `SubmitFormV8` | 前端 | 表单提交前校验 |
| `diy_table` | `OutFormV8` | 前端 | 表单提交后/关闭后，刷新、跳转 |
| `diy_table` | `SubmitBeforeServerV8` | 后端 | 写入 DB 前（事务中），Code=0 可阻止提交 |
| `diy_table` | `SubmitAfterServerV8` | 后端 | 写入 DB 后（事务中），同步其他表/通知 |
| `diy_table` | `ServerDataV8` | 后端 | 行数据加工/处理 |
| `diy_table` | `ApiReplace` | 后端 | 表单接口替换/增强入口 |
| `diy_field` | `V8Code` | 前端 | 字段值变更事件 |
| `diy_field` | `KeyupV8Code` | 前端 | 键盘事件 |
| `diy_field` | `V8TmpEngineTable` | 前端/渲染 | 列表单元格渲染模板 V8 |
| `diy_field` | `V8TmpEngineForm` | 前端/渲染 | 表单展示模板 V8 |
| `sys_menu` | `AddCodeShowV8` | 前端 | [新增]按钮显示条件 |
| `sys_menu` | `EditCodeShowV8` | 前端 | [编辑]按钮显示条件 |
| `sys_menu` | `DelCodeShowV8` | 前端 | [删除]按钮显示条件 |
| `sys_menu` | `DetailPageV8` | 前端 | 详情按钮行为 |
| `sys_menu` | `DiyConfig` | 前端/模块 | 模块级自定义配置 |
| `sys_menu` | `SqlJoin` | 后端查询 | 列表查询 JOIN 片段（主表别名 A） |
| `sys_menu` | `SqlWhere` | 后端查询 | 模块级 Where 片段，可用 CurrentUser 变量 |
| `sys_menu` | `ImportV8` | 导入 | 导入处理扩展 |
| `sys_menu` | `ExportV8` | 导出 | 导出处理扩展 |
| `sys_apiengine` | `ApiV8Code` | 后端 | 接口引擎服务器端 JavaScript |
| `sys_datasource` | `V8DataSource` | 后端 | V8 数据源 |
| `sys_datasource` | `SqlDataSource` | 后端 | SQL 数据源 |
| `sys_datasource` | `JsonDataSource` | 配置 | 静态 JSON 数据源 |
| `Sys_Config` | `GlobalV8Code` | 前端全局 | 前端全局 V8 初始化（系统启动执行一次） |
| `Sys_Config` | `GlobalServerV8Code` | 后端全局 | 每次后端 V8 执行时加载的全局函数 |
| `wf_flowdesign` | `StartV8 / EndV8` | 工作流 | 流程开始/结束事件 |
| `wf_node` | `StartV8 / EndV8 / StartV8Server / EndV8Server / LineValueV8` | 工作流节点 | 节点进入、结束、条件判断、服务端扩展 |
| `wf_line` | `V8Code` | 工作流线 | 连线条件代码 |

---

## 所有表一览（按分类）

### 低代码元数据与引擎配置

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_table` | 43 | 表单/表元数据，含表级 V8 事件 |
| `diy_field` | 36 | 字段定义，含字段 V8 事件和模板 |
| `diy_component` | 11 | 表单引擎组件 |
| `sys_menu` | 91 | 模块引擎（列表、搜索、按钮、导入导出等配置） |
| `sys_apiengine` | 26 | 接口引擎 |
| `sys_datasource` | 12 | 数据源引擎 |
| `microi_database` | 10 | 扩展数据库管理 |
| `mic_page` | 6 | 界面引擎（自定义页面） |
| `mic_print` | 6 | 打印引擎 |
| `microi_print_template` | 3 | 导出模板 |
| `Rpt_Report` | 15 | 报表引擎 |
| `rpt_user_setting` | 6 | 个人设置 |
| `diy_LeftJoinRightView` | 31 | 左右结构配置表 |

### 系统、租户、权限与审计

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `Sys_Config` | 70 | 系统设置（全局 V8、主题、密码策略等） |
| `sys_osclients` | 92 | SaaS 租户配置（DB、Redis、MQ、MQTT、存储、域名等） |
| `sys_user` | 37 | 员工信息 |
| `sys_role` | 9 | 角色（Level=999 为超级管理员） |
| `sys_rolelimit` | 5 | 角色-菜单权限关联 |
| `sys_dept` | 9 | 组织机构 |
| `diy_tenant` | 1 | 租户管理 |
| `sys_basedata` | 9 | 基础数据 |
| `sys_log` | 11 | 系统日志 |
| `microi_datalog` | 9 | 数据修改日志 |
| `diy_lang` | 12 | 多语言 |
| `sys_servernode` | 6 | 服务器节点管理 |
| `sys_microiservice` | 6 | 微服务 |

### 工作流引擎

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `wf_flowdesign` | 12 | 工作流设计（流程图、节点集合） |
| `wf_node` | 28 | 流程节点属性（角色、V8、字段配置等） |
| `wf_line` | 6 | 流程条件连线 |
| `wf_flow` | 15 | 流程实例 |
| `wf_work` | 21 | 工作流工作（待办/已办） |
| `wf_history` | 23 | 流程轨迹/历史记录 |
| `wf_nodelist` | 5 | 节点列表 |

### 消息、集成与自动化

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_queue_receive` | 11 | 消息队列管理 |
| `diy_queue_receive_log` | 9 | 消息队列日志 |
| `mci_mqtt_client` | 5 | MQTT 客户端 |
| `mci_mqtt_log` | 4 | MQTT 记录 |
| `diy_schedule_job` | 22 | 定时任务 |
| `diy_schedule_job_log` | 2 | 定时任务日志 |
| `diy_feishu_app` | 4 | 飞书应用 |
| `diy_qiwei_app` | 5 | 企业微信应用 |
| `wx_mp` | 7 | 微信公众号配置 |
| `wx_menu` | 3 | 微信公众号自定义菜单 |
| `wx_mini_program` | 3 | 微信小程序 |
| `wx_tpl_msg` | 10 | 公众号模板消息 |
| `mic_email_server` | 7 | 邮件配置 |
| `mic_msgset` | 10 | 消息通知设置 |
| `mic_msg_event_log` | 5 | 消息通知事件日志 |

### 内容、运营与平台功能

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_document` | 7 | 低代码平台文档 |
| `diy_news` | 2 | 网站文章 |
| `diy_notice` | 4 | 公告 |
| `diy_tips` | 5 | 提醒 |
| `diy_wallpaper` | 4 | 壁纸管理 |
| `diy_modulehits` | 9 | 模块访问统计 |
| `diy_menufavorite` | 4 | 菜单收藏夹 |
| `mic_ai` | 19 | AI 模型管理 |
| `mic_ai_record` | 5 | AI 对话记录 |
| `mic_data_dashboard` | 5 | 数据大屏 |
| `mic_data_version` | 10 | 数据版本 |
| `mic_day_word` | 2 | 每日一言 |
| `microi_calendar` | 6 | 日历 |
| `microi_icon` | 3 | 图标管理 |
| `diy_searchengine_name_alias` | 2 | 搜索引擎 index 名称别名 |
| `diy_sso` | 6 | 单点登录 |

### 授权、商城与示例业务

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_license` | 19 | 授权管理 |
| `diy_license_log` | 9 | 授权日志 |
| `sys_microistore` | 21 | 应用商城 |
| `sys_microistoreversion` | 1 | 应用商城版本 |
| `sys_appinstalled` | 6 | 已安装应用 |
| `sys_microiuptlog` | 7 | 框架更新日志 |
| `b2c_product` | 19 | b2c_product（示例业务表） |
| `diy_course` | 3 | 课程表（示例） |
| `eban` | 5 | EBAN（示例） |
| `mic_memo` | 3 | 备忘录 |
| `mic_3d_engine` | 0 | 3D 引擎 |

---

## 核心表字段详细定义

以下为最常用表的完整字段列表，足以支持 V8 编码和低代码建模。

### `diy_table` — 表单/表元数据（43 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `Name` | `varchar(255)` | `Text` | 表名 Key，建议 `diy_` 前缀全小写 |
| `Description` | `mediumtext` | `Text` | 中文名称描述 |
| `Column` | `int(11)` | `Radio` | 电脑端表单布局列数 |
| `IsTree` | `int` | `Switch` | 是否树形结构 |
| `TreeParentField` | `varchar(50)` | `Text` | 树形父级字段（如 ParentId） |
| `TreeParentFields` | `mediumtext` | `Text` | 完整父级字段（如 FullPath，逗号结尾） |
| `TreeHasChildren` | `varchar(50)` | `Text` | 是否有子级列（懒加载用） |
| `TreeLazy` | `int` | `Switch` | 树形懒加载 |
| `Tabs` | `mediumtext` | `JsonTable` | 表单分组 Tabs |
| `TableTabs` | `mediumtext` | `JsonTable` | 表格 Tabs |
| `TabsPosition` | `varchar(255)` | `Radio` | 分组标签位置 |
| `FormLabelPosition` | `varchar(255)` | `Radio` | 标签对齐方式 |
| `FormOpenType` | `varchar(255)` | `Radio` | 表单打开方式（弹窗/抽屉/页面） |
| `FormOpenWidth` | `varchar(255)` | `Text` | 弹窗/抽屉宽度 |
| `FieldBorder` | `varchar(255)` | `Text` | 字段边框样式 |
| `InputBorderStyle` | `varchar(255)` | `Radio` | 输入框样式 |
| `DisplayDefaultField` | `int` | `Switch` | 显示默认字段 |
| `EnableCache` | `int` | `Switch` | 启用缓存 |
| `CacheParentKey` | `varchar(255)` | `Text` | 缓存 Key |
| `DataBaseId` | `varchar(36)` | `Guid` | 所属扩展数据库 Id |
| `DataBaseName` | `varchar(100)` | `Select` | 所属数据库名（空=主库） |
| `EnableDataLog` | `int` | `Switch` | 启用数据修改日志 |
| `DataLogRole` | `mediumtext` | `MultipleSelect` | 数据日志可见角色 |
| `EnableDataComment` | `int` | `Switch` | 启用数据评论 |
| `DataEncryptSave` | `int` | `Switch` | 数据加密存储 |
| `DataEncryptTransfer` | `int` | `Switch` | 数据加密传输 |
| `IsAnonymousAdd` | `int` | `Switch` | 允许匿名新增 |
| `IsAnonymousRead` | `int` | `Switch` | 允许匿名读取 |
| `BindRole` | `mediumtext` | `MultipleSelect` | 访问权限角色 |
| `ReportId` | `varchar(36)` | `Guid` | 报表引擎 Id |
| `ReportName` | `varchar(100)` | `Select` | 报表引擎 |
| `DataSourceId` | `varchar(36)` | `Guid` | 数据源 Id |
| `FormArticle` | `mediumtext` | `Textarea` | 表单说明文章 |
| `TableArticle` | `mediumtext` | `Textarea` | 表格说明文章 |
| `RowAction` | `mediumtext` | `Textarea` | 行操作配置 |
| `InFormV8` | `mediumtext` | `CodeEditor` | 前端表单进入 V8 事件 |
| `SubmitFormV8` | `mediumtext` | `CodeEditor` | 前端表单提交前 V8 事件 |
| `OutFormV8` | `mediumtext` | `CodeEditor` | 前端表单提交后 V8 事件 |
| `SubmitBeforeServerV8` | `mediumtext` | `CodeEditor` | 后端表单提交前 V8 事件 |
| `SubmitAfterServerV8` | `mediumtext` | `CodeEditor` | 后端表单提交后 V8 事件 |
| `ServerDataV8` | `mediumtext` | `CodeEditor` | 后端数据处理 V8 事件 |
| `ApiReplace` | `mediumtext` | `CodeEditor` | 接口替换 |
| `TableTabsPosition` | `varchar(255)` | `Text` | 表格 Tabs 位置 |

### `diy_field` — 字段定义（36 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `TableId` | `varchar(36)` | `Text` | 所属表 Id（关联 diy_table.Id） |
| `TableName` | `varchar(50)` | `Text` | 所属表名（冗余） |
| `Name` | `varchar(255)` | `Text` | 字段名（PascalCase） |
| `Label` | `varchar(255)` | `Text` | 显示名称 |
| `Type` | `varchar(255)` | `Autocomplete` | 物理列类型（varchar/int/decimal/mediumtext 等） |
| `Component` | `varchar(255)` | `Select` | 控件类型 |
| `Sort` | `int(11)` | `NumberText` | 排序 |
| `Visible` | `int` | `Switch` | 是否可见 |
| `NotEmpty` | `int` | `Switch` | 是否必填 |
| `Unique` | `int` | `Switch` | 是否唯一 |
| `Readonly` | `int` | `Switch` | 是否只读 |
| `IsVirtual` | `int` | `Switch` | 虚拟字段（不创建物理列） |
| `IsLockField` | `int` | `Switch` | 锁定字段名称和类型 |
| `NameConfirm` | `int` | `Switch` | 已确认字段名 |
| `DefaultValue` | `varchar(255)` | `Text` | 默认值 |
| `Placeholder` | `varchar(255)` | `Text` | 占位文字 |
| `Description` | `mediumtext` | `Textarea` | 字段说明 |
| `Remark` | `mediumtext` | `Textarea` | 备注 |
| `Tab` | `varchar(255)` | `Select` | 所属表单分组 |
| `FormWidth` | `int(11)` | `Radio` | 表单占宽（null=自动，24=整行） |
| `TableWidth` | `int(11)` | `Text` | 列表列宽 |
| `ComponentWidth` | `varchar(50)` | `Text` | 控件宽度 |
| `FormLabelPosition` | `varchar(50)` | `Radio` | 标签对齐方式 |
| `AppVisible` | `int` | `Switch` | 移动端是否可见 |
| `InTableEdit` | `int` | `Switch` | 开启表内编辑 |
| `Encrypt` | `int` | `Switch` | 加密存储 |
| `BindRole` | `mediumtext` | `MultipleSelect` | 前端可见角色 |
| `OsClient` | `varchar(255)` | `Text` | OsClient |
| `Code` | `varchar(255)` | `Text` | Code |
| `Data` | `mediumtext` | `Textarea` | 普通数据源（KeyValue 或逗号分隔） |
| `DataAppend` | `mediumtext` | `Textarea` | 附加数据 |
| `Config` | `mediumtext` | `Textarea` | 控件配置 JSON（DataSource、SelectLabel 等） |
| `V8Code` | `mediumtext` | `CodeEditor` | 值变更 V8 事件 |
| `KeyupV8Code` | `mediumtext` | `CodeEditor` | 键盘 V8 事件 |
| `V8TmpEngineTable` | `mediumtext` | `CodeEditor` | 列表单元格渲染模板 V8 |
| `V8TmpEngineForm` | `mediumtext` | `CodeEditor` | 表单展示模板 V8 |

### `sys_menu` — 模块引擎（91 字段，核心字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `Name` | `varchar(500)` | `Text` | 菜单名称 |
| `ParentId` | `varchar(50)` | `SelectTree` | 上级菜单 Id |
| `Sort` | `int(11)` | `NumberText` | 排序 |
| `Display` | `int` | `Switch` | 是否显示 |
| `AppDisplay` | `int` | `Switch` | 移动端是否显示 |
| `OpenType` | `varchar(500)` | `Select` | 打开方式（Diy/Url/Page） |
| `ComponentName` | `varchar(500)` | `Select` | 界面模板 |
| `ComponentPath` | `varchar(500)` | `Text` | 组件路径（无需 `/views` 前缀） |
| `Url` | `varchar(500)` | `Text` | 外链地址 |
| `IconClass` | `varchar(500)` | `FontAwesome` | FontAwesome 图标类名 |
| `Icon` | `varchar(500)` | `ImgUpload` | 菜单图片 |
| `Description` | `varchar(500)` | `Text` | 菜单描述 |
| `Code` | `varchar(500)` | `Text` | Code |
| `ModuleEngineKey` | `varchar(50)` | `Text` | 模块引擎 Key |
| `DiyTableId` | `varchar(36)` | `Select` | 绑定表单 Id |
| `DiyTableName` | `varchar(50)` | `Text` | 绑定表名（运行时） |
| `FlowDesignId` | `varchar(100)` | `Select` | 关联工作流 Id |
| `SelectFields` | `mediumtext` | `JsonTable` | 指定查询列（空=SELECT *） |
| `SearchFieldIds` | `mediumtext` | `JsonTable` | 可搜索字段 |
| `SortFieldIds` | `mediumtext` | `MultipleSelect` | 可排序字段 |
| `NotShowFields` | `mediumtext` | `MultipleSelect` | 不显示列 |
| `FixedFields` | `mediumtext` | `MultipleSelect` | 固定列 |
| `InTableEditFields` | `mediumtext` | `MultipleSelect` | 表内可编辑字段 |
| `InTableEdit` | `int` | `Switch` | 开启表内编辑 |
| `SaveType` | `varchar(50)` | `Radio` | 表内编辑保存方式 |
| `DefaultOrderBy` | `varchar(255)` | `JsonTable` | 默认排序字段 |
| `DefaultPageSize` | `int` | `NumberText` | 默认每页数量 |
| `StatisticsFields` | `mediumtext` | `JsonTable` | 统计列 |
| `MobileListFields` | `mediumtext` | `JsonTable` | 移动端/卡片显示列 |
| `TableCardImgField` | `varchar(50)` | `Text` | 卡片图片字段 |
| `TableCardImgPosition` | `varchar(50)` | `Radio` | 卡片预览图位置 |
| `TableCardImgStyle` | `varchar(500)` | `Text` | 卡片图片样式 |
| `TableCardCol` | `int` | `NumberText` | 卡片每行几列 |
| `CardTitleTagFields` | `mediumtext` | `JsonTable` | 卡片标题标签字段 |
| `CardBottomTagFields` | `mediumtext` | `JsonTable` | 卡片底部标签字段 |
| `JoinTables` | `mediumtext` | `JsonTable` | 关联表 |
| `TableHeaders` | `mediumtext` | `Textarea` | 多级表头数据 |
| `SqlJoin` | `mediumtext` | `CodeEditor` | JOIN 片段（主表别名 A） |
| `SqlWhere` | `mediumtext` | `CodeEditor` | Where 条件（可用 `$CurrentUser.Id$` 等变量） |
| `SelectApi` | `varchar(255)` | `Text` | 查询接口替换 |
| `ImportApi` | `varchar(255)` | `Text` | 导入接口替换 |
| `ImportProgressApi` | `varchar(255)` | `Text` | 导入进度接口替换 |
| `ImportTemplate` | `varchar(255)` | `FileUpload` | 导入模板文件 |
| `ImportTemplateName` | `varchar(255)` | `Text` | 导入模板名称 |
| `ImportV8` | `mediumtext` | `Textarea` | 导入处理 V8 |
| `ExportApi` | `varchar(255)` | `Text` | 导出接口替换 |
| `ExportV8` | `mediumtext` | `Textarea` | 导出处理 V8 |
| `AddBtnText` | `varchar(25)` | `Text` | [新增]文字替换 |
| `SaveBtnText` | `varchar(25)` | `Text` | [保存]文字替换 |
| `AddBtnType` | `varchar(50)` | `Radio` | [新增]模式 |
| `MoreBtns` | `mediumtext` | `JsonTable` | 行操作按钮 |
| `FormBtns` | `mediumtext` | `JsonTable` | 表单底部按钮 |
| `BatchSelectMoreBtns` | `mediumtext` | `JsonTable` | 批量选择操作按钮 |
| `PageTabs` | `mediumtext` | `JsonTable` | 页面多 Tab |
| `PageBtns` | `mediumtext` | `JsonTable` | 页面级按钮 |
| `ExportMoreBtns` | `mediumtext` | `JsonTable` | 导出扩展按钮 |
| `AddCodeShowV8` | `mediumtext` | `CodeEditor` | [新增]按钮显示条件 |
| `EditCodeShowV8` | `mediumtext` | `CodeEditor` | [编辑]按钮显示条件 |
| `DelCodeShowV8` | `mediumtext` | `CodeEditor` | [删除]按钮显示条件 |
| `DetailPageV8` | `mediumtext` | `CodeEditor` | 详情按钮 V8 |
| `DiyConfig` | `mediumtext` | `CodeEditor` | 模块配置 JSON |
| `PageTemplate` | `varchar(255)` | `Text` | 界面模板 |
| `ReportId` | `varchar(36)` | `Guid` | 报表 Id |
| `ReportName` | `varchar(100)` | `Select` | 报表 |
| `HasChild` | `int` | `Switch` | 是否有子菜单 |
| `ParentIds` | `mediumtext` | `Text` | 完整父级 Ids |
| `StoreId` | `varchar(36)` | `Text` | 应用商城 Id |
| `IsMicroiService` | `int` | `Switch` | 是否微服务 |
| `IsChildSystem` | `int` | `Switch` | 是否子系统 |
| `UrlApiEngineId` | `varchar(50)` | `Text` | SSO 单点登录接口引擎 Id |

### `sys_apiengine` — 接口引擎（26 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `ApiEngineKey` | `varchar(50)` | `Text` | 唯一 Key，用于 `V8.ApiEngine.Run` |
| `ApiName` | `varchar(50)` | `Text` | 接口名称 |
| `Category` | `varchar(50)` | `Radio` | 接口分类 |
| `ApiAddress` | `varchar(255)` | `Text` | 自定义接口地址（建议 `/apiengine/` 前缀） |
| `ApiV8Code` | `mediumtext` | `CodeEditor` | 服务器端 JavaScript 代码 |
| `IsEnable` | `bit` | `Switch` | 是否启用 |
| `StopHttp` | `int` | `Switch` | 禁止外部 HTTP 调用（仅内部 V8 可调） |
| `AllowAnonymous` | `bit` | `Switch` | 允许匿名调用 |
| `ResponseType` | `varchar(50)` | `Radio` | 响应类型（自动/JSON/String） |
| `ResponseFile` | `int` | `Switch` | 响应文件 |
| `Lock` | `bit` | `Switch` | 开启分布式锁 |
| `LockKey` | `varchar(50)` | `Text` | 分布式锁 Key（传入参数名） |
| `ApiRole` | `mediumtext` | `MultipleSelect` | 可访问角色（仅前端调用有效） |
| `Timeout` | `int` | `Text` | V8 超时时间（秒，默认 10 分钟） |
| `MaxStatements` | `int` | `NumberText` | 最大语句数（最大 2147483647） |
| `LimitMemory` | `int` | `Text` | 内存限制（MB，最大 2GB） |
| `LimitRecursion` | `int` | `NumberText` | 递归深度限制 |
| `EnableLog` | `int` | `Switch` | 开启日志 |
| `ApiRemark` | `mediumtext` | `Textarea` | 接口说明 |
| `TestParam` | `mediumtext` | `Textarea` | 测试参数（标准 JSON） |
| `TestResult` | `mediumtext` | `Textarea` | 测试结果 |

### `sys_datasource` — 数据源引擎（12 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `DataSourceKey` | `varchar(50)` | `Text` | 数据源 Key |
| `DataSourceName` | `varchar(50)` | `Text` | 名称 |
| `DataSourceType` | `varchar(100)` | `Radio` | 类型（V8/SQL/JSON） |
| `IsEnable` | `bit` | `Switch` | 是否启用 |
| `AllowAnonymous` | `int` | `Switch` | 允许匿名调用 |
| `DataSourceRole` | `mediumtext` | `MultipleSelect` | 可访问角色 |
| `V8DataSource` | `mediumtext` | `CodeEditor` | V8 数据源代码 |
| `SqlDataSource` | `mediumtext` | `CodeEditor` | SQL 数据源 |
| `JsonDataSource` | `mediumtext` | `CodeEditor` | JSON 数据源 |
| `TestParam` | `mediumtext` | `Textarea` | 测试参数 |
| `TestResult` | `mediumtext` | `Textarea` | 测试结果 |

### `microi_database` — 扩展数据库（10 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `DbKey` | `varchar(50)` | `Text` | Key，对应 `V8.Dbs.<DbKey>` |
| `DbName` | `varchar(50)` | `Text` | 名称 |
| `DbType` | `varchar(50)` | `Radio` | 数据库类型（默认 MySQL） |
| `DbVersion` | `varchar(50)` | `Text` | 版本（oracle 11g/12c） |
| `DbConn` | `varchar(255)` | `Textarea` | 主连接字符串 |
| `DbReadConn` | `mediumtext` | `Textarea` | 从库连接字符串（空=用主库） |
| `DbReadType` | `varchar(50)` | `Radio` | 从库版本（空=取 DbType） |
| `IsEnable` | `int` | `Switch` | 是否启用 |
| `Remark` | `mediumtext` | `Textarea` | 备注 |

### `sys_user` — 员工信息（37 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `Account` | `varchar(255)` | `Text` | 登录账号 |
| `Pwd` | `varchar(255)` | `Text` | 密码（加密存储） |
| `Name` | `varchar(255)` | `Text` | 姓名 |
| `No` | `varchar(50)` | `AutoNumber` | 编号 |
| `Phone` | `varchar(255)` | `Text` | 手机号 |
| `Email` | `varchar(255)` | `Text` | 邮箱 |
| `Sex` | `varchar(50)` | `Radio` | 性别 |
| `Avatar` | `varchar(255)` | `Text` | 头像 |
| `State` | `int(11)` | `Radio` | 状态 |
| `Level` | `int(11)` | `NumberText` | 权限级别（角色自动设置，越大权限越高） |
| `RoleIds` | `mediumtext` | `MultipleSelect` | 角色 Id 列表 |
| `DeptId` | `varchar(36)` | `Department` | 所属组织机构（最后一个 Id） |
| `DeptIds` | `mediumtext` | `Department` | 所有所属机构 Id（兼职） |
| `DeptName` | `varchar(255)` | `Text` | 部门名称 |
| `DeptCode` | `varchar(255)` | `Text` | 所属机构 Code |
| `UserType` | `varchar(50)` | `Radio` | 账号类型 |
| `TenantId` | `varchar(36)` | `Text` | 租户 Id |
| `TenantName` | `varchar(255)` | `Select` | 所属租户 |
| `LastLoginTime` | `varchar(25)` | `DateTime` | 最后登录时间 |
| `LastLoginIP` | `varchar(50)` | `Text` | 最后登录 IP |
| `WxOpenId` | `varchar(50)` | `Text` | 微信公众号 OpenId |
| `MiniProgramOpenId` | `varchar(100)` | `Text` | 小程序 OpenId |
| `WxNickName` | `varchar(50)` | `Text` | 微信昵称 |
| `WxAvatar` | `varchar(255)` | `Text` | 微信头像 |
| `WxMpId` | `varchar(50)` | `Select` | 绑定公众号 |
| `FeishuUnionId` | `varchar(50)` | `Text` | 飞书 UnionId |
| `Lang` | `varchar(50)` | `Radio` | 多语言偏好 |
| `DesktopType` | `varchar(50)` | `Radio` | 桌面模式 |
| `DesktopBg` | `varchar(200)` | `ImgUpload` | 系统背景 |
| `RandomDesktopBg` | `int` | `Switch` | 随机壁纸 |
| `Remark` | `varchar(255)` | `Textarea` | 备注 |
| `PwdEncode` | `varchar(50)` | `Radio` | 密码存储形式 |
| `LicenseType` | `varchar(50)` | `Radio` | 授权类型 |

### `sys_role` — 角色（9 字段）

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| `Name` | `varchar(500)` | `Text` | 角色名称 |
| `Level` | `int(255)` | `NumberText` | 权限级别（999=超级管理员） |
| `Sort` | `int(11)` | `NumberText` | 排序 |
| `Class` | `varchar(500)` | `Text` | 就是 Customer |
| `BaseLimit` | `varchar(500)` | `Text` | 基础权限 |
| `DeptIds` | `mediumtext` | `Textarea` | 可管理的部门 Ids |
| `TenantId` | `varchar(36)` | `Guid` | 租户 Id |
| `TenantName` | `varchar(50)` | `Text` | 租户名 |
| `Remark` | `mediumtext` | `Textarea` | 备注 |

### `sys_rolelimit` — 角色权限（5 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `RoleId` | `varchar(36)` | 角色 Id |
| `FkId` | `varchar(36)` | 菜单/资源 Id |
| `Type` | `varchar(50)` | 权限类型 |
| `Customer` | `varchar(50)` | Customer |
| `Permission` | `mediumtext` | 权限配置 |

### `sys_dept` — 组织机构（9 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `Name` | `varchar(50)` | 部门名称 |
| `Code` | `varchar(255)` | 部门 Code（用于层级查询） |
| `ParentId` | `varchar(36)` | 上级部门 Id |
| `IsCompany` | `bit` | 是否公司级 |
| `Sort` | `int(11)` | 排序 |
| `State` | `int(11)` | 状态 |
| `TenantId` | `varchar(36)` | 租户 Id |
| `TenantName` | `varchar(50)` | 租户名 |
| `Remark` | `mediumtext` | 备注 |

### `wf_flowdesign` — 工作流设计（12 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `FlowName` | `varchar(50)` | 流程名称 |
| `TableId` | `varchar(100)` | 关联表单 Id |
| `JsonData` | `mediumtext` | 流程图 JSON |
| `Category` | `varchar(100)` | 分类 |
| `Roles` | `mediumtext` | 绑定角色 |
| `IsEnable` | `int` | 是否启用 |
| `StartV8` | `mediumtext` | 流程开始 V8 |
| `EndV8` | `mediumtext` | 流程结束 V8 |
| `Sort` | `int` | 排序 |
| `Description` | `mediumtext` | 描述 |
| `Preview` | `mediumtext` | 预览图 |
| `Remark` | `mediumtext` | 备注 |

### `wf_node` — 工作流节点（28 字段，关键字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `NodeName` | `varchar(50)` | 节点名称 |
| `NodeType` | `varchar(100)` | 节点类型 |
| `FlowDesignId` | `varchar(36)` | 所属流程图 Id |
| `TableId` | `varchar(36)` | 关联表单 Id |
| `Roles` | `mediumtext` | 绑定角色 |
| `Users` | `mediumtext` | 绑定账户 |
| `Depts` | `mediumtext` | 组织机构 |
| `SameDeptApprove` | `int` | 同部门领导审批 |
| `AllowSelectUsers` | `int` | 允许手动指定下节点审批人 |
| `AllowAddUsers` | `int` | 允许添加审批人 |
| `AllowRecall` | `int` | 允许撤回 |
| `AllowHandOver` | `int` | 允许移交 |
| `HideHandOverSelect` | `int` | 隐藏移交选择人 |
| `BackNodes` | `mediumtext` | 可退回节点 |
| `CopyUsers` | `mediumtext` | 抄送 |
| `FieldsConfig` | `mediumtext` | 字段权限配置 |
| `Timeout` | `int` | 超时时间 |
| `StartV8` | `mediumtext` | 节点开始 V8（前端） |
| `EndV8` | `mediumtext` | 节点结束 V8（前端） |
| `StartV8Server` | `mediumtext` | 节点开始 V8（后端） |
| `EndV8Server` | `mediumtext` | 节点结束 V8（后端） |
| `LineValueV8` | `mediumtext` | 条件判断 V8（决定流程走向） |
| `PositionLeft` | `varchar(25)` | 坐标 X |
| `PositionTop` | `varchar(25)` | 坐标 Y |
| `Description` | `mediumtext` | 描述 |
| `Remark` | `mediumtext` | 备注 |

### `wf_line` — 工作流连线（6 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `FlowDesignId` | `varchar(36)` | 所属流程图 Id |
| `FromNodeId` | `varchar(36)` | 起始节点 Id |
| `ToNodeId` | `varchar(36)` | 目标节点 Id |
| `LineName` | `varchar(50)` | 条件名称 |
| `LineValue` | `varchar(50)` | 条件值 |
| `V8Code` | `mediumtext` | 条件 V8 代码 |

### `wf_flow` — 流程实例（15 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `FlowNo` | `varchar(25)` | 流程编号（自动编号） |
| `FlowTitle` | `varchar(50)` | 流程标题 |
| `FlowState` | `varchar(50)` | 流程状态 |
| `FlowDesignId` | `varchar(36)` | 流程设计 Id |
| `TableId` | `varchar(36)` | 关联表单 Id |
| `TableRowId` | `varchar(36)` | 关联业务数据行 Id |
| `Sender` | `varchar(50)` | 发起人姓名 |
| `SenderId` | `varchar(36)` | 发起人 Id |
| `StartNodeId` | `varchar(36)` | 起始节点 Id |
| `StartNodeName` | `varchar(50)` | 起始节点名称 |
| `FormData` | `mediumtext` | 最新表单数据（每节点处理后更新） |
| `HandlerUsers` | `mediumtext` | 处理过的人（同意/不同意/撤回/发起） |
| `NotHandlerUsers` | `mediumtext` | 收到待办但未处理的人 |
| `CopyUsers` | `mediumtext` | 抄送过的人 |
| `NoticeFields` | `mediumtext` | 通知字段 |

### `wf_work` — 工作流待办/已办（21 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `FlowId` | `varchar(36)` | 流程实例 Id |
| `FlowDesignId` | `varchar(36)` | 流程设计 Id |
| `FlowNo` | `varchar(50)` | 流程编号 |
| `FlowTitle` | `varchar(50)` | 流程标题 |
| `TableId` | `varchar(36)` | 关联表单 Id |
| `TableRowId` | `varchar(36)` | 关联业务行 Id |
| `NodeId` | `varchar(36)` | 当前节点 Id |
| `NodeName` | `varchar(50)` | 当前节点名称 |
| `FromNodeId` | `varchar(36)` | 来源节点 Id |
| `FromNodeName` | `varchar(50)` | 来源节点名称 |
| `Receiver` | `varchar(50)` | 接收人姓名 |
| `ReceiverId` | `varchar(36)` | 接收人 Id |
| `Sender` | `varchar(50)` | 发送人姓名 |
| `SenderId` | `varchar(36)` | 发送人 Id |
| `FirstSender` | `varchar(50)` | 最初发起人 |
| `FirstSenderId` | `varchar(36)` | 最初发起人 Id |
| `WorkState` | `varchar(50)` | 工作状态 |
| `Timeout` | `int` | 超时时间 |
| `FormData` | `mediumtext` | 表单数据快照 |
| `NoticeFields` | `mediumtext` | 通知字段 |
| `Remark` | `mediumtext` | 备注 |

### `wf_history` — 流程历史（23 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `FlowId` | `varchar(36)` | 流程实例 Id |
| `FlowDesignId` | `varchar(36)` | 流程设计 Id |
| `FlowNo` | `varchar(50)` | 流程编号 |
| `FlowName` | `varchar(50)` | 流程名称 |
| `FlowTitle` | `varchar(50)` | 流程标题 |
| `TableId` | `varchar(36)` | 关联表单 Id |
| `TableRowId` | `varchar(36)` | 关联业务行 Id |
| `WorkId` | `varchar(50)` | 工作 Id |
| `FromNodeId` | `varchar(36)` | 来源节点 Id |
| `FromNodeName` | `varchar(50)` | 来源节点名称 |
| `ToNodeId` | `varchar(36)` | 目标节点 Id |
| `ToNodeName` | `varchar(50)` | 目标节点名称 |
| `ToNodes` | `mediumtext` | 所有目标节点 |
| `LineId` | `varchar(36)` | 连线 Id |
| `LineValue` | `varchar(50)` | 连线值 |
| `ApprovalType` | `varchar(50)` | 审批类型（Agree/Disagree/Recall/Auto） |
| `ApprovalIdea` | `mediumtext` | 审批意见 |
| `Sender` | `varchar(50)` | 操作人 |
| `SenderId` | `varchar(36)` | 操作人 Id |
| `Receivers` | `mediumtext` | 接收人列表 |
| `CopyUsers` | `mediumtext` | 抄送人 |
| `FormData` | `mediumtext` | 表单数据快照 |
| `NoticeFields` | `mediumtext` | 通知字段 |
