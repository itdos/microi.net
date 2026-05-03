# Microi Table Catalog

Full generated catalog from `ai-helper/microi/db.json`. Load this only when a task needs exact fields outside the core tables.

## All Tables

| Table | Fields | Description |
|---|---:|---|
| `b2c_product` | 19 | b2c_product |
| `diy_component` | 11 | 表单引擎组件 |
| `diy_course` | 3 | 课程表 |
| `diy_document` | 7 | 低代码平台文档 |
| `diy_feishu_app` | 4 | 应用列表 |
| `diy_field` | 36 | Diy_Field |
| `diy_lang` | 12 | 多语言 |
| `diy_LeftJoinRightView` | 31 | 左右结构配置表 |
| `diy_license` | 19 | 授权管理 |
| `diy_license_log` | 9 | 授权日志 |
| `diy_menufavorite` | 4 | 菜单收藏夹 |
| `diy_modulehits` | 9 | 模块访问次数统计 |
| `diy_news` | 2 | 网站文章 |
| `diy_notice` | 4 | 公告 |
| `diy_qiwei_app` | 5 | 企业微信应用 |
| `diy_queue_receive` | 11 | 消息队列管理 |
| `diy_queue_receive_log` | 9 | 消息队列日志 |
| `diy_schedule_job` | 22 | 定时任务表 |
| `diy_schedule_job_log` | 2 | 定时任务日志 |
| `diy_searchengine_name_alias` | 2 | 搜索引擎index名称和别名对应关系表 |
| `diy_sso` | 6 | 单点登陆 |
| `diy_table` | 43 | Diy_Table |
| `diy_tenant` | 1 | 租户管理 |
| `diy_tips` | 5 | 提醒 |
| `diy_wallpaper` | 4 | 壁纸管理 |
| `eban` | 5 | EBAN |
| `mci_mqtt_client` | 5 | MQTT客户端 |
| `mci_mqtt_log` | 4 | MQTT记录 |
| `mic_3d_engine` | 0 | 3D引擎 |
| `mic_ai` | 19 | AI模型管理 |
| `mic_ai_record` | 5 | mic_ai_record |
| `mic_data_dashboard` | 5 | 数据大屏 |
| `mic_data_version` | 10 | 数据版本 |
| `mic_day_word` | 2 | 每日一言 |
| `mic_email_server` | 7 | 邮件配置 |
| `mic_memo` | 3 | 备忘录 |
| `mic_msg_event_log` | 5 | 消息通知事件日志 |
| `mic_msgset` | 10 | 消息通知设置 |
| `mic_page` | 6 | 界面引擎 |
| `mic_print` | 6 | 打印引擎 |
| `microi_calendar` | 6 | 日历 |
| `microi_database` | 10 | 数据库管理 |
| `microi_datalog` | 9 | 数据日志 |
| `microi_icon` | 3 | 图标管理 |
| `microi_print_template` | 3 | 导出模板 |
| `Rpt_Report` | 15 | 报表引擎 |
| `rpt_user_setting` | 6 | [系统]个人设置 |
| `sys_apiengine` | 26 | 接口引擎 |
| `sys_appinstalled` | 6 | 已安装应用 |
| `sys_basedata` | 9 | sys_basedata |
| `Sys_Config` | 70 | 系统设置 |
| `sys_datasource` | 12 | 数据源引擎 |
| `sys_dept` | 9 | Sys_Dept |
| `sys_log` | 11 | sys_log |
| `sys_menu` | 91 | 模块引擎 |
| `sys_microiservice` | 6 | 微服务 |
| `sys_microistore` | 21 | 应用商城 |
| `sys_microistoreversion` | 1 | 应用商城应用版本 |
| `sys_microiuptlog` | 7 | 框架更新日志 |
| `sys_osclients` | 92 | OsClients |
| `sys_role` | 9 | Sys_Role |
| `sys_rolelimit` | 5 | sys_rolelimit |
| `sys_servernode` | 6 | 服务器节点管理 |
| `sys_user` | 37 | 员工信息 |
| `wf_flow` | 15 | 流程实例 |
| `wf_flowdesign` | 12 | 工作流设计 |
| `wf_history` | 23 | 流程轨迹/历史/记录 |
| `wf_line` | 6 | 工作流程条件引擎线属性 |
| `wf_node` | 28 | 流程引擎节点属性 |
| `wf_nodelist` | 5 | 节点列表 |
| `wf_work` | 21 | 工作流工作 |
| `wx_menu` | 3 | 微信公众号自定义菜单 |
| `wx_mini_program` | 3 | 微信小程序 |
| `wx_mp` | 7 | 微信公众号配置 |
| `wx_tpl_msg` | 10 | 公众号模板消息 |

## Fields

### `b2c_product` - b2c_product

字段数：19

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `StarLevel` | 星级 | `int(11)` | `NumberText` | 星级 |
| `Preview` | 预览图 | `varchar(255)` | `Text` | 预览图 |
| `Name` | Name | `varchar(255)` | `Text` | Name |
| `Stock` | Stock | `int(11)` | `NumberText` | Stock |
| `Code` | 分类 | `varchar(50)` | `Text` | 分类 |
| `Parameters` | 产品描述 | `mediumtext` | `Textarea` | 产品描述 |
| `FirstPrice` | 原价 | `decimal(19,2)` | `NumberText` | 原价 |
| `Price3` | 代理价格 | `decimal(19,2)` | `NumberText` | 代理价格 |
| `Price2` | 批发价格 | `decimal(19,2)` | `NumberText` | 批发价格 |
| `StateValue` | 状态 | `varchar(255)` | `Text` | 状态 |
| `Infomation` | 产品参数 | `mediumtext` | `Textarea` | 产品参数 |
| `SubTitle` | SubTitle | `varchar(1000)` | `Text` | SubTitle |
| `Description` | SEO-Description | `varchar(1000)` | `Text` | SEO-Description |
| `Number` | Number | `varchar(255)` | `Text` | Number |
| `Keywords` | SEO-Keywords | `varchar(1000)` | `Text` | SEO-Keywords |
| `Price` | 价格 | `decimal(19,2)` | `NumberText` | 价格 |
| `Hits` | 点击数 | `int(11)` | `NumberText` | 点击数 |
| `State` | 状态,1售卖中，0已下架，9已删除 | `int(11)` | `NumberText` | 状态,1售卖中，0已下架，9已删除 |
| `Postage` | 邮费 | `decimal(19,2)` | `NumberText` | 邮费 |

### `diy_component` - 表单引擎组件

字段数：11

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Description` | 描述 | `mediumtext` | `Textarea` | 描述 |
| `Type` | 组件分类 | `varchar(50)` | `Radio` | 组件分类 |
| `IsNew` | 是否新组件 | `bit` | `Switch` | 是否新组件 |
| `FieldType` | 字段类型 | `varchar(50)` | `Text` | 字段类型 |
| `Name` | 组件名称 | `varchar(255)` | `Text` | 组件名称 |
| `Disable` | 是否禁用 | `bit` | `Switch` | 是否禁用 |
| `Control` | 控件类型 | `varchar(50)` | `Text` | 控件类型 |
| `Readonly` | 默认只读 | `bit` | `Switch` | 默认只读 |
| `Sort` | 排序 | `int` | `NumberText` | 排序 |
| `Icon` | 组件图标 | `varchar(25)` | `FontAwesome` | 组件图标 |
| `Path` | 组件路径 | `varchar(50)` | `Text` | 组件路径 |

### `diy_course` - 课程表

字段数：3

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `courseName` | 课程名称 | `varchar(50)` | `Text` | 课程名称 |
| `courseNo` | 课程编号 | `varchar(50)` | `Text` | 课程编号 |
| `courseType` | 课程类型 | `varchar(50)` | `Radio` | 课程类型 |

### `diy_document` - 低代码平台文档

字段数：7

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IframeUrl` | IframeUrl | `varchar(255)` | `Text` | IframeUrl |
| `ParentIds` | ParentIds | `varchar(3600)` | `Textarea` | ParentIds |
| `Title` | 标题 | `varchar(50)` | `Text` | 标题 |
| `ParentId` | 上级 | `varchar(36)` | `SelectTree` | 上级 |
| `Content` | 内容 | `mediumtext` | `RichText` | 内容 |
| `Sort` | 排序 | `int` | `NumberText` | 排序 |
| `Display` | 是否显示 | `bit` | `Switch` | 是否显示 |

### `diy_feishu_app` - 应用列表

字段数：4

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `AppId` | AppId | `varchar(50)` | `Text` | AppId |
| `AppName` | 应用名称 | `varchar(50)` | `Text` | 应用名称 |
| `AppSecret` | AppSecret | `varchar(50)` | `Text` | AppSecret |
| `AppKey` | 应用Key | `varchar(50)` | `Text` | 自定义 |

### `diy_field` - Diy_Field

字段数：36

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Label` | 显示名称 | `varchar(255)` | `Text` | 显示名称 |
| `TableName` | 所属表名 | `varchar(50)` | `Text` | 所属表名 |
| `V8Code` | 值变更V8事件 | `mediumtext` | `CodeEditor` | 值变更V8事件 |
| `NotEmpty` | 是否必填 | `int` | `Switch` | 是否必填 |
| `Sort` | 排序 | `int(11)` | `NumberText` | 排序 |
| `V8TmpEngineForm` | 模板V8引擎（表单） | `mediumtext` | `CodeEditor` | 模板V8引擎（表单） |
| `IsVirtual` | 虚拟字段 | `int` | `Switch` | 虚拟字段 |
| `Data` | 普通数据源 | `mediumtext` | `Textarea` | 普通数据源 |
| `DataAppend` | 附加数据 | `mediumtext` | `Textarea` | 附加数据 |
| `FormLabelPosition` | 标签对齐方式 | `varchar(50)` | `Radio` | 标签对齐方式 |
| `KeyupV8Code` | 键盘V8事件 | `mediumtext` | `CodeEditor` | 键盘V8事件 |
| `IsLockField` | 是否锁定字段名称和类型 | `int` | `Switch` | 是否锁定字段名称和类型 |
| `Visible` | 是否可见 | `int` | `Switch` | 是否可见 |
| `Description` | 字段说明 | `mediumtext` | `Textarea` | 字段说明 |
| `Component` | 控件类型 | `varchar(255)` | `Select` | 控件类型 |
| `DefaultValue` | 默认值 | `varchar(255)` | `Text` | 默认值 |
| `Placeholder` | 占位文字 | `varchar(255)` | `Text` | 占位文字 |
| `BindRole` | 前端可见角色 | `mediumtext` | `MultipleSelect` | 前端可见角色 |
| `AppVisible` | 移动端可见 | `int` | `Switch` | 移动端可见 |
| `Encrypt` | Encrypt | `int` | `Switch` | Encrypt |
| `Readonly` | 是否只读 | `int` | `Switch` | 是否只读 |
| `TableId` | 所属表Id | `varchar(36)` | `Text` | TableId |
| `Config` | 配置 | `mediumtext` | `Textarea` | 配置 |
| `TableWidth` | 表格占宽 | `int(11)` | `Text` | 表格占宽 |
| `NameConfirm` | 已确认字段名 | `int` | `Switch` | 已确认字段名 |
| `Code` | Code | `varchar(255)` | `Text` | Code |
| `V8TmpEngineTable` | 模板V8引擎（表格） | `mediumtext` | `CodeEditor` | 模板V8引擎（表格） |
| `Unique` | 是否唯一 | `int` | `Switch` | 是否唯一 |
| `InTableEdit` | 开启表内编辑 | `int` | `Switch` | 开启表内编辑 |
| `Name` | 字段名 | `varchar(255)` | `Text` | 字段名 |
| `OsClient` | OsClient | `varchar(255)` | `Text` | OsClient |
| `Type` | 字段类型 | `varchar(255)` | `Autocomplete` | 字段类型 |
| `Tab` | 所属表单分组 | `varchar(255)` | `Select` | 所属表单分组 |
| `FormWidth` | 表单占宽 | `int(11)` | `Radio` | 表单占宽 |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `ComponentWidth` | 控件宽度 | `varchar(50)` | `Text` | 控件宽度 |

### `diy_lang` - 多语言

字段数：12

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Code` | Code | `varchar(50)` | `Text` | 一般是数字，可不填 |
| `ZhTW` | 中文繁体 | `varchar(50)` | `Text` | zh-TW |
| `ParentId` | 选择父级 | `varchar(50)` | `SelectTree` | 选择父级 |
| `Sort` | 排序 | `int` | `NumberText` | 排序 |
| `HasChild` | HasChild | `int` | `Switch` | HasChild |
| `ZhCN` | 中文简体 | `varchar(50)` | `Text` | zh-CN |
| `En` | 英语 | `varchar(50)` | `Text` | en |
| `ParentKey` | 父级Key | `varchar(50)` | `Text` | 父级Key |
| `vi` | 越南语 | `varchar(50)` | `Text` | 越南语 |
| `Key` | Key | `varchar(50)` | `Text` | Key |
| `Remark` | 备注 | `varchar(50)` | `Text` | 备注 |
| `ParentIds` | ParentIds | `mediumtext` | `Textarea` | ParentIds |

### `diy_LeftJoinRightView` - 左右结构配置表

字段数：31

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `TanchuangLX` | 弹窗类型 | `varchar(100)` | `Select` | 新增修改点击事件打开弹窗类型 |
| `ShudingJXZ` | 树顶级新增 | `int` | `Switch` | 树顶级新增 |
| `TianjiaCJ` | 添加层级 | `int` | `NumberText` | 添加按钮按层级显示，1表示一级菜单可以有添加按钮 |
| `YincangBSF` | 隐藏标识符 | `varchar(50)` | `Text` | 隐藏标识符 |
| `ShuxinZ` | 树新增 | `int` | `Switch` | 树新增 |
| `YoubianZSZJ` | 右边展示组件 | `varchar(100)` | `Select` | 右边展示组件 |
| `GuanlianCD` | 关联菜单 | `mediumtext` | `Cascader` | 当前配置项关联的菜单 |
| `ZibiaoGLZD` | 子表关联字段 | `varchar(50)` | `Text` | 子表关联字段 |
| `ShuxiaLSS` | 树下拉搜索 | `int` | `Switch` | 树下拉搜索 |
| `ShutanCSS` | 树弹窗搜索 | `int` | `Switch` | 树弹窗搜索 |
| `ZuobianZSZJ` | 左边展示组件 | `varchar(100)` | `Select` | true跟false隐藏右侧组件栏 |
| `ShushanC` | 树删除 | `int` | `Switch` | 树删除 |
| `ShubiaoT` | 树标题 | `varchar(50)` | `Text` | 树标题 |
| `ChufaSJ` | ChufaSJ | `mediumtext` | `CodeEditor` | ChufaSJ |
| `ShujieDDJSJ` | 树节点点击事件 | `mediumtext` | `CodeEditor` | 树节点点击事件 |
| `ZuoyouXSZB` | 左右显示占比 | `varchar(50)` | `Text` | 示例：4/20其中/为必要的分隔符 |
| `FubiaoGLZD` | 父表关联字段 | `varchar(50)` | `Text` | 父表关联字段 |
| `ShubianJ` | 树编辑 | `int` | `Switch` | 树编辑 |
| `ShuxianSZDM` | 树显示字段名 | `varchar(50)` | `Text` | 树形结构显示内容需要跟返回的JSON格式Key名一致 |
| `ShuxiaLSJHQ` | 树下拉数据获取 | `mediumtext` | `CodeEditor` | 树下拉数据获取 |
| `TanchuangDX` | 弹窗大小 | `varchar(50)` | `Text` | 弹窗大小 |
| `LanjiaZ` | 懒加载 | `int` | `Switch` | 懒加载 |
| `ShushuaX` | 树刷新 | `int` | `Switch` | 树刷新 |
| `LanjiaZDM` | 懒加载代码 | `mediumtext` | `CodeEditor` | 懒加载代码 |
| `GuanlianPPLJ` | 关联匹配逻辑 | `varchar(100)` | `Select` | 关联匹配逻辑 |
| `ShuxingGLCD` | 树形关联菜单 | `mediumtext` | `Cascader` | 树形关联菜单 |
| `ShumoHSS` | 树模糊搜索 | `int` | `Switch` | 树模糊搜索 |
| `GuanlianBD` | 关联表单 | `varchar(100)` | `Select` | 当前目录结构所用到的数据库表名 |
| `ChushiHDM` | 初始化代码 | `mediumtext` | `CodeEditor` | 初始化代码 |
| `JiedianANXSSJ` | 节点按钮显示事件 | `mediumtext` | `CodeEditor` | 节点按钮显示事件 |
| `ShusouSAN` | 树搜索按钮 | `int` | `Switch` | 树搜索按钮 |

### `diy_license` - 授权管理

字段数：19

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `LicenseFile` | LicenseFile | `mediumtext` | `FileUpload` | LicenseFile |
| `Phone` | 联系电话 | `varchar(50)` | `Text` | 联系电话 |
| `Revoked` | 是否已作废 | `int` | `Switch` | 是否已作废 |
| `LicenseContent` | License文件内容（签发时写入） | `mediumtext` | `Textarea` | License文件内容（签发时写入） |
| `Status` | 状态 | `varchar(50)` | `Radio` | Pending（待审核）/ Issued（已签发）/ Rejected（已驳回） |
| `RejectReason` | 驳回原因 | `mediumtext` | `Textarea` | 驳回原因 |
| `ApplyUserId` | 申请人Id | `varchar(36)` | `Guid` | 申请人的 sys_user Id |
| `ApplyUserName` | 申请人 | `varchar(50)` | `Text` | 申请人 |
| `LicenseType` | LicenseType | `varchar(50)` | `Text` | LicenseType |
| `IP` | 服务器IP | `varchar(50)` | `Text` | 服务器IP |
| `ExpirationDate` | 授权到期时间 | `varchar(50)` | `Text` | 授权到期时间 |
| `UpdateExpirationDate` | 更新服务到期时间 | `varchar(50)` | `Text` | 更新服务到期时间 |
| `Name` | 联系人 | `varchar(50)` | `Text` | 联系人 |
| `ProductType` | 产品类型 | `varchar(50)` | `Text` | 个人版Personal/企业版Enterprise |
| `Company` | 授权公司名称 | `varchar(50)` | `Text` | 授权公司名称 |
| `ShouquanRZ` | 授权日志 | `` | `TableChild` | 授权日志 |
| `HID` | HID | `varchar(50)` | `Text` | HID |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `RealCompany` | 授权公司名称 | `varchar(50)` | `Text` | 授权公司名称 |

### `diy_license_log` - 授权日志

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `DiyLicenseId` | DiyLicenseId | `varchar(36)` | `Guid` | DiyLicenseId |
| `Name` | Name | `varchar(50)` | `Text` | Name |
| `ExpirationDate` | ExpirationDate | `varchar(50)` | `Text` | ExpirationDate |
| `LicenseType` | LicenseType | `varchar(50)` | `Text` | LicenseType |
| `HID` | HID | `varchar(50)` | `Text` | HID |
| `UpdateExpirationDate` | UpdateExpirationDate | `varchar(50)` | `Text` | UpdateExpirationDate |
| `IP` | IP | `varchar(50)` | `Text` | IP |
| `Company` | Company | `varchar(50)` | `Text` | Company |
| `ProductType` | ProductType | `varchar(50)` | `Text` | ProductType |

### `diy_menufavorite` - 菜单收藏夹

字段数：4

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Sort` | Sort | `int` | `NumberText` | Sort |
| `MenuIconClass` | MenuIconClass | `varchar(50)` | `Text` | MenuIconClass |
| `MenuIcon` | MenuIcon | `varchar(50)` | `Text` | MenuIcon |
| `MenuName` | MenuName | `varchar(50)` | `Text` | MenuName |

### `diy_modulehits` - 模块访问次数统计

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `ModuleOpenType` | ModuleOpenType | `varchar(50)` | `Text` | ModuleOpenType |
| `HitUserId` | HitUserId | `varchar(36)` | `Guid` | HitUserId |
| `ModuleId` | ModuleId | `varchar(36)` | `Guid` | ModuleId |
| `Hits` | Hits | `int` | `NumberText` | Hits |
| `ModuleIconClass` | ModuleIconClass | `varchar(50)` | `Text` | ModuleIconClass |
| `ModuleDescription` | ModuleDescription | `varchar(50)` | `Text` | ModuleDescription |
| `ModuleUrl` | ModuleUrl | `varchar(50)` | `Text` | ModuleUrl |
| `ModuleIcon` | ModuleIcon | `varchar(255)` | `Text` | ModuleIcon |
| `ModuleName` | ModuleName | `varchar(50)` | `Text` | test |

### `diy_news` - 网站文章

字段数：2

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Biaoti` | 标题 | `varchar(50)` | `Text` | 标题 |
| `Neirong` | 内容 | `mediumtext` | `RichText` | 内容 |

### `diy_notice` - 公告

字段数：4

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Biaoqian` | 标签 | `mediumtext` | `Checkbox` | 标签 |
| `Neirong` | 内容 | `mediumtext` | `RichText` | 内容 |
| `Biaoti` | 标题 | `varchar(50)` | `Text` | 标题 |
| `Fenlei` | 分类 | `varchar(50)` | `Radio` | 分类 |

### `diy_qiwei_app` - 企业微信应用

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `YingyongMC` | 应用名称 | `varchar(50)` | `Text` | 应用名称 |
| `QiyeCORPID` | 企业corpid | `varchar(50)` | `Text` | 企业corpid |
| `AppSecret` | AppSecret | `varchar(50)` | `Text` | AppSecret |
| `YingyongKEY` | 应用Key | `varchar(50)` | `Text` | 应用Key |
| `Agentid` | agentid | `varchar(50)` | `Text` | agentid |

### `diy_queue_receive` - 消息队列管理

字段数：11

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `DuilieRZ` | 队列日志 | `` | `Divider` | 队列日志 |
| `QueueDesc` | 队列描述 | `mediumtext` | `Textarea` | 队列描述 |
| `DllName` | 程序集名称 | `varchar(100)` | `Text` | 程序集名称 |
| `Type` | 接口类型 | `varchar(50)` | `Radio` | 接口类型 |
| `QueueName` | 队列名称 | `varchar(50)` | `Text` | 队列名称 |
| `RizhiXX` | 日志信息 | `` | `TableChild` | 日志信息 |
| `FailToReject` | 消息重回队列 | `varchar(100)` | `Select` | 消息重回队列 |
| `ClassName` | 类名称 | `varchar(100)` | `Text` | 类名称 |
| `MethodName` | 方法名称 | `varchar(50)` | `Text` | 方法名称 |
| `ApiEngineKey` | 接口引擎KEY | `varchar(50)` | `Text` | 接口引擎KEY |
| `Count` | 重回队列次数 | `int` | `NumberText` | 重回队列次数 |

### `diy_queue_receive_log` - 消息队列日志

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `MessageId` | 消息Id | `varchar(50)` | `Text` | 消息Id |
| `Status` | 状态 | `varchar(50)` | `Text` | 状态 |
| `SendTime` | 发送时间 | `varchar(50)` | `Text` | 发送时间 |
| `ReceiveTime` | 接收时间 | `varchar(50)` | `Text` | 接收时间 |
| `Message` | 消息 | `mediumtext` | `Textarea` | 消息 |
| `CompleteTime` | 完成时间 | `varchar(50)` | `Text` | 完成时间 |
| `QueueName` | 队列名称 | `varchar(50)` | `Text` | 队列名称 |
| `Type` | 类型 | `varchar(100)` | `Select` | 类型 |
| `StatusInfo` | 状态信息 | `mediumtext` | `Textarea` | 状态信息 |

### `diy_schedule_job` - 定时任务表

字段数：22

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `ZhiXingZQ` | 执行周期 | `varchar(100)` | `Select` | 执行周期 |
| `RenwuZHRZ` | 任务执行日志 | `` | `Divider` | 任务执行日志 |
| `NextTime` | 下次执行时间 | `varchar(50)` | `Text` | 下次执行时间 |
| `JobParam` | 任务参数 | `mediumtext` | `Textarea` | 如：{ "Id" : "123" } |
| `Description` | 任务描述 | `mediumtext` | `Textarea` | 任务描述 |
| `ApiEngineKey` | ApiEngineKey | `varchar(50)` | `Select` | ApiEngineKey |
| `LastTime` | 上次执行时间 | `varchar(50)` | `Text` | 上次执行时间 |
| `XiaoShi` | 小时 | `int` | `NumberText` | 小时 |
| `JobType` | 任务类别 | `varchar(50)` | `Radio` | 任务类别 |
| `RizhiLB` | 日志列表 | `` | `TableChild` | 日志列表 |
| `FenZhong` | 分钟 | `int` | `NumberText` | 分钟 |
| `Status` | 任务状态 | `varchar(200)` | `Text` | 任务状态 |
| `Week` | 星期 | `varchar(100)` | `Select` | 星期 |
| `ZhiXingZQLB` | 执行周期类别 | `varchar(100)` | `Select` | 执行周期类别 |
| `JobDesc` | 任务名称 | `varchar(200)` | `Text` | 任务名称 |
| `Tian` | 日 | `int` | `NumberText` | 日 |
| `CronExpression` | cron表达式 | `varchar(50)` | `Text` | cron表达式 |
| `DllName` | DLL名称 | `varchar(100)` | `Text` | DLL名称 |
| `JobName` | 任务Key | `varchar(50)` | `Text` | 请输入英文 |
| `JobPath` | 任务路径 | `varchar(200)` | `Text` | 任务路径 |
| `CronDesc` | 执行周期描述 | `varchar(200)` | `Text` | 执行周期描述 |
| `Miao` | 秒 | `int` | `NumberText` | 秒 |

### `diy_schedule_job_log` - 定时任务日志

字段数：2

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `JobName` | 任务名称 | `varchar(50)` | `Text` | 任务名称 |
| `Message` | 日志信息 | `mediumtext` | `Textarea` | 日志信息 |

### `diy_searchengine_name_alias` - 搜索引擎index名称和别名对应关系表

字段数：2

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IndexAlias` | 索引别名 | `varchar(50)` | `Text` | 索引别名 |
| `IndexName` | 索引名称 | `varchar(100)` | `Text` | 索引名称 |

### `diy_sso` - 单点登陆

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IsEnable` | 是否启用 | `bit` | `Switch` | 是否启用 |
| `Remark` | 备注 | `varchar(50)` | `Text` | 备注 |
| `ServerSsoApi` | 后端调用接口 | `varchar(50)` | `Text` | 后端调用接口 |
| `ClientSsoApi` | 前端调用接口 | `varchar(50)` | `Text` | 前端调用接口 |
| `TokenName` | Token名称 | `varchar(50)` | `Text` | Token名称 |
| `GetTokenType` | 获取Token方式 | `varchar(50)` | `Radio` | 获取Token方式 |

### `diy_table` - Diy_Table

字段数：43

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `FormLabelPosition` | 标签对齐方式 | `varchar(255)` | `Radio` | 标签对齐方式 |
| `SubmitFormV8` | 前端表单提交前V8事件 | `mediumtext` | `CodeEditor` | 前端表单提交前V8事件 |
| `FormOpenType` | 表单打开方式 | `varchar(255)` | `Radio` | 表单打开方式 |
| `CacheParentKey` | CacheParentKey | `varchar(255)` | `Text` | CacheParentKey |
| `EnableDataComment` | 启用数据评论 | `int` | `Switch` | 启用数据评论 |
| `IsAnonymousAdd` | 允许匿名新增 | `int` | `Switch` | 允许匿名新增 |
| `EnableCache` | EnableCache | `int` | `Switch` | EnableCache |
| `FormArticle` | FormArticle | `mediumtext` | `Textarea` | FormArticle |
| `TreeLazy` | 树形懒加载 | `int` | `Switch` | 树形懒加载 |
| `DataBaseId` | DataBaseId | `varchar(36)` | `Guid` | DataBaseId |
| `DisplayDefaultField` | 显示默认字段 | `int` | `Switch` | 显示默认字段 |
| `TreeParentField` | 父级列 | `varchar(50)` | `Text` | 树形结构父级字段（一般指ParentId，必填） |
| `EnableDataLog` | 启用数据日志 | `int` | `Switch` | 启用后会在表单信息右侧显示该条数据修改记录 |
| `InFormV8` | 前端表单进入V8事件 | `mediumtext` | `CodeEditor` | 前端表单进入V8事件 |
| `ReportName` | 报表引擎 | `varchar(100)` | `Select` | 报表引擎 |
| `DataEncryptTransfer` | DataEncryptTransfer | `int` | `Switch` | DataEncryptTransfer |
| `TableArticle` | TableArticle | `mediumtext` | `Textarea` | TableArticle |
| `FormOpenWidth` | 弹窗/抽屉宽度 | `varchar(255)` | `Text` | 弹窗/抽屉宽度 |
| `IsTree` | 树形结构 | `int` | `Switch` | 树形结构 |
| `ServerDataV8` | 后端数据处理V8事件 | `mediumtext` | `CodeEditor` | 后端数据处理V8事件 |
| `TreeHasChildren` | 是否有子级列 | `varchar(50)` | `Text` | 判断是否有子级的字段（可选，懒加载用到） |
| `TreeParentFields` | 完整父级列 | `mediumtext` | `Text` | 树形结构完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填） |
| `Name` | 表名 | `varchar(255)` | `Text` | 建议使用【diy_】前缀或自定义统一前缀（方便发布应用商城时与其它库表名不冲突），且全小写，如【diy_product】 |
| `TabsPosition` | 分组标签位置 | `varchar(255)` | `Radio` | 分组标签位置 |
| `TableTabsPosition` | TableTabsPosition | `varchar(255)` | `Text` | TableTabsPosition |
| `BindRole` | 访问权限 | `mediumtext` | `MultipleSelect` | 访问权限 |
| `Tabs` | 表单分组 | `mediumtext` | `JsonTable` | 表单Tabs |
| `DataLogRole` | 数据日志权限 | `mediumtext` | `MultipleSelect` | 数据日志权限 |
| `Description` | 表说明 | `mediumtext` | `Text` | 中文表名描述，如：用户管理、商品管理 |
| `FieldBorder` | FieldBorder | `varchar(255)` | `Text` | FieldBorder |
| `DataSourceId` | DataSourceId | `varchar(36)` | `Guid` | DataSourceId |
| `IsAnonymousRead` | 允许匿名读取 | `int` | `Switch` | 允许匿名读取 |
| `ApiReplace` | 接口替换 | `mediumtext` | `CodeEditor` | 接口替换 |
| `TableTabs` | 表单分组 | `mediumtext` | `JsonTable` | 表格Tabs |
| `DataEncryptSave` | 数据加密存储 | `int` | `Switch` | 数据加密存储 |
| `DataBaseName` | 所属数据库 | `varchar(100)` | `Select` | 不选择则创建到主库，一般都建立在主库 |
| `SubmitAfterServerV8` | 后端表单提交后V8事件 | `mediumtext` | `CodeEditor` | 后端表单提交后V8事件 |
| `InputBorderStyle` | 输入框样式 | `varchar(255)` | `Radio` | 输入框样式 |
| `Column` | 电脑端布局 | `int(11)` | `Radio` | 电脑端布局 |
| `SubmitBeforeServerV8` | 后端表单提交前V8事件 | `mediumtext` | `CodeEditor` | 后端表单提交前V8事件 |
| `ReportId` | 报表引擎Id | `varchar(36)` | `Guid` | 报表引擎Id |
| `OutFormV8` | 前端表单提交后V8事件 | `mediumtext` | `CodeEditor` | 前端表单提交后V8事件 |
| `RowAction` | RowAction | `mediumtext` | `Textarea` | RowAction |

### `diy_tenant` - 租户管理

字段数：1

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `TenantName` | 租户名称 | `varchar(50)` | `Text` | 租户名称 |

### `diy_tips` - 提醒

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `DateTime1` | 日期时间 | `varchar(255)` | `DateTime` | 日期时间 |
| `RichText1` | 富文本 | `mediumtext` | `RichText` | 富文本 |
| `Text1` | 单行文本 | `varchar(255)` | `Text` | 单行文本 |
| `ShifouWC` | 是否完成 | `bit` | `Switch` | 是否完成 |
| `ShifouQY` | 是否启用 | `bit` | `Switch` | 是否启用 |

### `diy_wallpaper` - 壁纸管理

字段数：4

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IsEnable` | 启用 | `int` | `Switch` | 启用 |
| `Category` | 分类 | `varchar(50)` | `Text` | 分类 |
| `ImgUrl` | 图片 | `mediumtext` | `ImgUpload` | 图片 |
| `Name` | 名称 | `varchar(50)` | `Text` | 名称 |

### `eban` - EBAN

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `RKD` | RKD | `VARCHAR2` | `Text` | RKD |
| `SHULIANG` | SHULIANG | `VARCHAR2` | `Text` | SHULIANG |
| `RKDID` | RKDID | `VARCHAR2` | `Text` | RKDID |
| `Text34` | 单行文本 | `varchar(50)` | `Text` | 单行文本 |
| `A` | A | `VARCHAR2` | `Text` | A |

### `mci_mqtt_client` - MQTT客户端

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `MqttLogs` | 通讯日志 | `` | `TableChild` | 通讯日志 |
| `LastConnectTime` | 最后次连接时间 | `varchar(25)` | `DateTime` | 最后次连接时间 |
| `ClientId` | ClientId | `varchar(50)` | `Text` | ClientId |
| `ApiEngineId` | 接口引擎 | `varchar(100)` | `Select` | 接口引擎 |
| `IsOnline` | 是否在线 | `bit` | `Switch` | 是否在线 |

### `mci_mqtt_log` - MQTT记录

字段数：4

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Data` | 数据包 | `mediumtext` | `Textarea` | 数据包 |
| `ClientId` | ClientId | `varchar(36)` | `Guid` | ClientId |
| `Type` | 类型 | `varchar(50)` | `Radio` | 类型 |
| `MqttClientId` | MqttClientId | `varchar(36)` | `Guid` | MqttClientId |

### `mic_3d_engine` - 3D引擎

字段数：0

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|

### `mic_ai` - AI模型管理

字段数：19

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `EmbeddingApiUrl` | EmbeddingApiUrl | `varchar(50)` | `Text` | 示例：http://net.itdos.net:1434/v1/embeddings |
| `QdrantHost` | QdrantHost | `varchar(50)` | `Text` | 示例：net.itdos.net |
| `QdrantPort` | QdrantPort | `varchar(50)` | `Text` | 示例：1333 |
| `QdrantApiKey` | QdrantApiKey | `varchar(50)` | `Text` | 示例：qdrant#pwd |
| `TopTables` | TopTables | `int` | `NumberText` | 使用前N张最相关的表生成Schema（本地Ollama建议1，官网API建议2-3） |
| `VectorTopK` | VectorTopK | `int` | `NumberText` | 向量检索返回多少张候选表（推荐10-20） |
| `VectorScoreThreshold` | VectorScoreThreshold | `decimal(18, 2)` | `NumberText` | 相似度阈值（0-1，越小越宽松，建议0.3-0.5） |
| `AiTimeout` | AiTimeout | `int` | `NumberText` | AI响应超时秒数（本地Ollama建议120，官网API建议30-60） |
| `StreamDelay` | StreamDelay | `int` | `NumberText` | 流式输出每个字符延迟毫秒数（5=很快，10=适中，20=慢） |
| `NL2SQLPrompt` | NL2SQLPrompt | `mediumtext` | `Textarea` | NL2SQLPrompt |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `NL2V8Prompt` | NL2V8Prompt | `mediumtext` | `Textarea` | NL2V8Prompt |
| `AiModelLog` |  | `` | `TableChild` |  |
| `Endpoint` | Endpoint | `varchar(50)` | `Text` | 示例：https://api.deepseek.com/v1 |
| `SystemChatMsg` | 系统聊天信息 | `mediumtext` | `Textarea` | 示例：你是一个乐于助人的助手。 |
| `Name` | 名称 | `varchar(50)` | `Text` | 名称 |
| `IsEnable` | 启用 | `int` | `Switch` | 启用 |
| `AiModel` | 模型 | `varchar(50)` | `Text` | 示例：deepseek-chat |
| `ApiKey` | ApiKey | `varchar(500)` | `Text` | 示例：sk-d1409997ad4d40c1af7bb97660500000 |

### `mic_ai_record` - mic_ai_record

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Content` | Content | `mediumtext` | `Textarea` | Content |
| `FormDataId` | FormDataId | `varchar(36)` | `Guid` | FormDataId |
| `AiModelId` | AiModelId | `varchar(36)` | `Guid` | AiModelId |
| `FieldId` | FieldId | `varchar(36)` | `Guid` | FieldId |
| `AiModel` | AiModel | `varchar(50)` | `Text` | AiModel |

### `mic_data_dashboard` - 数据大屏

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `ProjectName` | 项目名称 | `varchar(50)` | `Text` | 项目名称 |
| `IndexImage` | 缩略图 | `mediumtext` | `ImgUpload` | 缩略图 |
| `State` | 状态 | `varchar(50)` | `Radio` | 状态 |
| `ContentData` | 大屏JSON数据 | `mediumtext` | `CodeEditor` | editCanvasConfig + componentList + requestGlobalConfig |
| `Remarks` | 备注说明 | `mediumtext` | `Textarea` | 备注说明 |

### `mic_data_version` - 数据版本

字段数：10

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Version` | Version | `varchar(50)` | `Text` | Version |
| `UserId` | 创建人Id | `varchar(36)` | `Guid` | 创建人Id |
| `UserName` | 创建人 | `varchar(255)` | `Text` | 创建人 |
| `Id` | Id | `varchar(36)` | `Guid` | Id |
| `Data` | Data | `mediumtext` | `Textarea` | Data |
| `IsDeleted` | 是否已删除 | `int` | `Switch` | 是否已删除 |
| `TableName` | TableName | `varchar(50)` | `Text` | TableName |
| `TableId` | TableId | `varchar(36)` | `Guid` | TableId |
| `UpdateTime` | 修改时间 | `datetime` | `DateTime` | 修改时间 |
| `CreateTime` | 创建时间 | `datetime` | `DateTime` | 创建时间 |

### `mic_day_word` - 每日一言

字段数：2

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Content` | 内容 | `mediumtext` | `Textarea` | 内容 |
| `Author` | 作者 | `varchar(50)` | `Text` | 作者 |

### `mic_email_server` - 邮件配置

字段数：7

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `SmtpServer` | SmtpServer | `varchar(50)` | `Text` | SmtpServer |
| `SystemEmailPwd` | SystemEmailPwd | `varchar(50)` | `Text` | SystemEmailPwd |
| `Key` | Key | `varchar(50)` | `Text` | Key |
| `SystemEmail` | SystemEmail | `varchar(50)` | `Text` | SystemEmail |
| `SmtpPort` | SmtpPort | `int` | `NumberText` | SmtpPort |
| `Mingcheng` | 名称 | `varchar(50)` | `Text` | 名称 |
| `EnableSSL` | EnableSSL | `int` | `Switch` | EnableSSL |

### `mic_memo` - 备忘录

字段数：3

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Content` | 内容 | `mediumtext` | `RichText` | 内容 |
| `Title` | 标题 | `varchar(50)` | `Text` | 标题 |
| `Class` | 分类 | `varchar(50)` | `Text` | 分类 |

### `mic_msg_event_log` - 消息通知事件日志

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IsSuccess` | 是否成功 | `bit` | `Switch` | 是否成功 |
| `MsgContent` | 消息内容 | `mediumtext` | `Textarea` | 消息内容 |
| `Receivers` | 接收人 | `mediumtext` | `Textarea` | 接收人 |
| `MsgEventId` | MsgEventId | `varchar(36)` | `Guid` | MsgEventId |
| `MsgResult` | 消息结果 | `mediumtext` | `Textarea` | 消息结果 |

### `mic_msgset` - 消息通知设置

字段数：10

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Receivers` | 接收人 | `mediumtext` | `MultipleSelect` | 接收人 |
| `Key` | Key | `varchar(50)` | `Text` | Key |
| `TenantId` | TenantId | `varchar(36)` | `Guid` | TenantId |
| `TenantName` | TenantName | `varchar(50)` | `Text` | TenantName |
| `WxTplMsgId` | 模板消息模板 | `varchar(100)` | `Select` | 模板消息模板 |
| `IsEnable` | 是否启用 | `bit` | `Switch` | 是否启用 |
| `Title` | 通知标题 | `varchar(50)` | `Text` | 通知标题 |
| `Type` | 通知方式 | `mediumtext` | `Checkbox` | 通知方式 |
| `TableChild99` |  | `` | `TableChild` |  |
| `ReceiversRoles` | 接收角色 | `mediumtext` | `MultipleSelect` | 接收角色 |

### `mic_page` - 界面引擎

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Title` | 页面名称 | `varchar(50)` | `Text` | 页面名称 |
| `JsonObj` | JSON字符串 | `mediumtext` | `Textarea` | JSON字符串 |
| `RoutePath` | 路由 | `varchar(50)` | `Text` | 在模块引擎菜单编辑中，URl地址demo自定义自己的路由地址，Id参数一定要传本表单的Id |
| `Desc` | 描述 | `mediumtext` | `Textarea` | 描述 |
| `Number` | 编号 | `varchar(50)` | `AutoNumber` | 编号 |
| `ComponentPath` | 组件路径 | `varchar(50)` | `Text` | 在模块引擎菜单编辑中，组件路径用这个路径 |

### `mic_print` - 打印引擎

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `DataApi` | DataApi | `varchar(150)` | `Text` | DataApi |
| `Number` | 编号 | `varchar(25)` | `AutoNumber` | 编号 |
| `PrintObj` | PrintObj | `mediumtext` | `Textarea` | PrintObj |
| `Title` | 页面名称 | `varchar(100)` | `Text` | 页面名称 |
| `PageObj` | Page字符串 | `mediumtext` | `Textarea` | Page字符串 |
| `Desc` | 描述 | `varchar(220)` | `Text` | 描述 |

### `microi_calendar` - 日历

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Content` | 内容 | `mediumtext` | `Textarea` | 内容 |
| `EndTime` | 结束时间 | `varchar(25)` | `DateTime` | 结束时间 |
| `State` | 状态 | `varchar(50)` | `Radio` | 状态 |
| `StartTime` | 开始时间 | `varchar(25)` | `DateTime` | 开始时间 |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `Title` | 标题 | `varchar(50)` | `Text` | 标题 |

### `microi_database` - 数据库管理

字段数：10

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `BtnLoadNotDiyTable` | 加载为DIY表 | `` | `Button` | 加载为DIY表 |
| `IsEnable` | 是否启用 | `int` | `Switch` | 是否启用 |
| `DbName` | 名称 | `varchar(50)` | `Text` | 名称 |
| `DbVersion` | 数据库版本 | `varchar(50)` | `Text` | 目前仅用于区分oracle 12c（默认12c）、11g。 若是oracle 11g一定需要填写11g |
| `DbKey` | DbKey | `varchar(50)` | `Text` | 如DbKey=test1，用于V8.Dbs.test1.FromSql(...) |
| `DbConn` | 连接字符串 | `varchar(255)` | `Textarea` | 连接字符串 |
| `NotDiyTable` | 非DIY表 | `varchar(100)` | `Select` | 非DIY表 |
| `DbType` | 数据库类型 | `varchar(50)` | `Radio` | 数据库类型 |
| `DbReadConn` | 连接字符串（读） | `mediumtext` | `Textarea` | 连接字符串（读） |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |

### `microi_datalog` - 数据日志

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Type` | 操作类型 | `varchar(50)` | `Radio` | 操作类型 |
| `Title` | 标题 | `varchar(50)` | `Text` | 标题 |
| `TableName` | TableName | `varchar(50)` | `Text` | TableName |
| `AccountUserId` | 操作人Id | `varchar(36)` | `Guid` | 操作人Id |
| `Account` | 操作人帐号 | `varchar(50)` | `Text` | 操作人帐号 |
| `DataId` | 被操作数据Id | `varchar(36)` | `Guid` | 被操作数据Id |
| `Avatar` | 操作人头像 | `varchar(255)` | `Text` | 操作人头像 |
| `Content` | 操作内容 | `mediumtext` | `Textarea` | 操作内容 |
| `TableId` | 被操作表Id | `varchar(50)` | `Text` | 被操作表Id |

### `microi_icon` - 图标管理

字段数：3

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IconName` | 名称 | `varchar(50)` | `Text` | 名称 |
| `IsEnable` | 是否启用 | `int` | `Switch` | 是否启用 |
| `Icon` | 图标 | `mediumtext` | `ImgUpload` | 图标 |

### `microi_print_template` - 导出模板

字段数：3

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `TplName` | 模板名称 | `varchar(50)` | `Text` | 模板名称 |
| `TplKey` | 模板Key | `varchar(50)` | `Text` | 模板Key |
| `TplFile` | 模板文件 | `mediumtext` | `FileUpload` | 模板文件 |

### `Rpt_Report` - 报表引擎

字段数：15

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `RptKey` | 报表Key（虚拟表名） | `varchar(50)` | `Text` | 报表Key（虚拟表名） |
| `IsEnable` | 是否启用 | `int` | `Switch` | 是否启用 |
| `Preview` | 预览图 | `mediumtext` | `ImgUpload` | 预览图 |
| `RptName` | 报表名称 | `varchar(50)` | `Text` | 报表名称 |
| `JiazaiXZZD` | 添加选择的字段 | `` | `Button` | 添加选择的字段 |
| `DataSource` | 数据源 | `varchar(100)` | `Select` | 数据源 |
| `RptLoadTableField` | 添加表的所有字段 | `` | `Button` | 添加表的所有字段 |
| `RptSelectFieldList` | 选择字段 | `mediumtext` | `MultipleSelect` | 选择字段 |
| `RptFieldList` | 字段配置 | `` | `TableChild` | 字段配置 |
| `RtpType` | 报表类型 | `varchar(50)` | `Radio` | 报表类型 |
| `DataSourceId` | 数据源Id | `varchar(36)` | `Guid` | 数据源Id |
| `FkTableId` | 关联TableId | `varchar(36)` | `Guid` | 关联TableId |
| `RptSelectTable` | 选择表 | `varchar(100)` | `Select` | 选择表 |
| `DataSourceForm` | 关联表单 | `` | `JoinForm` | 关联表单 |
| `XinzengSJY` | 新增数据源 | `` | `Button` | 新增数据源 |

### `rpt_user_setting` - [系统]个人设置

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `DesktopType` | 桌面模式 | `varchar(50)` | `Radio` | 桌面模式 |
| `Account` | 登陆帐号 | `varchar(255)` | `Text` | 登陆帐号 |
| `OpenTreeMenu` | 是否打开菜单 | `int` | `Switch` | 是否打开菜单 |
| `PageHistory` | 访问历史 | `mediumtext` | `MultipleSelect` | 访问历史 |
| `Lang` | 多语言 | `varchar(50)` | `Radio` | 多语言 |
| `DesktopBg` | 系统背景 | `varchar(200)` | `ImgUpload` | 系统背景 |

### `sys_apiengine` - 接口引擎

字段数：26

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Timeout` | 超时时间 | `int` | `Text` | V8引擎执行超时时间，默认10分钟，单位秒 |
| `MaxStatements` | 最大语句数 | `int` | `NumberText` | 【最大语句数】执行的JavaScript语句数量上限，1亿条语句约等于：10万条数据 × 每条1000条语句的处理逻辑，超出后抛出 StatementsCountOverflowException，最大值2147483647 |
| `LimitMemory` | 内存限制 | `int` | `Text` | 【内存限制】V8引擎可使用的最大内存（2GB），防止恶意代码或内存泄漏导致服务器OOM，超出后抛出 MemoryLimitExceededException，单位MB |
| `LimitRecursion` | 递归深度限制 | `int` | `NumberText` | 【递归深度限制】函数调用栈的最大深度，防止无限递归导致栈溢出，10000层足够大多数场景，超出后抛出 RecursionDepthOverflowException |
| `ApiAddress` | 自定义接口地址 | `varchar(255)` | `Text` | 建议统一使用/apiengine/开头，如：/apiengine/get-product-list |
| `EnableLog` | 开启日志 | `int` | `Switch` | 开启日志 |
| `LockKey` | 分布式锁Key | `varchar(50)` | `Text` | 可填写参数名称，如调用此接口传入了Id='xxxx-xxxx'，那么分布式锁Key可以直接填写Id即可。不填则该接口引擎使用统一的锁，并发性能较低。 |
| `TestResult` | 测试结果 | `mediumtext` | `Textarea` | 测试结果 |
| `Lock` | 分布式锁 | `bit` | `Switch` | 开启分布式锁后，建议设置分布式锁的Key。否则该接口引擎使用统一的锁，并发性能较低。 |
| `ApiRemark` | 接口说明 | `mediumtext` | `Textarea` | 接口说明 |
| `ApiRole` | 可访问角色 | `mediumtext` | `MultipleSelect` | 只有前端调用接口引擎，此配置才有效。后端V8调用接口引擎无视此配置。 |
| `TestBtn` | 开始测试 | `` | `Button` | 开始测试 |
| `Files` | 相关附件 | `mediumtext` | `FileUpload` | 相关附件 |
| `ApiName` | 名称 | `varchar(50)` | `Text` | 名称自定义，如：[移动端]获取商品列表 |
| `Category` | 接口分类 | `varchar(50)` | `Radio` | 接口分类 |
| `ResponseType` | 响应类型 | `varchar(50)` | `Radio` | 默认自动识别返回类型是JSON还是String字符串 |
| `ApiEngineKey` | Key | `varchar(50)` | `Text` | Key自定义，如：get-product-list |
| `StopHttp` | 禁止外部调用 | `int` | `Switch` | 开启后只能通过接口引擎或服务器端V8事件调用此接口（函数），且自定义接口地址失效。 |
| `AiCheckResult` | AI检查结果 | `mediumtext` | `Textarea` | AI检查结果 |
| `TestBtnApiAddress` | 测试自定义接口地址 | `` | `Button` | 测试自定义接口地址 |
| `AiCheckBtn` | AI检查 | `` | `Button` | AI检查 |
| `ApiV8Code` | 接口V8代码 | `mediumtext` | `CodeEditor` | 服务器端V8代码暂不支持await写法 |
| `IsEnable` | 启用 | `bit` | `Switch` | 启用 |
| `ResponseFile` | 响应文件 | `int` | `Switch` | 响应文件 |
| `AllowAnonymous` | 允许匿名调用 | `bit` | `Switch` | 允许匿名调用 |
| `TestParam` | 参数 | `mediumtext` | `Textarea` | 请输入标准的JSON格式参数，如：{ "Id" : "xxxx" }，不支持单引号：{ 'Id' : 'xxxx; } |

### `sys_appinstalled` - 已安装应用

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `AppVersion` | 应用版本 | `varchar(50)` | `Text` | 应用版本 |
| `AppId` | 应用Id | `varchar(50)` | `Text` | 应用Id |
| `AppPacket` | 数据包 | `mediumtext` | `Textarea` | 数据包 |
| `AppGuid` | 应用Guid | `varchar(50)` | `Text` | 应用Guid |
| `InstallTime` | 安装时间 | `varchar(25)` | `DateTime` | 安装时间 |
| `AppName` | 应用名称 | `varchar(50)` | `Text` | 应用名称 |

### `sys_basedata` - sys_basedata

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Key` | Key | `varchar(500)` | `Text` | 建议填写英文、数字。Key一般设定好，不建议后续修改Key。 |
| `Value` | Value | `varchar(500)` | `Text` | 建议填写中文。一般Value设定为后续可随意修改。 |
| `ParentKey` | 父级Key | `varchar(255)` | `Text` | 父级Key |
| `ParentId` | 选择父级 | `varchar(36)` | `SelectTree` | 选择父级 |
| `HasChild` | HasChild | `int` | `Switch` | HasChild |
| `Sort` | Sort | `int` | `NumberText` | Sort |
| `Remark` | Remark | `varchar(500)` | `Text` | Remark |
| `Customer` | Customer | `varchar(50)` | `Text` | Customer |
| `ParentIds` | ParentIds | `mediumtext` | `Textarea` | ParentIds |

### `Sys_Config` - 系统设置

字段数：70

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IsAeroLogin` | 登陆背景虚化 | `int` | `Switch` | 登陆背景虚化 |
| `EnableSystemStyle` | 登录显示界面切换 | `int` | `Switch` | 登录显示界面切换 |
| `PageSizes` | 分页配置 | `varchar(50)` | `Text` | 分页配置 |
| `AMapKey` | AMapKey | `varchar(50)` | `Text` | AMapKey |
| `LoginEndV8Code` | 用户登录成功后V8事件 | `mediumtext` | `CodeEditor` | 用户登录成功后V8事件 |
| `FileServer` | 文件服务器 | `varchar(50)` | `Text` | FileServer |
| `UserName` |  | `varchar(255)` | `` |  |
| `PwdContainNumber` | 包含数字 | `int` | `Switch` | 包含数字 |
| `SysShortTitle` | 系统短标题 | `varchar(50)` | `Text` | 系统短标题 |
| `HDFS` | HDFS | `varchar(50)` | `Radio` | HDFS |
| `SysLogoLink` | Logo超链接 | `varchar(50)` | `Text` | Logo超链接 |
| `IndexCodeApi` | Api首页HTML代码 | `mediumtext` | `CodeEditor` | 此字段功能已迁移至SaaS引擎 |
| `DesktopBgImg` | 桌面默认背景图 | `varchar(255)` | `ImgUpload` | 桌面默认背景图 |
| `AppIndexSlideshow` | 首页轮播图 | `mediumtext` | `ImgUpload` | 首页轮播图 |
| `MacScreenCount` | mac桌面屏幕数量 | `int` | `NumberText` | mac桌面屏幕数量 |
| `PwdAllowErrorCount` | 允许错误次数 | `int` | `NumberText` | 允许错误次数 |
| `GlobalV8Code` | 前端全局V8引擎 | `mediumtext` | `CodeEditor` | 此处定义的函数请全部使用window.FunctionName1=function()来定义 ，只会在系统前端初始化时执行1次。 |
| `PwdV8` | 密码V8加解密 | `mediumtext` | `CodeEditor` | 密码V8加解密 |
| `DefaultIndexUrl` | 默认首页路由 | `varchar(500)` | `Text` | 默认首页路由 |
| `PwdEncode` | 密码存储形式 | `varchar(50)` | `Radio` | 密码存储形式 |
| `MenuWordColor` | 文字颜色 | `varchar(25)` | `ColorPicker` | 文字颜色 |
| `FaviconIco` | FaviconIco | `varchar(255)` | `ImgUpload` | FaviconIco |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `PageBottomTpl` | 页面底部信息 | `mediumtext` | `CodeEditor` | 页面底部信息 |
| `DesktopDockMenu` | 桌面默认任务栏 | `mediumtext` | `Cascader` | 桌面默认任务栏 |
| `PwdContainSpecial` | 包含特殊字符 | `int` | `Switch` | 包含特殊字符 |
| `UEditorConfig` | 富文本配置 | `mediumtext` | `CodeEditor` | 富文本配置 |
| `SysLang` | 默认语言 | `varchar(50)` | `Radio` | 默认语言 |
| `IsEnable` | 是否启用 | `int` | `Switch` | 是否启用 |
| `ClientVersion` | 客户器端版本号 | `varchar(50)` | `Text` | 请勿手动修改，由Microi.Upgrade升级程序自动控制 |
| `ParentId` |  | `varchar(36)` | `` |  |
| `PrintSqlToPage` | 返回sql到前端 | `int` | `Switch` | 返回sql到前端 |
| `EnableCaptcha` | 开启验证码 | `int` | `Switch` | 开启验证码 |
| `PwdAllowMultiLogin` | 允许多处登陆 | `int` | `Switch` | 允许多处登陆 |
| `OnlyOfficeApiBase` | OnlyOfficeApiBase | `varchar(50)` | `Text` | OnlyOfficeApiBase |
| `EnableSwagger` | 开启Swagger | `int` | `Switch` | 开启Swagger |
| `LoginBgImgRandom` | 登陆背景图随机 | `int` | `Switch` | 登陆背景图随机 |
| `ActiveMenuBg` | 选中背景 | `varchar(50)` | `ColorPicker` | 菜单选中、鼠标移动时背景颜色 |
| `SysLogoType` | Logo形式 | `varchar(50)` | `Radio` | Logo形式 |
| `PwdErrorLockTime` | 封锁时间 | `int` | `NumberText` | 封锁时间 |
| `MediaServer` | MediaServer | `varchar(50)` | `Text` | MediaServer |
| `ThemeColor` | 主题色 | `varchar(25)` | `ColorPicker` | 主题色 |
| `EnableUserClickLog` | 记录用户操作日志 | `int` | `Switch` | 记录用户操作日志 |
| `MenuBottomContent` | 模块底部信息 | `mediumtext` | `CodeEditor` | 模块底部信息 |
| `ServerVersion` | 服务器端版本号 | `varchar(50)` | `Text` | 请勿手动修改，由Microi.Upgrade升级程序自动控制 |
| `PwdShortestLength` | 最短密码长度 | `int` | `NumberText` | 最短密码长度 |
| `DesktopBgImgRandom` | 桌面背景图随机 | `int` | `Switch` | 桌面背景图随机 |
| `MenuBg` | 模块背景 | `varchar(50)` | `Radio` | Style1为默认样式（其它界面风格设置无效）。Custom为开启自定义样式（其它界面风格设置有效）。 |
| `CaptchaConfig` | 验证码配置 | `mediumtext` | `CodeEditor` | 验证码配置 |
| `SysLogoHeight` | Logo高度 | `varchar(50)` | `Text` | Logo高度 |
| `MenuBackgroundColor` | 背景颜色 | `varchar(25)` | `ColorPicker` | 背景颜色 |
| `EnableChat` | 微聊系统 | `varchar(25)` | `Radio` | 微聊系统 |
| `AppLoginBgImg` | 登陆背景图 | `mediumtext` | `ImgUpload` | 登陆背景图 |
| `AnonymousDesktop` | 允许匿名进入桌面 | `int` | `Switch` | 允许匿名进入桌面 |
| `AppWorkSlideshow` | 工作台轮播图 | `mediumtext` | `ImgUpload` | 工作台轮播图 |
| `GlobalServerV8Code` | 服务器端全局V8引擎 | `mediumtext` | `CodeEditor` | 此处定义的函数请全部使用function FunctionName1()来定义 ，每次执行后端V8引擎代码时均会再次执行 |
| `ApiBase` | ApiBase | `varchar(50)` | `Text` | ApiBase |
| `CreateTime` |  | `datetime` | `DateTime` |  |
| `MenuBoxShadow` | 菜单阴影 | `varchar(50)` | `Text` | 示例值：2px 0 6px rgb(0 21 41 / 35%) |
| `LoginBottomContent` | 登录框底部信息 | `mediumtext` | `CodeEditor` | 登录框底部信息 |
| `ActiveMenuColor` | 选中文字 | `varchar(50)` | `ColorPicker` | 菜单选中、鼠标移动时文字颜色 |
| `SysTitle` | 系统标题 | `varchar(50)` | `Text` | 系统标题 |
| `SysLogo` | 系统Logo | `mediumtext` | `ImgUpload` | 系统Logo |
| `PeizhiMC` | 配置名称 | `varchar(50)` | `Text` | 配置名称 |
| `CompanyName` | 公司名称 | `varchar(50)` | `Text` | 公司名称 |
| `LoginBgImg` | 登陆背景图 | `varchar(255)` | `ImgUpload` | 登陆背景图 |
| `PwdContainUpperLower` | 包含混合大小写 | `int` | `Switch` | 包含混合大小写 |
| `TopWidthFull` | 顶部宽度铺满 | `int` | `Switch` | 框架顶部宽度铺满 |
| `SysTitleColor` | 系统标题颜色 | `varchar(50)` | `ColorPicker` | 系统标题颜色 |
| `MenuWidth` | 菜单宽度 | `varchar(50)` | `Text` | 示例值：230px |

### `sys_datasource` - 数据源引擎

字段数：12

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `V8DataSource` | V8数据源 | `mediumtext` | `CodeEditor` | V8数据源 |
| `TestParam` | 参数 | `mediumtext` | `Textarea` | 参数 |
| `SqlDataSource` | Sql数据源 | `mediumtext` | `CodeEditor` | Sql数据源 |
| `TestResult` | 测试结果 | `mediumtext` | `Textarea` | 测试结果 |
| `DataSourceType` | 数据源类型 | `varchar(100)` | `Radio` | 数据源类型 |
| `IsEnable` | 是否启用 | `bit` | `Switch` | 是否启用 |
| `DataSourceName` | 名称 | `varchar(50)` | `Text` | 名称 |
| `AllowAnonymous` | 允许匿名调用 | `int` | `Switch` | 允许匿名调用 |
| `TestBtn` | 开始测试 | `` | `Button` | 开始测试 |
| `JsonDataSource` | JSON数据源 | `mediumtext` | `CodeEditor` | JSON数据源 |
| `DataSourceRole` | 可访问角色 | `mediumtext` | `MultipleSelect` | 可访问角色 |
| `DataSourceKey` | 数据源Key | `varchar(50)` | `Text` | 数据源Key |

### `sys_dept` - Sys_Dept

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `TenantName` | TenantName | `varchar(50)` | `Text` | TenantName |
| `Code` | Code | `varchar(255)` | `Text` | Code |
| `TenantId` | TenantId | `varchar(36)` | `Guid` | TenantId |
| `Name` | Name | `varchar(50)` | `Text` | Name |
| `IsCompany` | IsCompany | `bit` | `Switch` | IsCompany |
| `Sort` | Sort | `int(11)` | `NumberText` | Sort |
| `ParentId` | ParentId | `varchar(36)` | `Text` | ParentId |
| `Remark` | Remark | `mediumtext` | `Textarea` | Remark |
| `State` | State | `int(11)` | `NumberText` | State |

### `sys_log` - sys_log

字段数：11

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `IP` | 外网IP | `varchar(255)` | `Text` | 外网IP |
| `AppId` | 应用程序Id | `varchar(255)` | `Text` | 应用程序Id |
| `OtherInfo` | 附加信息 | `mediumtext` | `Textarea` | 附加信息 |
| `Level` | Level | `int(11)` | `NumberText` | Level |
| `Type` | 日志类型 | `varchar(255)` | `Text` | 日志类型 |
| `Api` | 接口地址 | `varchar(1000)` | `Text` | 接口地址 |
| `Param` | 参数 | `mediumtext` | `Textarea` | 参数 |
| `Title` | 标题 | `varchar(255)` | `Text` | 标题 |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `Mac` | Mac | `varchar(255)` | `Text` | Mac |
| `Content` | 日志内容 | `mediumtext` | `Textarea` | 日志内容 |

### `sys_menu` - 模块引擎

字段数：91

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `FixedFields` | 固定列 | `mediumtext` | `MultipleSelect` | 固定列 |
| `SelectApi` | 查询接口替换 | `varchar(255)` | `Text` | 查询接口替换 |
| `AddBtnText` | [新增]文字替换 | `varchar(25)` | `Text` | [新增]文字替换 |
| `SaveBtnText` | [保存]文字替换 | `varchar(25)` | `Text` | [保存]文字替换 |
| `AddBtnType` | [新增]模式 | `varchar(50)` | `Radio` | [新增]模式 |
| `GeneralSeaarch` | 隐藏列表序号 | `int` | `Switch` | 隐藏列表序号 |
| `HiddenIndex` | 隐藏通用搜索 | `int` | `Switch` | 隐藏通用搜索 |
| `SaveType` | [表内编辑]保存方式 | `varchar(50)` | `Radio` | [表内编辑]保存方式 |
| `ImportApi` | 导入接口替换 | `varchar(255)` | `Text` | 导入接口替换 |
| `ImportProgressApi` | 导入进度接口替换 | `varchar(255)` | `Text` | 导入进度接口替换 |
| `ExportApi` | 导出接口替换 | `varchar(255)` | `Text` | 导出接口替换 |
| `TableCardImgPosition` | 卡片预览图位置 | `varchar(50)` | `Radio` | 卡片预览图位置 |
| `DiyTableName` | 关联表单的表名 | `varchar(50)` | `Text` | 关联表单的表名 |
| `CardTitleTagFields` | 卡片标题标签字段 | `mediumtext` | `JsonTable` | 卡片标题标签字段 |
| `CardBottomTagFields` | 卡片底部标签字段 | `mediumtext` | `JsonTable` | 卡片底部标签字段 |
| `FlowDesignId` | 关联流程引擎 | `varchar(100)` | `Select` | 关联流程引擎 |
| `SecondMenuRow` | 二级目录缩略行 | `int` | `NumberText` | 二级目录缩略行 |
| `DetailPageV8` | 详情按钮V8 | `mediumtext` | `CodeEditor` | 详情按钮V8 |
| `IsChildSystem` | 是否子系统 | `int` | `Switch` | 是否子系统 |
| `AddCodeShowV8` | [新增]按钮显示条件 | `mediumtext` | `CodeEditor` | [新增]按钮显示条件 |
| `RoleGroup` | RoleGroup | `mediumtext` | `Text` | RoleGroup |
| `Display` | 是否显示 | `int` | `Switch` | 是否显示 |
| `ModuleEngineKey` | 模块引擎Key | `varchar(50)` | `Text` | 模块引擎Key |
| `InTableEditFields` | 表内可编辑字段 | `mediumtext` | `MultipleSelect` | 表内可编辑字段 |
| `PageTabs` | 页面多Tab | `mediumtext` | `JsonTable` | 页面多Tab |
| `ComponentName` | 界面模板 | `varchar(500)` | `Select` | 界面模板 |
| `MoreBtns` | [行]更多按钮 | `mediumtext` | `JsonTable` | 更多按钮 |
| `EnDescription` | EnDescription | `varchar(500)` | `Text` | EnDescription |
| `FormBtns` | [表单]更多按钮 | `mediumtext` | `JsonTable` | [表单]更多按钮 |
| `DefaultPageSize` | 默认每页数量 | `int` | `NumberText` | 默认每页数量 |
| `Name` | 名称 | `varchar(500)` | `Text` | 名称 |
| `ImportTemplate` | 导入模板 | `varchar(255)` | `FileUpload` | 导入模板 |
| `StoreId` | StoreId | `varchar(36)` | `Text` | StoreId |
| `BatchSelectMoreBtns` | [批量选择]更多按钮 | `mediumtext` | `JsonTable` | [批量选择]更多按钮 |
| `SqlJoin` | Join关联 | `mediumtext` | `CodeEditor` | 示例：INNER JOIN Sys_User B ON A.UserId = B.Id<br>示例：INNER JOIN Diy_Customer B ON A.KehuXXID = B.Id AND B.GuanlianZH like '%$CurrentUser.Id$%'<br>注意：默认选择的DIY表已经占用了表别名A。<br>可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$Curr… |
| `TableCardImgField` | 卡片图片字段 | `varchar(50)` | `Text` | 卡片图片字段 |
| `ParentIds` | ParentIds | `mediumtext` | `Text` | ParentIds |
| `Link` | Link | `varchar(500)` | `Text` | Link |
| `SelectFields` | 查询列 | `mediumtext` | `JsonTable` | 指定select哪些列，不指定则是select * |
| `SortFieldIds` | 可排序字段 | `mediumtext` | `MultipleSelect` | 可排序字段 |
| `DelCodeShowV8` | [删除]按钮显示条件 | `mediumtext` | `CodeEditor` | [删除]按钮显示条件 |
| `DiyConfig` | 模块配置 | `mediumtext` | `CodeEditor` | 模块配置 |
| `Url` | Url地址 | `varchar(500)` | `Text` | Url地址 |
| `IconClass` | 图标 | `varchar(500)` | `FontAwesome` | 图标 |
| `EditCodeShowV8` | [编辑]按钮显示条件 | `mediumtext` | `CodeEditor` | [编辑]按钮显示条件 |
| `ExportMoreBtns` | [导出]更多按钮 | `mediumtext` | `JsonTable` | [导出]更多按钮 |
| `DisplayMac` | 显示[mac] | `int` | `Switch` | 显示[mac] |
| `TableCardImgStyle` | 卡片图片样式 | `varchar(500)` | `Text` | 卡片图片样式 |
| `Description` | 菜单描述 | `varchar(500)` | `Text` | 菜单描述 |
| `ComponentPath` | 组件路径 | `varchar(500)` | `Text` | 无需以'/views'开头，因为SysMenu的界面模板[ComponentPath]一定是在'/viws'里面 |
| `IconComponent` | 图标组件 | `varchar(50)` | `Text` | 图标组件 |
| `SearchFieldIds` | 可搜索的字段 | `mediumtext` | `JsonTable` | 可搜索的字段 |
| `SizeWidthMac` | 图标宽（mac） | `varchar(50)` | `Radio` | 图标宽（mac） |
| `Class` | 就是Customer | `varchar(500)` | `Text` | 就是Customer |
| `MobileListFields` | 移动端/卡片显示列 | `mediumtext` | `JsonTable` | 移动端/卡片显示列 |
| `InTableEdit` | 开启表内编辑 | `int` | `Switch` | 表内编辑 |
| `SecondMenuColumn` | 二级目录缩略列 | `int` | `NumberText` | 二级目录缩略列 |
| `Sort` | 排序 | `int(11)` | `NumberText` | 排序 |
| `DefaultOrderBy` | 默认排序字段 | `varchar(255)` | `JsonTable` | 默认排序字段 |
| `ExportV8` | ExportV8 | `mediumtext` | `Textarea` | ExportV8 |
| `ReportId` | ReportId | `varchar(36)` | `Guid` | ReportId |
| `TableCardCol` | 卡片每行几列 | `int` | `NumberText` | 卡片每行几列 |
| `HasChild` | 是否有子集 | `int` | `Switch` | 是否有子集 |
| `ReportName` | 选择报表 | `varchar(100)` | `Select` | 选择报表 |
| `DisplayWin` | 显示[win] | `int` | `Switch` | 显示[win] |
| `JquerySelector` | JquerySelector | `varchar(500)` | `Text` | JquerySelector |
| `SecondMenuLineCount` | 二级目录每行几个 | `int` | `NumberText` | 二级目录每行几个 |
| `ParentId` | 上级 | `varchar(50)` | `SelectTree` | 上级 |
| `TableHeaders` | 多级表头数据 | `mediumtext` | `Textarea` | 多级表头数据 |
| `Code` | Code | `varchar(500)` | `Text` | Code |
| `MultRun` | MultRun | `int` | `Switch` | MultRun |
| `EnName` | EnName | `varchar(500)` | `Text` | EnName |
| `ImportTemplateName` | 导入模板名称 | `varchar(255)` | `Text` | 导入模板名称 |
| `IsMicroiService` | 微服务 | `int` | `Switch` | 微服务 |
| `StatisticsFields` | 统计列 | `mediumtext` | `JsonTable` | 统计列 |
| `SqlWhere` | Where条件 | `mediumtext` | `CodeEditor` | 示例[每个人只能查看自己的数据，或者上级可以查看同部门下级的数据]：<br>(A.UserId = '$CurrentUser.Id$' OR (B.Level > $CurrentUser.Level$ AND B.DeptCode LIKE '$CurrentUser.DeptCode$%'))<br>注意：默认选择的DIY表已经占用了表别名A。<br>可使用的变量名：$CurrentUser.Id$、$CurrentUser.L… |
| `NotShowFields` | 不显示列 | `mediumtext` | `MultipleSelect` | 不显示列 |
| `DiyTableId` | 选择表单 | `varchar(36)` | `Select` | 选择表单 |
| `SecondMenuWidth` | 二级目录宽度 | `varchar(50)` | `Text` | 二级目录宽度 |
| `PageBtns` | [页面]更多按钮 | `mediumtext` | `JsonTable` | [页面]更多按钮 |
| `UrlApiEngineId` | Url地址接口引擎 | `varchar(50)` | `Text` | 一般用于当打开方式为iframe时，SSO单点登录传入动态token |
| `PageTemplate` | 界面模板 | `varchar(255)` | `Text` | 界面模板 |
| `TableDiyFieldIds` | 查询列[废弃] | `mediumtext` | `Textarea` | 此字段已废弃 |
| `JoinTables` | 关联表 | `mediumtext` | `JsonTable` | 关联表 |
| `MacScreenIndex` | 所属mac第几屏幕 | `int` | `NumberText` | 所属mac第几屏幕 |
| `Icon` | 菜单图片 | `varchar(500)` | `ImgUpload` | 菜单图片 |
| `SizeHeightMac` | 图标高（mac） | `varchar(50)` | `Radio` | 图标高（mac） |
| `ImportV8` | ImportV8 | `mediumtext` | `Textarea` | ImportV8 |
| `SecondMenuHeight` | 二级目录高度 | `varchar(50)` | `Text` | 二级目录高度 |
| `AppDisplay` | 移动端是否显示 | `int` | `Switch` | 移动端是否显示 |
| `OpenType` | 打开方式 | `varchar(500)` | `Select` | 打开方式 |

### `sys_microiservice` - 微服务

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `MsKey` | 微服务Key | `varchar(50)` | `Text` | 微服务Key |
| `MsDevUrl` | Dev地址 | `varchar(50)` | `Text` | Dev地址 |
| `MsUrl` | 微服务地址 | `varchar(50)` | `Text` | 微服务地址 |
| `MsType` | 微服务类型 | `varchar(50)` | `Radio` | 微服务类型 |
| `MsName` | 微服务名称 | `varchar(50)` | `Text` | 微服务名称 |
| `IsEnable` | 是否启用 | `bit` | `Switch` | 是否启用 |

### `sys_microistore` - 应用商城

字段数：21

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `SelectMenu` | 选择模块 | `mediumtext` | `SelectTree` | 选择模块 |
| `SelectWF` | 选择流程 | `mediumtext` | `MultipleSelect` | 选择流程 |
| `SelectApiEngine` | 选择接口引擎 | `mediumtext` | `MultipleSelect` | 选择接口引擎 |
| `BtnMakeApp` | 开始制作 | `` | `Button` | 开始制作 |
| `AppPreview` | 预览图 | `mediumtext` | `ImgUpload` | 预览图 |
| `SelectTable` | 选择表单 | `mediumtext` | `MultipleSelect` | 选择表单 |
| `AppDetail` | 应用介绍 | `mediumtext` | `RichText` | 应用介绍 |
| `AppPublishTime` | 发布时间 | `varchar(25)` | `DateTime` | 发布时间 |
| `AppPrice` | 价格 | `int` | `NumberText` | 价格 |
| `AppVersion` | 版本号 | `varchar(50)` | `Text` | 版本号 |
| `AppAuthorAvatar` | 作者头像 | `mediumtext` | `ImgUpload` | 作者头像 |
| `AppOriPrice` | 原价 | `int` | `NumberText` | 原价 |
| `AppAuthor` | 作者 | `varchar(50)` | `Text` | 作者 |
| `IsApprove` | 审核通过 | `bit` | `Switch` | 审核通过 |
| `AppPakcet` | 数据包 | `mediumtext` | `Textarea` | 数据包 |
| `ClientMinVersion` | 前端最低版本 | `varchar(50)` | `Text` | 前端最低版本 |
| `AppId` | 应用Id | `varchar(50)` | `Text` | 应用Id |
| `ServerMinVersion` | 后端最低版本 | `varchar(50)` | `Text` | 后端最低版本 |
| `AppName` | 应用名称 | `varchar(50)` | `Text` | 应用名称 |
| `AppUpdateTime` | 更新时间 | `varchar(25)` | `DateTime` | 更新时间 |
| `AppRate` | 评分 | `decimal(18,1)` | `Rate` | 评分 |

### `sys_microistoreversion` - 应用商城应用版本

字段数：1

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Text58` | 单行文本 | `varchar(50)` | `Text` | 单行文本 |

### `sys_microiuptlog` - 框架更新日志

字段数：7

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `UpdateDate` | 更新时间 | `varchar(25)` | `DateTime` | 更新时间 |
| `TableName` | 表名 | `varchar(50)` | `Text` | 表名 |
| `IsImportant` | 重要更新 | `bit` | `Switch` | 重要更新 |
| `QingkongSJ` | 清空数据 | `` | `Button` | 清空数据 |
| `Version` | 版本号 | `varchar(50)` | `Text` | 版本号 |
| `DiyUpdate` | 执行更新 | `bit` | `Switch` | 执行更新 |
| `Content` | 更新内容 | `mediumtext` | `RichText` | 更新内容 |

### `sys_osclients` - OsClients

字段数：92

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `MqttEnable` | 启用MQTT | `int` | `Switch` | 注意只有主库对应的SaaS引擎这一条数据MQTT配置的【MQTT端口】才有效果，其它租户SaaS引擎中的MQTT配置中【启用MQTT、用户名、密码、接口引擎】有效。 |
| `MqttApiEngine` | 接口引擎 | `varchar(100)` | `Select` | 服务器端启动时、客户端连接时/发送消息时/断开连接时均触发。EventName：StartServer、Connected、Disconnected、MessageReceived、StopServer |
| `MqttPort` | MQTT端口 | `int` | `NumberText` | 默认1883，注意api的编排ports参数必须添加对应的如- "1883:1883"。<br>注意只有主库对应的SaaS引擎这一条数据MQTT配置的【MQTT端口】才有效果，其它租户SaaS引擎中的MQTT配置中【启用MQTT、用户名、密码、接口引擎】有效。 |
| `MqttAccount` | 用户名 | `varchar(50)` | `Text` | 用户名 |
| `MqttPwd` | 密码 | `varchar(50)` | `Text` | 密码 |
| `MqttWsPort` | WS端口 | `int` | `NumberText` | 默认1884 |
| `DbReadType` | 数据库版本（读） | `varchar(50)` | `Radio` | 为空则取DbType |
| `IndexCodeAuth` | Auth身份认证系统首页html代码 | `mediumtext` | `CodeEditor` | 此字段已废弃！ |
| `WeChatBaseUrl` | WeChatBaseUrl | `varchar(100)` | `Text` | 微信地址 |
| `MQPort` | MQPort | `varchar(50)` | `Text` | MQPort |
| `MQHost` | MQHost | `varchar(200)` | `Text` | MQHost |
| `SentinelServiceName` | 哨兵服务名称 | `varchar(50)` | `Text` | 哨兵服务名称 |
| `MinIOPrivateBucketName` | MinIO私有桶名 | `varchar(50)` | `Text` | MinIO私有桶名 |
| `RedisPort` | RedisPort | `varchar(50)` | `Text` | RedisPort |
| `AliOssImgProcess` | 阿里云图片压缩规则 | `varchar(500)` | `Text` | 阿里云图片压缩规则 |
| `NetworkIsInternet` | Endpoint是否走公网 | `int` | `Switch` | Endpoint是否走公网 |
| `CloudFrontPublicPemId` | CloudFrontPublicPemId | `varchar(50)` | `Text` | 亚马逊S3配置 |
| `AccessTokenLifetime` | Token过期时间（移动端） | `varchar(50)` | `Text` | 单位天，默认30天 |
| `MinIOPrivateEndPointSSL` | 内网EndPoint启用SSL | `int` | `Switch` | 内网EndPoint启用SSL |
| `AlidnsKeyId` | AlidnsKeyId | `varchar(50)` | `Text` | AlidnsKeyId |
| `UseAliOssPrivate` | 启用阿里云私有桶 | `varchar(50)` | `Text` | 填写1或0 |
| `AliSmsAccessKeySecret` | 阿里云短信Secret | `varchar(50)` | `Text` | 阿里云短信Secret |
| `RedisPwd` | RedisPwd | `varchar(50)` | `Text` | RedisPwd |
| `OsClientNetwork` | OsClientNetwork | `varchar(50)` | `Text` | SaaS引擎网络环境，自定义值，示例：Internal（内网））、Internet（公网）） |
| `MinIORegion` | MinIORegion | `varchar(50)` | `Text` | 适用于Amazon S3，当MinIOEndPoint为加速地址时，需要填写，格式例子：ap-southeast-1 |
| `AuthSecret` | JWT加密Key | `varchar(50)` | `Text` | 用于JwtSecurityKey，一般32位，不足32位系统会补齐32位，超过32位系统会截取前32位。不同SaaS租户建议设置不同的值，以防止token串鉴权成功。 |
| `MinIOPublicBucketName` | MinIO公有桶名 | `varchar(50)` | `Text` | MinIO公有桶名 |
| `AuthServerV2` | AuthServerV2 | `varchar(50)` | `Text` | 废弃字段 |
| `DbOracleTableSpace` | DbOracleTableSpace | `varchar(50)` | `Text` | 废弃字段 |
| `AliOssPrivateDomain` | 阿里云私有桶域名 | `varchar(500)` | `Text` | 阿里云私有桶域名 |
| `SentinelPort` | 哨兵节点Port | `varchar(50)` | `Text` | 哨兵节点Port |
| `TranslateEndpoint` | TranslateEndpoint | `varchar(50)` | `Text` | TranslateEndpoint |
| `ParentId` |  | `varchar(36)` | `` |  |
| `AliOssPrivateAccessKeySecret` | 阿里云私有桶Secret | `varchar(50)` | `Text` | 阿里云私有桶Secret |
| `AliOssPublicAccessKeyId` | 阿里云公有桶Key | `varchar(50)` | `Text` | 阿里云公有桶Key |
| `DbMongoConnection` | MongoDB连接字符串 | `varchar(500)` | `Text` | MongoDB连接字符串 |
| `NoSqlType` | NoSqlType | `varchar(50)` | `Text` | NoSqlType |
| `OsClientType` | OsClientType | `varchar(50)` | `Text` | SaaS引擎软件环境，自定义值，示例：Product（正式环境））、Dev（测试环境）、WZ（外帐） |
| `TencentAppId` | TencentAppId | `varchar(50)` | `Text` | TencentAppId |
| `DbVersion` | 数据库版本 | `varchar(50)` | `Text` | 如：12c、11g |
| `OsClient` | OsClient | `varchar(50)` | `Text` | SaaS引擎Key，自定义值，建议全小写字母。示例：microi、itdos、xjy123 |
| `AliOssPrivateAccessKeyId` | 阿里云私有桶Key | `varchar(50)` | `Text` | 阿里云私有桶Key |
| `ClientSecrets` | Token密钥 | `varchar(50)` | `Text` | 废弃字段 |
| `MQVitrualHost` | VitrualHost | `varchar(50)` | `Text` | VitrualHost |
| `DbReadConn` | 数据库连接字符串（读） | `varchar(500)` | `Text` | 为空则取DbConn |
| `CorsAllowOrigins` | 跨域配置 | `mediumtext` | `Textarea` | 需要在主库中配置所有saas库可能用到的前端访问域名，支持通配符，修改此配置后需要重启api的docker容器。示例值：http://localhost:2009;https://os.itdos.com;https://*.microi.net |
| `SessionAuthTimeout` | Token过期时间（PC） | `varchar(50)` | `Text` | 单位：分钟，默认20分钟 |
| `MQUserName` | 用户名 | `varchar(50)` | `Text` | 用户名 |
| `DomainName` | 域名 | `mediumtext` | `Text` | 多个域名使用英文分号分割，移动端建议使用m-开头。 |
| `SentinelPwd` | 哨兵认证密码 | `varchar(50)` | `Text` | 哨兵认证密码 |
| `TencentSecretId` | TencentSecretId | `varchar(50)` | `Text` | TencentSecretId |
| `CloudFrontPrivateCDN` | CloudFrontPrivateCDN | `varchar(50)` | `Text` | 亚马逊S3配置 |
| `UseAliOssImgProcess` | 启用阿里云图片压缩 | `varchar(50)` | `Text` | 填写1或0，若填写0不启用，则使用系统自带的图片压缩算法 |
| `RedisDataBase` | RedisDataBase | `varchar(50)` | `Text` | RedisDataBase |
| `TranslateSecret` | TranslateSecret | `varchar(50)` | `Text` | TranslateSecret |
| `AliOssPrivateEndpoint` | 阿里云私有桶Endpoint | `varchar(50)` | `Text` | 阿里云私有桶Endpoint |
| `AliOssPublicAccessKeySecret` | 阿里云公有桶Secret | `varchar(50)` | `Text` | 阿里云公有桶Secret |
| `UseAliOssPublic` | 启用阿里云公有桶 | `varchar(50)` | `Text` | 填写1或1 |
| `AliOssPublicBucketName` | 阿里云公有桶名 | `varchar(50)` | `Text` | 阿里云公有桶名 |
| `ClientName` | 名称 | `varchar(50)` | `Text` | 名称 |
| `MQPassword` | 密码 | `varchar(50)` | `Text` | 密码 |
| `AuthServer` | AuthServer | `varchar(50)` | `Text` | 废弃字段 |
| `TranslateKey` | TranslateKey | `varchar(50)` | `Text` | TranslateKey |
| `ServerTag` | ServerTag | `varchar(50)` | `Text` | 服务器headers标记 |
| `MQType` | 集群类型 | `varchar(50)` | `Select` | 集群类型 |
| `IndexCodeApi` | Api接口系统首页html代码 | `mediumtext` | `CodeEditor` | 留空则默认平台首页。示例：<html><body>ApiBase</body></html> |
| `MinIOSecretKey` | MinIO Secret | `varchar(50)` | `Text` | 也可以是minio密码 |
| `WeChatAppId` | WeChatAppId | `varchar(50)` | `Text` | WeChatAppId |
| `AliOssPublicDomain` | 阿里云公有桶域名 | `varchar(50)` | `Text` | 阿里云公有桶域名 |
| `MinIOEndPointSSL` | 公网EndPoint启用SSL | `int` | `Switch` | 公网EndPoint启用SSL |
| `AliOssPrivateBucketName` | 阿里云私有桶名 | `varchar(50)` | `Text` | 阿里云私有桶名 |
| `TencentSecretKey` | TencentSecretKey | `varchar(50)` | `Text` | TencentSecretKey |
| `FileNameGuid` | 上传文件Guid命名 | `int` | `Switch` | 上传文件Guid命名 |
| `DbConn` | 数据库连接字符串 | `varchar(500)` | `Text` | 数据库连接字符串 |
| `IsEnable` | 启用 | `bit` | `Switch` | 启用 |
| `AliSmsAccessKeyId` | 阿里云短信Key | `varchar(50)` | `Text` | 阿里云短信Key |
| `SearchEnginePort` | Port | `varchar(50)` | `Text` | Port |
| `AliOssPublicEndpoint` | 阿里云公有桶Endpoint | `varchar(50)` | `Text` | 阿里云公有桶Endpoint |
| `AlidnsKeySecret` | AlidnsKeySecret | `varchar(50)` | `Text` | AlidnsKeySecret |
| `MinIOAccessKey` | MinIO Key | `varchar(50)` | `Text` | 也可以是minio帐号 |
| `WeChatAppSecret` | WeChatAppSecret | `varchar(50)` | `Text` | WeChatAppSecret |
| `RedisHost` | RedisHost | `varchar(50)` | `Text` | RedisHost |
| `SearchEngineHost` | Host | `varchar(100)` | `Text` | Host |
| `DbType` | 数据库类型 | `varchar(50)` | `Radio` | 默认MySql |
| `CloudFrontPrivatePemXml` | CloudFrontPrivatePemXml | `mediumtext` | `Textarea` | 亚马逊S3配置 |
| `MinIOEndPoint` | 内网EndPoint | `varchar(50)` | `Text` | 示例：192.168.31.131:1020 |
| `CacheConnectionType` | 连接类型 | `varchar(100)` | `Select` | 连接类型 |
| `MinIOEndPointInternet` | 公网EndPoint | `varchar(50)` | `Text` | 示例：os.microios.com:1120。若没有公网endpoint，请填写内网endpoint。 |
| `HDFS` | 分布式存储 | `varchar(50)` | `Radio` | 分布式存储 |
| `SentinelHost` | 哨兵节点Host | `varchar(100)` | `Text` | 哨兵节点Host |
| `MQListenerTime` | 监听时长 | `varchar(50)` | `Text` | 监听时长 |
| `RedisTimeout` | RedisTimeout | `varchar(50)` | `Text` | RedisTimeout |

### `sys_role` - Sys_Role

字段数：9

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `DeptIds` | DeptIds | `mediumtext` | `Textarea` | DeptIds |
| `BaseLimit` | BaseLimit | `varchar(500)` | `Text` | BaseLimit |
| `Remark` | Remark | `mediumtext` | `Textarea` | Remark |
| `TenantName` | TenantName | `varchar(50)` | `Text` | TenantName |
| `Name` | Name | `varchar(500)` | `Text` | Name |
| `Class` | 就是Customer | `varchar(500)` | `Text` | 就是Customer |
| `Sort` | Sort | `int(11)` | `NumberText` | Sort |
| `TenantId` | TenantId | `varchar(36)` | `Guid` | TenantId |
| `Level` | Level | `int(255)` | `NumberText` | Level |

### `sys_rolelimit` - sys_rolelimit

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `FkId` | FkId | `varchar(36)` | `Text` | FkId |
| `Type` | Type | `varchar(50)` | `Text` | Type |
| `RoleId` | RoleId | `varchar(36)` | `Text` | RoleId |
| `Customer` | Customer | `varchar(50)` | `Text` | Customer |
| `Permission` | Permission | `mediumtext` | `Textarea` | Permission |

### `sys_servernode` - 服务器节点管理

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `ServerName` | 服务器名称 | `varchar(50)` | `Text` | 服务器名称 |
| `IsEnable` | 是否启用 | `int` | `Switch` | 是否启用 |
| `ServerInternetIP` | 服务器公网IP | `varchar(50)` | `Text` | 服务器公网IP |
| `ServerPort` | 服务器端口 | `int` | `NumberText` | 服务器端口 |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `ServerIP` | 服务器内网IP | `varchar(50)` | `Text` | 服务器内网IP |

### `sys_user` - 员工信息

字段数：37

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `LicenseType` | LicenseType | `varchar(50)` | `Radio` | LicenseType |
| `LastLoginIP` | 最后登录IP地址 | `varchar(50)` | `Text` | 最后登录IP地址 |
| `LastLoginTime` | 最后登录时间 | `varchar(25)` | `DateTime` | 最后登录时间 |
| `Sex` | 性别 | `varchar(50)` | `Radio` | 性别 |
| `FeishuUnionId` | 飞书UnionId | `varchar(50)` | `Text` | 飞书UnionId |
| `UserType` | 帐号类型 | `varchar(50)` | `Radio` | 帐号类型 |
| `DesktopType` | 桌面模式 | `varchar(50)` | `Radio` | 桌面模式 |
| `Avatar` | 头像 | `varchar(255)` | `Text` | 头像 |
| `RandomDesktopBg` | 随机壁纸 | `int` | `Switch` | 随机壁纸 |
| `DeptIds` | 兼职组织机构 | `mediumtext` | `Department` | 包含所有所属机构Id |
| `Email` | 邮箱 | `varchar(255)` | `Text` | 邮箱 |
| `WxNickName` | 微信昵称 | `varchar(50)` | `Text` | 微信昵称 |
| `Name` | 姓名 | `varchar(255)` | `Text` | 姓名 |
| `PageHistory` | 访问历史 | `mediumtext` | `Cascader` | 访问历史 |
| `TenantId` | TenantId | `varchar(36)` | `Text` | TenantId |
| `TenantName` | 所属租户 | `varchar(255)` | `Select` | 所属租户 |
| `Phone` | 手机号 | `varchar(255)` | `Text` | 手机号 |
| `WxMpId` | 绑定公众号 | `varchar(50)` | `Select` | 绑定公众号 |
| `OpenTreeMenu` | 是否打开菜单 | `int` | `Switch` | 是否打开菜单 |
| `Account` | 登陆帐号 | `varchar(255)` | `Text` | 登陆帐号 |
| `DesktopBg` | 系统背景 | `varchar(200)` | `ImgUpload` | 系统背景 |
| `No` | 编号 | `varchar(50)` | `AutoNumber` | 编号 |
| `ParentId` |  | `varchar(36)` | `` |  |
| `DeptId` | 所属组织机构 | `varchar(36)` | `Department` | 所属机构的最后一个Id |
| `Remark` | 备注 | `varchar(255)` | `Textarea` | 备注 |
| `RoleIds` | 角色 | `mediumtext` | `MultipleSelect` | 角色 |
| `Pwd` | 密码 | `varchar(255)` | `Text` | 密码 |
| `WxOpenId` | 微信公众号OpenId | `varchar(50)` | `Text` | 微信公众号OpenId |
| `DesktopDockMenu` | 桌面任务栏 | `mediumtext` | `Cascader` | 桌面任务栏 |
| `MiniProgramOpenId` | 小程序OpenId | `varchar(100)` | `Text` | 小程序OpenId |
| `Level` | 级别 | `int(11)` | `NumberText` | 值越大，权限越大，根据角色自动设置 |
| `DeptName` | 部门名称 | `varchar(255)` | `Text` | 部门名称 |
| `State` | 状态 | `int(11)` | `Radio` | 状态 |
| `Lang` | 多语言 | `varchar(50)` | `Radio` | 多语言 |
| `WxAvatar` | 微信头像 | `varchar(255)` | `Text` | 微信头像 |
| `PwdEncode` | 密码存储形式 | `varchar(50)` | `Radio` | 密码存储形式 |
| `DeptCode` | 所属组织机构Code | `varchar(255)` | `Text` | 所属组织机构Code |

### `wf_flow` - 流程实例

字段数：15

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `TableRowId` | TableRowId | `varchar(36)` | `Guid` | TableRowId |
| `FlowDesignId` | 流程图Id | `varchar(36)` | `Guid` | 流程图Id |
| `NotHandlerUsers` | NotHandlerUsers | `mediumtext` | `Textarea` | 收到过待办但未处理过的人 |
| `TableId` | TableId | `varchar(36)` | `Guid` | TableId |
| `NoticeFields` | NoticeFields | `mediumtext` | `Textarea` | NoticeFields |
| `CopyUsers` | CopyUsers | `mediumtext` | `Textarea` | 抄送过的人 |
| `FlowNo` | FlowNo | `varchar(25)` | `AutoNumber` | FlowNo |
| `FlowTitle` | 流程标题 | `varchar(50)` | `Text` | 流程标题 |
| `Sender` | 流程发起人 | `varchar(50)` | `Text` | 流程发起人 |
| `StartNodeName` | StartNodeName | `varchar(50)` | `Text` | StartNodeName |
| `FlowState` | FlowState | `varchar(50)` | `Text` | FlowState |
| `FormData` | FormData | `mediumtext` | `Textarea` | 保持最新，每个节点处理后都会更新此字段。 |
| `StartNodeId` | StartNodeId | `varchar(36)` | `Guid` | StartNodeId |
| `HandlerUsers` | HandlerUsers | `mediumtext` | `Textarea` | 处理过工作的人，包括同意、不同意、撤回、发起工作 |
| `SenderId` | 流程发起人Id | `varchar(36)` | `Guid` | 流程发起人Id |

### `wf_flowdesign` - 工作流设计

字段数：12

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Category` | 分类 | `varchar(100)` | `Select` | 分类 |
| `FlowName` | 流程名称 | `varchar(50)` | `Text` | 流程名称 |
| `StartV8` | 开始时V8 | `mediumtext` | `Textarea` | 开始时V8 |
| `Roles` | 绑定角色 | `mediumtext` | `MultipleSelect` | 绑定角色 |
| `Description` | 描述 | `mediumtext` | `Textarea` | 描述 |
| `Preview` | 预览图 | `mediumtext` | `ImgUpload` | 预览图 |
| `Sort` | 排序 | `int` | `NumberText` | 排序 |
| `JsonData` | 流程图Json | `mediumtext` | `Textarea` | 流程图Json |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `EndV8` | 结束时V8 | `mediumtext` | `Textarea` | 结束时V8 |
| `TableId` | 关联表单 | `varchar(100)` | `Select` | 关联表单 |
| `IsEnable` | 是否启用 | `int` | `Switch` | 是否启用 |

### `wf_history` - 流程轨迹/历史/记录

字段数：23

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `ToNodes` | ToNodes | `mediumtext` | `Textarea` | ToNodes |
| `NoticeFields` | NoticeFields | `mediumtext` | `Textarea` | NoticeFields |
| `TableRowId` | TableRowId | `varchar(36)` | `Guid` | TableRowId |
| `FlowId` | FlowId | `varchar(36)` | `Guid` | FlowId |
| `ToNodeName` | ToNodeName | `varchar(50)` | `Text` | ToNodeName |
| `FlowDesignId` | FlowDesignId | `varchar(36)` | `Guid` | FlowDesignId |
| `Sender` | Sender | `varchar(50)` | `Text` | Sender |
| `FromNodeId` | FromNodeId | `varchar(36)` | `Guid` | FromNodeId |
| `CopyUsers` | CopyUsers | `mediumtext` | `Textarea` | CopyUsers |
| `FlowName` | FlowName | `varchar(50)` | `Guid` | FlowName |
| `Receivers` | Receivers | `mediumtext` | `Text` | Receivers |
| `FlowTitle` | FlowTitle | `varchar(50)` | `Text` | FlowTitle |
| `FlowNo` | FlowNo | `varchar(50)` | `Text` | FlowNo |
| `ApprovalType` | ApprovalType | `varchar(50)` | `Text` | ApprovalType |
| `FromNodeName` | FromNodeName | `varchar(50)` | `Text` | FromNodeName |
| `LineId` | LineId | `varchar(36)` | `Guid` | LineId |
| `ApprovalIdea` | ApprovalIdea | `mediumtext` | `Textarea` | ApprovalIdea |
| `SenderId` | SenderId | `varchar(36)` | `Guid` | SenderId |
| `ToNodeId` | ToNodeId | `varchar(36)` | `Guid` | ToNodeId |
| `WorkId` | WorkId | `varchar(50)` | `Text` | WorkId |
| `TableId` | TableId | `varchar(36)` | `Guid` | TableId |
| `FormData` | FormData | `mediumtext` | `Textarea` | FormData |
| `LineValue` | LineValue | `varchar(50)` | `Text` | LineValue |

### `wf_line` - 工作流程条件引擎线属性

字段数：6

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `ToNodeId` | 结束节点 | `varchar(36)` | `Guid` | 结束节点 |
| `FlowDesignId` | 流程图Id | `varchar(36)` | `Guid` | 流程图Id |
| `FromNodeId` | 开始节点 | `varchar(36)` | `Guid` | 开始节点 |
| `V8Code` | V8代码 | `mediumtext` | `Textarea` | V8代码 |
| `LineName` | 条件名称 | `varchar(50)` | `Text` | 条件名称 |
| `LineValue` | 条件值 | `varchar(50)` | `Text` | 条件值 |

### `wf_node` - 流程引擎节点属性

字段数：28

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `EndV8` | 结束V8 | `mediumtext` | `CodeEditor` | 结束V8 |
| `NodeName` | 节点名称 | `varchar(50)` | `Text` | 节点名称 |
| `AllowSelectUsers` | 手动指定下节点审批人 | `int` | `Switch` | 当前节点的审批人在提交时，允许手动指定下一节点审批人。注意[会签节点]一般不开启此功能。 |
| `AllowRecall` | 允许撤回 | `int` | `Switch` | 允许撤回 |
| `PositionLeft` | 坐标X | `varchar(25)` | `Text` | 坐标X |
| `EndV8Server` | 结束V8服务器端 | `mediumtext` | `CodeEditor` | 结束V8服务器端 |
| `Roles` | 绑定角色 | `mediumtext` | `MultipleSelect` | 绑定角色 |
| `StartV8Server` | 开始V8服务器端 | `mediumtext` | `CodeEditor` | 开始V8服务器端 |
| `Users` | 绑定账户 | `mediumtext` | `MultipleSelect` | 绑定账户 |
| `HideHandOverSelect` | 隐藏移交选择人 | `int` | `Switch` | 隐藏移交选择人 |
| `BackNodes` | 可退回节点 | `mediumtext` | `MultipleSelect` | 可退回节点 |
| `StartV8` | 开始V8 | `mediumtext` | `CodeEditor` | 开始V8 |
| `Depts` | 组织机构 | `mediumtext` | `Department` | 组织机构 |
| `SameDeptApprove` | 同部门领导审批 | `int` | `Switch` | 寻找同部门用户角色Level级别比自己大的人。 |
| `Description` | 描述 | `mediumtext` | `Textarea` | 描述 |
| `Icon` | 图标 | `varchar(25)` | `FontAwesome` | 图标 |
| `AllowAddUsers` | 允许添加审批人 | `int` | `Switch` | 允许添加审批人 |
| `LineValueV8` | 条件判断V8 | `mediumtext` | `CodeEditor` | 条件判断V8 |
| `PositionTop` | 坐标Y | `varchar(25)` | `Text` | 坐标Y |
| `FlowDesignId` | 流程图Id | `varchar(36)` | `Guid` | 流程图Id |
| `TableId` | TableId | `varchar(36)` | `Guid` | TableId |
| `AllowHandOver` | 允许移交 | `int` | `Switch` | 允许移交 |
| `NodeType` | 节点类型 | `varchar(100)` | `Select` | 节点类型 |
| `Timeout` | 超时时间 | `int` | `NumberText` | 超时时间 |
| `CopyUsers` | 抄送 | `mediumtext` | `MultipleSelect` | 抄送 |
| `FieldsConfigComponent` | 字段设置 | `` | `DevComponent` | 字段设置 |
| `FieldsConfig` | 字段设置 | `mediumtext` | `Textarea` | 字段设置 |

### `wf_nodelist` - 节点列表

字段数：5

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `NodeKey` | 节点Key | `varchar(50)` | `Text` | 节点Key |
| `NodeName` | 节点名称 | `varchar(50)` | `Text` | 节点名称 |
| `NodeIcon` | 节点图标 | `varchar(50)` | `Text` | 节点图标 |
| `IsEnable` | 启用 | `int` | `Switch` | 启用 |
| `Sort` | 排序 | `int` | `NumberText` | 排序 |

### `wf_work` - 工作流工作

字段数：21

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `NodeName` | NodeName | `varchar(50)` | `Text` | NodeName |
| `FlowId` | FlowId | `varchar(36)` | `Guid` | FlowId |
| `Receiver` | Receiver | `varchar(50)` | `Text` | Receiver |
| `FirstSenderId` | FirstSenderId | `varchar(36)` | `Guid` | FirstSenderId |
| `FlowNo` | FlowNo | `varchar(50)` | `Text` | FlowNo |
| `FormData` | FormData | `mediumtext` | `Textarea` | FormData |
| `Remark` | Remark | `mediumtext` | `Textarea` | Remark |
| `SenderId` | SenderId | `varchar(36)` | `Guid` | SenderId |
| `FlowDesignId` | FlowDesignId | `varchar(36)` | `Guid` | FlowDesignId |
| `NoticeFields` | NoticeFields | `mediumtext` | `Textarea` | NoticeFields |
| `FromNodeId` | FromNodeId | `varchar(36)` | `Guid` | FromNodeId |
| `Timeout` | Timeout | `int` | `Text` | Timeout |
| `FlowTitle` | FlowTitle | `varchar(50)` | `Text` | FlowTitle |
| `ReceiverId` | ReceiverId | `varchar(36)` | `Guid` | ReceiverId |
| `Sender` | Sender | `varchar(50)` | `Text` | Sender |
| `FirstSender` | FirstSender | `varchar(50)` | `Text` | FirstSender |
| `FromNodeName` | FromNodeName | `varchar(50)` | `Text` | FromNodeName |
| `NodeId` | NodeId | `varchar(36)` | `Text` | NodeId |
| `WorkState` | WorkState | `varchar(50)` | `Text` | WorkState |
| `TableId` | TableId | `varchar(36)` | `Guid` | TableId |
| `TableRowId` | TableRowId | `varchar(36)` | `Guid` | TableRowId |

### `wx_menu` - 微信公众号自定义菜单

字段数：3

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `MenuJson` | 菜单JSON | `mediumtext` | `CodeEditor` | 菜单JSON |
| `WxMpName` | 公众号 | `varchar(100)` | `Select` | 公众号 |
| `WxMpId` | 公众号Id | `varchar(36)` | `Guid` | 公众号Id |

### `wx_mini_program` - 微信小程序

字段数：3

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Name` | 名称 | `varchar(50)` | `Text` | 名称 |
| `AppId` | AppId | `varchar(50)` | `Text` | AppId |
| `PagePath` | PagePath | `varchar(50)` | `Text` | PagePath |

### `wx_mp` - 微信公众号配置

字段数：7

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Key` | Key | `varchar(50)` | `Text` | Key |
| `EncodingAESKey` | EncodingAESKey | `varchar(50)` | `Text` | EncodingAESKey |
| `Token` | Token | `varchar(50)` | `Text` | Token |
| `DefaultApp` | 默认公众号 | `int` | `Switch` | 一旦设置为默认公众号，所有未设置所属公众号的帐号将默认此公众号 |
| `Name` | 名称 | `varchar(50)` | `Text` | 名称 |
| `AppSecret` | AppSecret | `varchar(255)` | `Text` | AppSecret |
| `AppId` | AppId | `varchar(50)` | `Text` | AppId |

### `wx_tpl_msg` - 公众号模板消息

字段数：10

| 字段 | 标签 | 类型 | 控件 | 说明 |
|---|---|---|---|---|
| `Content` | 内容 | `mediumtext` | `Textarea` | 内容 |
| `LinkUrl` | 跳转链接 | `varchar(50)` | `Text` | 跳转链接 |
| `Key` | Key | `varchar(50)` | `Text` | Key |
| `MiniProgramAppId` | 小程序AppId | `varchar(50)` | `Text` | 小程序AppId |
| `MiniProgramName` | 跳转小程序 | `varchar(100)` | `Select` | 跳转小程序 |
| `Title` | 标题 | `varchar(50)` | `Text` | 标题 |
| `Remark` | 备注 | `mediumtext` | `Textarea` | 备注 |
| `TemplateId` | 模板ID | `varchar(50)` | `Text` | 模板ID |
| `MiniProgramPagePath` | 小程序页面 | `varchar(50)` | `Text` | 小程序页面 |
| `MiniProgramId` | 小程序Id | `varchar(36)` | `Guid` | 小程序Id |
