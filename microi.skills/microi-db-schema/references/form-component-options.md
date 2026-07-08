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
| `JsonTable` | `mediumtext` | JSON 表格展示/编辑，保存结构化 JSON。 |
| `ImgUpload` | `mediumtext` | `ImgUpload.Limit`、`Multiple`、`Tips`、`MaxCount`、`ShowFileList`、`Preview`、`MaxSize`。 |
| `FileUpload` | `mediumtext` | `FileUpload.Limit`、`Multiple`、`Tips`、`MaxCount`、`ShowFileList`、`MaxSize`。 |
| `ImgUpload` / `FileUpload` | - | `Upload.BeforeUploadV8`、`GetPrivateFileBeforeServerV8`、`GetPrivateFileAfterServerV8`。 |

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
| `JoinForm` | `varchar(50)` | `JoinForm.TableId`、`TableName`、`Id`、`FormMode`、`_SearchEqual`。 |
| `TableChild` | 通常不建物理业务列 | 根节点：`TableChildTableId`、`TableChildSysMenuId`、`TableChildSysMenuName`、`TableChildFkFieldName`、`TableChildCallbackField`、`TableChildRowClickV8`。 |
| `TableChild` | - | `TableChild.PrimaryTableFieldName`：主表关联字段，默认 `Id`；`DisablePagination`：子表是否禁用分页；`NoneDefaultHeight`：是否不使用默认高度；`Data`、`SearchAppend`、`LastTableId`、`LastSysMenuId`、`LastSysMenuName`。 |
| `TableChild` | - | `TableChild.ImportAutoFillFk`：导入子表时自动补外键；`ImportRelations[{Parent,Child}]`：用主表字段和子表/Excel 字段批量匹配主表；`ImportBackfillFields[{Parent,Child}]`：匹配到主表后把主表值回填到子表字段。 |

### TableChild 导入示例

```json
{
  "TableChildTableId": "01KNRCSVFK2W4NCWYBTVH9HGM2",
  "TableChildSysMenuId": "01KNRM72C6KBG4S8CY341333XJ",
  "TableChildSysMenuName": "项目成品清单",
  "TableChildFkFieldName": "Guid",
  "TableChildCallbackField": "[{\"Parent\":\"Code\",\"Child\":\"XiangmuBM\"},{\"Parent\":\"Name\",\"Child\":\"XiangmuMC\"}]",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "ImportAutoFillFk": true,
    "ImportRelations": [
      { "Parent": "Code", "Child": "XiangmuBM" }
    ],
    "ImportBackfillFields": [
      { "Parent": "Code", "Child": "XiangmuBM" },
      { "Parent": "Name", "Child": "XiangmuMC" }
    ]
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

