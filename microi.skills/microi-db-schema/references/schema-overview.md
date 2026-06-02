# Microi DB Schema Overview

- Source: `ai-helper/microi/db.json`
- Tables: 75
- Configurable fields: 975

## Fixed Fields

DIY tables created by the platform include fixed fields even when they are not present in the exported `_Fields`: `Id`, `CreateTime`, `UpdateTime`, `UserId`, `UserName`, `IsDeleted`.

## Core Relationships

| Relationship | Meaning |
|---|---|
| `diy_table.Id` -> `diy_field.TableId` | One table has many field definitions. |
| `diy_table.Name` | Table key used by `V8.FormEngine`. |
| `sys_menu.DiyTableId` -> `diy_table.Id` | A module binds to a form table. |
| `sys_menu.DiyTableName` -> `diy_table.Name` | Runtime module table name. |
| `diy_field.TableChildTableId` -> `diy_table.Id` | Child table component target table. |
| `diy_field.TableChildSysMenuId` -> `sys_menu.Id` | Child table component target menu. |
| `wf_flowdesign.TableId` -> `diy_table.Id` | Workflow design binds to a form table. |
| `wf_flow.TableRowId` -> business row `Id` | Workflow instance points to a business record. |
| `sys_apiengine.ApiEngineKey` | Key for `V8.ApiEngine.Run`. |
| `microi_database.DbKey` | Key for `V8.Dbs.<DbKey>`. |

## V8 Storage Fields

| 表 | 字段 | 运行位置 | 用途 |
|---|---|---|---|
| `diy_table` | `InFormV8` | 前端 | 表单打开/进入时执行，初始化字段显隐、默认值、联动状态。 |
| `diy_table` | `SubmitFormV8` | 前端 | 表单提交前执行，做前端校验和提交前加工。 |
| `diy_table` | `OutFormV8` | 前端 | 表单提交后/关闭后执行，常用于刷新、跳转和提示。 |
| `diy_table` | `SubmitBeforeServerV8` | 后端 | 数据写入数据库前、事务内执行，失败返回 Code=0 可阻止提交。 |
| `diy_table` | `SubmitAfterServerV8` | 后端 | 数据写入数据库后、提交前执行，常用于同步其它表、通知、日志。 |
| `diy_table` | `ServerDataV8` | 后端 | 后端数据处理事件，常用于行数据加工。 |
| `diy_table` | `ApiReplace` | 后端 | 表单接口替换/增强入口。 |
| `diy_field` | `V8Code` | 前端 | 字段值变更事件。 |
| `diy_field` | `KeyupV8Code` | 前端 | 键盘事件。 |
| `diy_field` | `V8TmpEngineTable` | 前端/渲染 | 表格模板 V8，用于列表单元格渲染。 |
| `diy_field` | `V8TmpEngineForm` | 前端/渲染 | 表单模板 V8，用于表单展示。 |
| `sys_menu` | `AddCodeShowV8` | 前端 | [新增]按钮显示条件。 |
| `sys_menu` | `EditCodeShowV8` | 前端 | [编辑]按钮显示条件。 |
| `sys_menu` | `DelCodeShowV8` | 前端 | [删除]按钮显示条件。 |
| `sys_menu` | `DetailPageV8` | 前端 | 详情按钮行为。 |
| `sys_menu` | `DiyConfig` | 前端/模块 | 模块级自定义配置。 |
| `sys_menu` | `SqlJoin` | 后端查询 | 列表查询 JOIN 片段。默认主表别名为 A。 |
| `sys_menu` | `SqlWhere` | 后端查询 | 模块级 Where 片段，可使用 CurrentUser 变量。 |
| `sys_menu` | `ImportV8` | 导入 | 导入处理扩展。 |
| `sys_menu` | `ExportV8` | 导出 | 导出处理扩展。 |
| `sys_apiengine` | `ApiV8Code` | 后端 | 接口引擎服务器端 JavaScript。 |
| `sys_datasource` | `V8DataSource` | 后端 | V8 数据源。 |
| `sys_datasource` | `SqlDataSource` | 后端 | SQL 数据源。 |
| `sys_datasource` | `JsonDataSource` | 配置 | 静态 JSON 数据源。 |
| `Sys_Config` | `GlobalV8Code` | 前端全局 | 前端全局 V8 初始化。 |
| `Sys_Config` | `GlobalServerV8Code` | 后端全局 | 每次后端 V8 执行时加载的全局函数。 |
| `wf_flowdesign` | `StartV8 / EndV8` | 工作流 | 流程开始/结束事件。 |
| `wf_node` | `StartV8 / EndV8 / StartV8Server / EndV8Server / LineValueV8` | 工作流节点 | 节点进入、结束、条件判断和服务器端节点扩展。 |
| `wf_line` | `V8Code` | 工作流线 | 流程连线条件代码。 |

## Table Categories

### 低代码元数据与引擎配置

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_table` | 43 | Diy_Table |
| `diy_field` | 36 | Diy_Field |
| `diy_component` | 11 | 表单引擎组件 |
| `sys_menu` | 91 | 模块引擎 |
| `sys_apiengine` | 26 | 接口引擎 |
| `sys_datasource` | 12 | 数据源引擎 |
| `microi_database` | 10 | 数据库管理 |
| `mic_page` | 6 | 界面引擎 |
| `mic_print` | 6 | 打印引擎 |
| `microi_print_template` | 3 | 导出模板 |
| `Rpt_Report` | 15 | 报表引擎 |
| `rpt_user_setting` | 6 | [系统]个人设置 |
| `diy_LeftJoinRightView` | 31 | 左右结构配置表 |

### 系统、租户、权限与审计

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `Sys_Config` | 70 | 系统设置 |
| `sys_osclients` | 92 | OsClients |
| `sys_user` | 37 | 员工信息 |
| `sys_role` | 9 | Sys_Role |
| `sys_rolelimit` | 5 | sys_rolelimit |
| `sys_dept` | 9 | Sys_Dept |
| `diy_tenant` | 1 | 租户管理 |
| `sys_basedata` | 9 | sys_basedata |
| `sys_log` | 11 | sys_log |
| `microi_datalog` | 9 | 数据日志 |
| `diy_lang` | 12 | 多语言 |
| `sys_servernode` | 6 | 服务器节点管理 |
| `sys_microiservice` | 6 | 微服务 |

### 工作流引擎

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `wf_flowdesign` | 12 | 工作流设计 |
| `wf_node` | 28 | 流程引擎节点属性 |
| `wf_line` | 6 | 工作流程条件引擎线属性 |
| `wf_flow` | 15 | 流程实例 |
| `wf_work` | 21 | 工作流工作 |
| `wf_history` | 23 | 流程轨迹/历史/记录 |
| `wf_nodelist` | 5 | 节点列表 |

### 消息、集成与自动化

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_queue_receive` | 11 | 消息队列管理 |
| `diy_queue_receive_log` | 9 | 消息队列日志 |
| `mci_mqtt_client` | 5 | MQTT客户端 |
| `mci_mqtt_log` | 4 | MQTT记录 |
| `diy_schedule_job` | 22 | 定时任务表 |
| `diy_schedule_job_log` | 2 | 定时任务日志 |
| `diy_feishu_app` | 4 | 应用列表 |
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
| `diy_modulehits` | 9 | 模块访问次数统计 |
| `diy_menufavorite` | 4 | 菜单收藏夹 |
| `mic_ai` | 19 | AI模型管理 |
| `mic_ai_record` | 5 | mic_ai_record |
| `mic_data_dashboard` | 5 | 数据大屏 |
| `mic_data_version` | 10 | 数据版本 |
| `mic_day_word` | 2 | 每日一言 |
| `microi_calendar` | 6 | 日历 |
| `microi_icon` | 3 | 图标管理 |
| `diy_searchengine_name_alias` | 2 | 搜索引擎index名称和别名对应关系表 |
| `diy_sso` | 6 | 单点登陆 |

### 授权、商城与示例业务

| 表名 | 字段数 | 说明 |
|---|---:|---|
| `diy_license` | 19 | 授权管理 |
| `diy_license_log` | 9 | 授权日志 |
| `sys_microistore` | 21 | 应用商城 |
| `sys_microistoreversion` | 1 | 应用商城应用版本 |
| `sys_appinstalled` | 6 | 已安装应用 |
| `sys_microiuptlog` | 7 | 框架更新日志 |
| `b2c_product` | 19 | b2c_product |
| `diy_course` | 3 | 课程表 |
| `eban` | 5 | EBAN |
| `mic_memo` | 3 | 备忘录 |
| `mic_3d_engine` | 0 | 3D引擎 |

## Component Counts

| Component | Count |
|---|---:|
| `Text` | 403 |
| `Switch` | 108 |
| `Textarea` | 94 |
| `NumberText` | 55 |
| `Guid` | 53 |
| `Radio` | 47 |
| `CodeEditor` | 47 |
| `Select` | 35 |
| `MultipleSelect` | 22 |
| `ImgUpload` | 17 |
| `JsonTable` | 16 |
| `DateTime` | 12 |
| `Button` | 10 |
| `RichText` | 7 |
| `TableChild` | 7 |
| `ColorPicker` | 6 |
| `SelectTree` | 5 |
| `Cascader` | 5 |
| `FileUpload` | 4 |
| `AutoNumber` | 4 |
| `(空)` | 4 |
| `FontAwesome` | 3 |
| `Department` | 3 |
| `Checkbox` | 2 |
| `Divider` | 2 |
| `Autocomplete` | 1 |
| `JoinForm` | 1 |
| `Rate` | 1 |
| `DevComponent` | 1 |
