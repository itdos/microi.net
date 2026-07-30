# Microi 表单组件配置项参考

本参考用于 AI 生成、审查或修复 `diy_field.Config`。事实源仍是 `Microi.Client/src/views/form-engine/diy-field-component/` 与 `diy-component-list.json`；组件源码新增配置时，必须同步更新本文件和官方文档。

## 字段级元数据

| 字段 | 说明 |
| --- | --- |
| `Label` / `Name` | 显示名 / 物理字段名。`Name` 使用 PascalCase 或既有表字段名，不写中文。 |
| `Type` | 物理列类型，只使用平台允许类型：`varchar(N)`、`mediumtext`、`longtext`、`int`、`bigint`、`decimal(18,N)`。日期时间存 `varchar(25)`。 |
| `Component` | 控件类型，例如 `Text`、`Select`、`TableChild`。 |
| `NotEmpty` / `Readonly` | 必填、只读。 |
| `Visible` / `AppVisible` | PC / App 是否显示，默认业务字段为 `1`。 |
| `TableWidth` / `FormWidth` | 列表宽度 / 表单栅格宽度。普通字段一般不设置 `FormWidth`；上传、富文本、代码、地图、子表等整行控件设 `24`。 |
| `Data` | 选项类控件静态数据，常用 KeyValue：`key|label,key2|label2`。 |
| `DefaultValue` / `Placeholder` / `Tab` | 默认值、占位提示、表单 Tab 分组。 |
| `V8Code` / `KeyupV8Code` / `V8TmpEngineTable` / `V8TmpEngineForm` | 字段前端事件或 V8 模板代码。代码必须格式化，不要写成单行。 |

## 通用 `Config` 根节点

| 配置 | 说明 |
| --- | --- |
| `EnableSearch` | 是否作为搜索条件。 |
| `ParamData` | 组件请求或 V8 使用的附加参数。 |
| `Sql` | SQL 数据源查询语句。动态值使用平台占位或后端参数化规则，不拼接用户输入。 |
| `DataSource` | 数据源类型：`Data`、`KeyValue`、`Sql`、`ApiEngine`、`DataSource` 等。 |
| `DataSourceSqlRemote` / `DataSourceSqlRemoteLoading` | SQL 是否远程搜索 / 加载态。 |
| `DataSourceId` / `DataSourceApiEngineKey` | 数据源引擎 Id / 接口引擎 Key。 |
| `SelectLabel` / `SelectSaveField` | 下拉、树、级联等显示字段 / 保存字段。 |
| `SelectSaveFormat` | 保存格式，常用 `Text` 或 `Json`。 |
| `V8Code` / `V8CodeBlur` | 值变更、失焦事件代码。 |
| `TextIcon` / `TextIconPosition` | 输入框图标与位置。 |
| `TextApend` / `TextApendPosition` | 输入框前后缀文本与位置。 |
| `TextShowPassword` / `TextAutocomplete` | 密码显示模式 / 浏览器联想。 |
| `DateTimeType` | 日期控件类型，如 `date`、`datetime`。 |
| `DevComponentName` / `DevComponentPath` | 自定义组件名称和路径。 |
| `MapCompany` | 地图服务商，默认 `Baidu`。 |

## 基础输入类

| 组件 | 推荐类型 | 配置项 |
| --- | --- | --- |
| `Text` | `varchar(200)` | 使用通用文本配置：`TextShowPassword`、`TextIcon`、`TextApend`、`V8CodeBlur`。 |
| `Guid` | `varchar(50)` | 通常只读，用于保存业务关联 GUID。 |
| `Textarea` | `mediumtext` | `Textarea.DefaultRows` 控制默认行数。 |
| `NumberText` | `int` 或 `decimal(18,N)` | `NumberTextStep`、`NumberTextPrecision`、`NumberTextMath`、`NumberTextBtn`、`NumberTextBtnPosition`。 |
| `DateTime` | `varchar(25)` | `DateTimeType` 控制日期、日期时间等模式。 |
| `Switch` | `int` | 存 `1/0`，不要用 `varchar` 或 `boolean`。 |
| `Rate` / `Progress` / `Slider` | `int` | 评分、进度、滑块值。 |
| `ColorPicker` | `varchar(50)` | 保存颜色字符串。 |

## 选项和数据源类

| 组件 | 推荐类型 | 配置项 |
| --- | --- | --- |
| `Select` | `varchar(50)` | 必须配置 `Data` 或 `Config.DataSource`；常用 `SelectLabel`、`SelectSaveField`、`SelectSaveFormat`。 |
| `MultipleSelect` | `varchar(500)` 或 `mediumtext` | 同 `Select`，多选值通常保存 JSON 或分隔文本。 |
| `Radio` | `varchar(50)` | 必须配置选项数据。 |
| `Checkbox` | `varchar(500)` 或 `mediumtext` | 必须配置选项数据，多值保存 JSON。 |
| `Autocomplete` | `varchar(200)` | 可配 SQL/API 数据源，允许输入联想。 |
| `TagInput` | `mediumtext` | `TagInput.Placeholder`、`TagInput.Options`、`TagInput.MaxCount`。 |
| `Transfer` | `mediumtext` | `Transfer.LeftTitle`、`Transfer.RightTitle`、`Transfer.Filterable`、`Transfer.Options`。 |

## 布局和说明类

| 组件 | 说明 | 配置项 |
| --- | --- | --- |
| `Divider` | 分割线，不保存业务值 | `DividerPosition`、`Divider.Icon`。 |
| `CollapseGroup` | 折叠分组 | `CollapseGroup.DefaultCollapsed`、`ScopeMode`、`FieldCount`、`UntilNextGroup`、`Description`、`Icon`、`Theme`、`ShowFieldCount`。 |
| `Tabs` | 字段级页签分组 | `FieldTabs.DefaultActiveKey`、`FieldTabs.Tabs[{Key,Label,Icon,Description}]`。 |
| `Alert` | 表单提示 | `Alert.Title`、`Content`、`Type`、`Effect`、`ShowIcon`。 |
| `StaticText` | 静态文本展示 | `StaticText.Content`、样式类配置。 |
| `Html` | HTML 内容 | 保存 HTML 字符串；注意 XSS 风险。 |
| `Button` | 表单按钮 | `Button.Type`、`Loading`、`Icon`、`Size`、`PreviewCanClick`、`RefreshTableAfterClick`，点击逻辑写格式化 V8。 |

## 富文本、代码、上传

| 组件 | 推荐类型 | 配置项 |
| --- | --- | --- |
| `RichText` | `mediumtext` | 富文本内容，图片上传遵循平台上传配置。 |
| `CodeEditor` | `mediumtext` | `CodeEditor.Height`。 |
| `JsonTable` | `mediumtext` | JSON 表格展示/编辑，保存结构化 JSON；配置必须写在 `Config.JsonTable`。 |
| `ImgUpload` | `mediumtext` | `ImgUpload.Limit`、`Multiple`、`Tips`、`MaxCount`、`ShowFileList`、`Preview`、`MaxSize`。 |
| `FileUpload` | `mediumtext` | `FileUpload.Limit`、`Multiple`、`Tips`、`MaxCount`、`ShowFileList`、`MaxSize`。 |
| `ImgUpload` / `FileUpload` | - | `Upload.BeforeUploadV8`、`GetPrivateFileBeforeServerV8`、`GetPrivateFileAfterServerV8`。 |

### JsonTable 配置

`JsonTable` 的事实源是 `Microi.Client/src/views/form-engine/diy-field-component/diy-jsontable.vue`。AI 生成字段时不要只写 `Component=JsonTable`，必须同步生成 `Config.JsonTable.Columns`，否则前端只能显示空表。

`Config.JsonTable` 根节点：

| 配置 | 说明 |
| --- | --- |
| `Columns` | JSON 表格列数组，必填。每一项描述一列的显示、编辑控件和数据源。 |
| `DataSource` | 批量导入/候选数据源类型：`KeyValue`、`Sql`、`DataSource`、`ApiEngine` 等。 |
| `Sql` | `DataSource=Sql` 时的 SQL；远程搜索时必须带 `$Keyword$` 条件和 `limit`。 |
| `DataSourceId` | `DataSource=DataSource` 时的数据源引擎 Key/Id。 |
| `ApiEngineKey` / `DataSourceApiEngineKey` | `DataSource=ApiEngine` 时的接口引擎 Key；前端保存到 `ApiEngineKey`，列级配置可用 `DataSourceApiEngineKey`。 |
| `SelectLabel` | 候选数据展示字段。 |
| `DataSourceSqlRemote` | 是否远程搜索。大数据量必须设为 `true`。 |
| `KeyValueList` | 静态键值数据，格式为 `[{ "Key": "A", "Value": "选项A" }]`。 |

`Config.JsonTable.Columns[]` 列对象：

| 配置 | 说明 |
| --- | --- |
| `Id` | 列唯一 Id，建议使用 Guid/Ulid。 |
| `Sort` | 列排序。 |
| `Label` | 列标题，必填。 |
| `Key` | JSON 行对象中的属性名，必填，使用英文或既有字段名。 |
| `Component` | 列编辑控件：`Text`、`Number`、`Textarea`、`Password`、`Select`、`MultipleSelect`、`Radio`、`Checkbox`、`Switch`、`Cascader`、`SelectTree`、`DateTime`、`Rate`、`ColorPicker`、`Progress`、`AutoNumber`、`Autocomplete`、`Address`、`Department`、`Map`、`ImgUpload`、`FileUpload`、`RichText`、`CodeEditor`、`Html`、`Fontawesome`、`Qrcode`、`Divider`、`Button`。 |
| `Width` / `MinWidth` | 固定宽度 / 最小宽度，`MinWidth` 默认可用 `120`。 |
| `Required` | 是否必填。 |
| `Visible` | 是否显示，默认 `true`。 |
| `DefaultValue` | 新增行默认值。 |
| `Placeholder` | 占位提示。 |
| `Readonly` | 是否只读。 |
| `Config` | 列控件配置。选择类列使用 `SelectLabel`、`SelectSaveField`、`SelectSaveFormat`、`EnableSearch`、`DataSource`、`Sql`、`DataSourceId`、`DataSourceApiEngineKey`、`DataSourceSqlRemote`。 |
| `Data` | 列级普通静态选项。 |
| `KeyValueList` | 列级键值选项，格式同根节点。 |

示例：

```json
{
  "JsonTable": {
    "Columns": [
      {
        "Id": "col-material",
        "Sort": 1,
        "Label": "材料名称",
        "Key": "MaterialName",
        "Component": "Text",
        "MinWidth": 160,
        "Required": true,
        "Visible": true,
        "Placeholder": "请输入材料名称"
      },
      {
        "Id": "col-status",
        "Sort": 2,
        "Label": "状态",
        "Key": "Status",
        "Component": "Select",
        "MinWidth": 120,
        "Visible": true,
        "Config": {
          "DataSource": "KeyValue",
          "SelectLabel": "Value",
          "SelectSaveField": "Key",
          "SelectSaveFormat": "Text"
        },
        "KeyValueList": [
          { "Key": "draft", "Value": "草稿" },
          { "Key": "confirmed", "Value": "已确认" }
        ]
      }
    ]
  }
}
```

## 树、级联、组织

| 组件 | 推荐类型 | 配置项 |
| --- | --- | --- |
| `Cascader` | `varchar(500)` 或 `mediumtext` | `Cascader.Lazy`、`Filterable`、`Value`、`Label`、`Children`、`ParentField`、`ParentFields`、`Multiple`、`Disabled`、`Leaf`、`EmitPath`。 |
| `SelectTree` | `varchar(50)` | `SelectTree.Lazy`、`Filterable`、`Value`、`Label`、`Children`、`ParentField`、`ParentFields`、`Multiple`、`Disabled`、`Leaf`。 |
| `TreeCheckbox` | `mediumtext` | `TreeCheckbox.DataSourceType`、`DataSourceApi`、`ShowSearch`、`ShowIcon`、`DefaultExpandAll`、`NameColumnWidth`、`NameColumnLabel`、`PermissionColumnLabel`。 |
| `Department` | `varchar(50)` 或 `varchar(500)` | `Department.Multiple`、`Filterable`、`EmitPath`。 |
| `Address` | `varchar(500)` | 省市区地址选择，通常保存路径或 JSON。 |

## 弹表、关联表、子表

| 组件 | 推荐类型 | 配置项 |
| --- | --- | --- |
| `OpenTable` | `varchar(50)` | `OpenTable.BtnName`、`ShowDialog`、`MultipleSelect`、`BeforeOpenV8`、`SubmitV8`、`SearchAppend`。 |
| `JoinTable` | `varchar(50)` | `JoinTable.TableId`、`ModuleName`、`ModuleId`、`Where`。 |
| `JoinForm` | `varchar(50)` | `JoinForm.TableId`、`TableName`、`JoinFieldName`、`Id`、`FormMode`、`_SearchEqual`。主表字段保存一个目标记录 Id。 |
| `TableChild` | 控件字段通常不承担关系存储 | 根节点：`TableChildTableId`、`TableChildSysMenuId`、`TableChildSysMenuName`、`TableChildFkFieldName`、`TableChildCallbackField`、`TableChildRowClickV8`。真实关系列必须建在子表。 |
| `TableChild` | - | `TableChild.PrimaryTableFieldName`：主表关联字段，默认 `Id`；`DisablePagination`：子表是否禁用分页；`NoneDefaultHeight`：是否不使用默认高度；`Data`、`SearchAppend`、`LastTableId`、`LastSysMenuId`、`LastSysMenuName`。 |
| `TableChild` | - | `TableChild.ImportAutoFillFk`：导入子表时自动补外键；`ImportRelations[{Parent,Child}]`：用主表字段和子表/Excel 字段批量匹配主表；`ImportBackfillFields[{Parent,Child}]`：匹配到主表后把主表值回填到子表字段。 |

### `JoinForm` / `TableChild` 选择门禁

| 业务问题 | 正确组件 |
| --- | --- |
| 当前记录保存一个目标 Id，并内嵌该独立目标记录的完整表单 | `JoinForm` |
| 一条父记录拥有 0..N 条明细，需要列表、分页或多行增删改 | `TableChild` |
| 只需从列表选择一条/多条，不需要内嵌完整目标表单 | `OpenTable` |

- “明细、子表、清单、条目、行项目、多个记录”默认选择 `TableChild`；基数不清楚时先询问。
- `JoinForm` 渲染单条 `diy-form`，目标 `TableId/TableName` 必须与当前表不同；指回当前表时
  组件不会初始化。`JoinFieldName` 是**当前主表中保存目标 Id 的字段名**。
- `TableChild` 渲染 `diy-table`。子表必须有物理外键，控件必须同时拿到真实的子表 Id、
  子表菜单 Id 和外键字段名；不得猜 Id 或用 `JoinForm` 代替未完成的两阶段配置。
- 例：订单商品明细应为 `order_detail.OrderId + TableChild`；工单内嵌一个客户档案才是
  `work_order.CustomerId + JoinForm`。

### JoinForm 示例

```json
{
  "JoinForm": {
    "TableId": "<目标 diy_table.Id>",
    "TableName": "",
    "JoinFieldName": "CustomerId",
    "FormMode": "View",
    "Id": "",
    "_SearchEqual": {}
  }
}
```

字段设计器选择 `TableId` 时会清空 `TableName`；动态配置也可以只给目标 `TableName`，
二者至少提供一个，不要把当前表作为目标表。

### TableChild 完整示例

```json
{
  "TableChildTableId": "01KNRCSVFK2W4NCWYBTVH9HGM2",
  "TableChildSysMenuId": "01KNRM72C6KBG4S8CY341333XJ",
  "TableChildSysMenuName": "项目成品清单",
  "TableChildFkFieldName": "Guid",
  "TableChildCallbackField": "[{\"Parent\":\"Code\",\"Child\":\"XiangmuBM\"},{\"Parent\":\"Name\",\"Child\":\"XiangmuMC\"}]",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "Data": [],
    "SearchAppend": {},
    "ImportAutoFillFk": true,
    "ImportRelations": [
      { "Parent": "Code", "Child": "XiangmuBM" }
    ],
    "ImportBackfillFields": [
      { "Parent": "Code", "Child": "XiangmuBM" },
      { "Parent": "Name", "Child": "XiangmuMC" }
    ],
    "LastTableId": "",
    "LastSysMenuId": "",
    "LastSysMenuName": "",
    "DisablePagination": false,
    "NoneDefaultHeight": false
  }
}
```

`Parent` 和 `Child` 都可以填字段名或字段标题。通过主表子表区域、或通过 `V8.OpenAnyTable` 带主表条件打开子表后导入时，即使 Excel 没有 `XiangmuBM` / `XiangmuMC`，后端也应根据固定主表行回填外键和展示列。

## 地图、二维码、图标、自定义

| 组件 | 推荐类型 | 配置项 |
| --- | --- | --- |
| `Map` | `varchar(200)` | 地图点位，使用 `MapCompany`。 |
| `MapArea` | `mediumtext` | 地图区域，多边形或区域 JSON。 |
| `Qrcode` | `varchar(500)` | 二维码内容或生成源字段。 |
| `FontAwesome` | `varchar(100)` | 图标类名。 |
| `DevComponent` | 视组件而定 | `DevComponentName`、`DevComponentPath`。 |
| `V8TmpEngine` | `mediumtext` | V8 模板引擎承载控件。 |
