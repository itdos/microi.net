# Core Microi Tables

Use this reference when exact field names are needed for core platform configuration tables.

## Core Table Notes

- `diy_table`: table/form metadata and table-level events.
- `diy_field`: field metadata and field-level events/templates.
- `sys_menu`: module/menu/list/button/query configuration.
- `sys_apiengine`: API engine scripts and execution controls.
- `sys_datasource`: V8/SQL/JSON datasource definitions.
- `sys_osclients`: SaaS tenant, storage, Redis, MQ, MQTT, auth, and domain config.
- `Sys_Config`: global platform settings and global V8 code.
- `wf_*`: workflow design and runtime tables.

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
| `SqlJoin` | Join关联 | `mediumtext` | `CodeEditor` | 示例：INNER JOIN Sys_User B ON A.UserId = B.Id<br>示例：INNER JOIN Diy_Customer B ON A.KehuXXID = B.Id AND B.GuanlianZH like '%$CurrentUser.Id$%'<br>注意：默认选择的DIY表已经占用了表别名A。<br>可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.DeptId$、$Cur… |
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
| `SqlWhere` | Where条件 | `mediumtext` | `CodeEditor` | 示例[每个人只能查看自己的数据，或者上级可以查看同部门下级的数据]：<br>(A.UserId = '$CurrentUser.Id$' OR (B.Level > $CurrentUser.Level$ AND B.DeptCode LIKE '$CurrentUser.DeptCode$%'))<br>注意：默认选择的DIY表已经占用了表别名A。<br>可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.D… |
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
