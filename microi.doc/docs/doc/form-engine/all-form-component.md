# 🧩 所有表单组件

> **本篇对 Microi吾码平台所有表单组件进行介绍**

---

## 通用配置项速查

表单字段的配置主要存储在 `diy_field.Config`。以下配置项为 AI 生成字段、人工设计字段时必须优先理解的通用约定：

| 配置项 | 说明 |
| --- | --- |
| `DataSource`、`Data` | 选项/下拉/树/级联的数据来源。`Select`、`MultipleSelect`、`Radio`、`Checkbox` 必须配置数据源，否则表单为空。 |
| `Sql`、`DataSourceSqlRemote` | SQL 数据源与远程搜索。远程搜索时注意 `$Keyword$` 过滤和 `limit`。 |
| `SelectLabel`、`SelectSaveField`、`SelectSaveFormat` | 显示字段、保存字段、保存格式。用于下拉、树、级联、关联选择等组件。 |
| `EnableSearch` | 是否作为列表搜索条件。 |
| `V8Code`、`V8CodeBlur` | 值变更、失焦等前端 V8 事件代码，代码应格式化保存。 |
| `TextIcon`、`TextIconPosition`、`TextApend`、`TextApendPosition` | 文本类输入框图标、前后缀。 |
| `DateTimeType` | 日期控件类型，例如 `date`、`datetime`。 |
| `ImgUpload`、`FileUpload`、`Upload` | 上传数量、大小、私有文件、上传前后 V8 等配置。 |
| `OpenTable`、`JoinForm`、`JoinTable` | 弹表选择、关联表单、关联表配置。 |
| `TableChild` | 子表配置，包含关联子表、外键、导入匹配、导入回填等。 |

## 单行文本 Text

若要限制单行文本只允许输入数字、身份证号、手机号、纯字母等，可通过字段的值变更 V8 事件、表单提交前 V8 事件进行限制：
```js
//Phone字段属性的【值变更V8事件】
V8.Form.Phone = V8.Form.Phone.replace(/\D/g, '');//输入框只能输入数字

//表单提交前V8事件（前后端V8事件均可）
if(V8.Form.Phone.length != 11){
  return { Code : 0,  Msg : '请输入正确的手机号码' };
}
```

## 多行文本 Textarea
>* 多行文本，不限制字数

## 富文本 RichText
>* 富文本编辑器，支持图片上传

## 文本联想 Autocomplete
>* 输入联想查询下拉选择，也可自定义输入

## 关联Id Guid
>* 一般用于存储string类型的guid值

## 数字 NumberText
>* 默认int类型，如果开启了小数点，记得手动将类型修改为decimal类型，如果4位小数点就是decimal(12,4)，2位小数点就是decimal(12,2)

## 单选框 Radio
>* 常用的单选框

## 复选框 Checkbox
>* 数据库存储为json字符串

## 下拉单选 Select
>* 常用的下拉选择

## 下拉复选 MultipleSelect
>* 数据库存储为json字符串

## 开关 Switch
>* 开关组件默认为int类型，打开1，关闭0（很老的版本默认是bit类型，建议更换为int类型）
>* __<font color="red">开关组件不能是varchar类型，否则不管数据库存的是"1"或者"0"，都会显示打开</font>__

## 日期时间 DateTime
>* 建议使用varchar类型，主要原因是日期支持各种格式设置

## 图片上传 ImgUpload
>* 默认不允许匿名访问
>* 上传前V8事件可通过`V8.ThisValue`访问到属性
```js
{
  name : "WX20220109-155433@2x.png",
  size : 952063,
  type : "image/png"
}
```
>* 上传后可通过`V8.Form.字段名`访问到图片URL地址、Name等

## 文件上传 FileUpload
>* 默认不允许匿名访问
>* V8事件同`图片上传 ImgUpload`

## 评分 Rate
>* 评分组件，默认int类型，数据库存储为int类型

## 颜色选择 ColorPicker
>* 颜色选择组件，默认varchar类型，数据库存储为rgb颜色值

## 分割线 Divider
>* 分割表单，不产生物理字段

## 按钮 Button
>* 按钮组件，支持V8代码

## HTML
>* HTML组件，支持自定义HTML代码

## 自动编号 AutoNumber
>* 自带分布式锁的自动编号，支持自定义前缀

## 子表格 TableChild
>* 非常常用的子表
>* 常用配置：
```json
{
  "TableChildTableId": "子表 diy_table.Id",
  "TableChildSysMenuId": "子表菜单 sys_menu.Id",
  "TableChildSysMenuName": "子表菜单名称",
  "TableChildFkFieldName": "XiangmuID",
  "TableChildCallbackField": "[{\"Parent\":\"Code\",\"Child\":\"XiangmuBM\"}]",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "DisablePagination": false,
    "NoneDefaultHeight": false,
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
>* `TableChildFkFieldName`：子表保存主表关联值的字段。
>* `TableChild.PrimaryTableFieldName`：主表被关联字段，默认 `Id`。
>* `ImportAutoFillFk`：导入子表 Excel 时自动补齐子表外键。
>* `ImportRelations`：导入时用主表字段和子表/Excel 字段匹配主表，`Parent`、`Child` 可填字段名或字段标题。
>* `ImportBackfillFields`：匹配到主表后，把主表字段回填到子表字段。适用于 Excel 中没有项目编号、项目名称、客户名称等展示冗余列的场景。
>* `TableChildCallbackField`：旧版“回写子表列”配置，保存同类 JSON 字符串；导入逻辑会兼容读取。
>* 在主表详情的子表区域导入，或通过 `V8.OpenAnyTable` 带主表条件打开子表后导入时，即使 Excel 没有主表关联列，也应由前端把固定主表关系传给 `/api/FormEngine/ImportDiyTableRow`，后端再补齐外键和 `ImportBackfillFields`。

## 地图(点) Map
>* 地图画点

## 地图(区域) MapArea
>* 地图画区域

## 级联选择器 Cascader
>* 自定义级联选择器

## 组织机构 Department
>* 平台组织机构选择

## 地址 Address
>* 省市区联动

## 手机验证码 PhoneSMS
>* 手机验证码组件，支持发送短信验证码

## 进度条 Progress
>* 显示进度，数据库存储数字

## 时间线 Timeline
>* 时间线组件

## 图标库 FontAwesome
>* 集成FontAwesome

## 定制组件 DevComponent
>* 自定义定制开发的组件嵌入到表单中

## 弹出表格 OpenTable
>* 弹出数据列表，选择数据提交后触发事件
>* 弹出前V8引擎代码
```js
//设置查询条件，[V8.Field.XuanzeGLSP]为[弹出表格]控件的[字段名]
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```
>* 提交V8事件引擎代码
::: details 展开查看 JavaScript 代码（38 行）
```js
//-------前端代码-------
var selectData = V8.TableRowSelected;//获取选中的数据
var selectIds = selectData.map(item => item.Id);//接口引擎只要Id
var result = await V8.ApiEngine.Run('add-gylx-rwz', {
    GongyiLCID: V8.Form.Id, //关联主表Id
    RenwuZIds: selectIds
});
if(result.Code == 1){
    V8.Tips('添加成功！');
    V8.TableRefresh(V8.Field.GongxuLB, {});//刷新子表
}else{
    V8.Tips('添加失败：' + result.Msg, false);
}

//-------接口引擎[add-gylx-rwz]代码-------
if(!V8.Param.GongyiLCID || !V8.Param.RenwuZIds || V8.Param.RenwuZIds.length == 0){
  return { Code : 0, Msg : '参数错误！' };
}
//先查询任务栈列表数据
var renwuzhanList = V8.FormEngine.GetTableData('diy_APSsczx', {
  Ids : V8.Param.RenwuZIds
});
if(renwuzhanList.Code != 1 || renwuzhanList.Data.length == 0){
  return { Code : 0, Msg : '未查询到任务栈列表数据！'  + (renwuzhanList.Msg || '') };
}
//循环插入
for(var i = 0; i < renwuzhanList.Data.length; i++){
  var item = renwuzhanList.Data[i];
  var addResult = V8.FormEngine.AddFormData('diy_APSgylxsczx', {
    ...item,
    Id : '', //重置子表Id
    GongyiLCID : V8.Param.GongyiLCID //关联主表Id
  }, V8.DbTrans);//带事务
  if(addResult.Code != 1){
    return addResult;//会自动回滚事务，因为Code != 1
  }
}
return { Code : 1 };//会自动提交事务，因为Code == 1
```
:::

## 关联表单 JoinForm
>* 一般用于自定表单模板

## 代码编辑器 CodeEditor
>* 支持代码联想、代码缩进、语法高亮、代码折叠等等

## 下拉树 SelectTree
>* 这是一个非常强大的组件

## JSON表格 JsonTable
>* 支持 JSON 数据的表格展示与编辑，字段值保存为结构化 JSON。
>* 配置来源为 `diy_field.Config.JsonTable`，事实源组件是 `Microi.Client/src/views/form-engine/diy-field-component/diy-jsontable.vue`。
>* 必须配置 `Columns`，否则前端只能显示空表。

常用根配置：

| 配置项 | 说明 |
| --- | --- |
| `Columns` | 列配置数组。 |
| `DataSource` | 批量导入/候选数据源类型：`KeyValue`、`Sql`、`DataSource`、`ApiEngine` 等。 |
| `Sql` | SQL 数据源语句；远程搜索时建议带 `$Keyword$` 和 `limit`。 |
| `DataSourceId` | 数据源引擎 Key/Id。 |
| `ApiEngineKey` / `DataSourceApiEngineKey` | 接口引擎 Key。根节点保存为 `ApiEngineKey`，列级配置可使用 `DataSourceApiEngineKey`。 |
| `SelectLabel` | 候选数据展示字段。 |
| `DataSourceSqlRemote` | 是否远程搜索。数据量大时必须启用。 |
| `KeyValueList` | 静态键值数据，格式为 `[{ "Key": "A", "Value": "选项A" }]`。 |

`Columns[]` 每列配置：

| 配置项 | 说明 |
| --- | --- |
| `Id` | 列唯一 Id。 |
| `Sort` | 列排序。 |
| `Label` | 列标题，必填。 |
| `Key` | JSON 行对象属性名，必填。 |
| `Component` | 列编辑控件，支持 `Text`、`Number`、`Textarea`、`Password`、`Select`、`MultipleSelect`、`Radio`、`Checkbox`、`Switch`、`Cascader`、`SelectTree`、`DateTime`、`Rate`、`ColorPicker`、`Progress`、`AutoNumber`、`Autocomplete`、`Address`、`Department`、`Map`、`ImgUpload`、`FileUpload`、`RichText`、`CodeEditor`、`Html`、`Fontawesome`、`Qrcode`、`Divider`、`Button`。 |
| `Width` / `MinWidth` | 固定宽度 / 最小宽度。 |
| `Required` | 是否必填。 |
| `Visible` | 是否显示。 |
| `DefaultValue` | 新增行默认值。 |
| `Placeholder` | 占位提示。 |
| `Readonly` | 是否只读。 |
| `Config` | 列级控件配置。选择类列常用 `DataSource`、`Sql`、`DataSourceId`、`DataSourceApiEngineKey`、`DataSourceSqlRemote`、`SelectLabel`、`SelectSaveField`、`SelectSaveFormat`、`EnableSearch`。 |
| `Data` / `KeyValueList` | 列级静态选项。 |

配置示例：

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

## 组件配置项补充表

| 组件 | 常用配置项 |
| --- | --- |
| Text / Textarea | `TextShowPassword`、`TextIcon`、`TextApend`、`Textarea.DefaultRows` |
| NumberText / Slider / Rate / Progress / ColorPicker | `NumberTextStep`、`NumberTextPrecision`、`NumberTextMath`、`NumberTextBtn`、`NumberTextBtnPosition`、滑块/评分/进度/颜色值配置 |
| Select / MultipleSelect / Radio / Checkbox | `DataSource`、`Data`、`Sql`、`DataSourceId`、`DataSourceApiEngineKey`、`SelectLabel`、`SelectSaveField`、`SelectSaveFormat` |
| Autocomplete / TagInput / Transfer | 联想数据源、`TagInput.Placeholder`、`TagInput.Options`、`TagInput.MaxCount`、`Transfer.LeftTitle`、`Transfer.RightTitle`、`Transfer.Filterable`、`Transfer.Options` |
| AutoNumber | `AutoNumberFixed`、`AutoNumberLength`、`AutoNumberFields`、`AutoNumber.DataRule`、`AutoNumber.CreateRule` |
| Button | `Button.Type`、`Button.Icon`、`Button.Size`、`Button.PreviewCanClick`、`Button.RefreshTableAfterClick` |
| Divider / CollapseGroup / Tabs / Alert / StaticText | `DividerPosition`、`Divider.Icon`、`CollapseGroup.*`、`FieldTabs.*`、`Alert.*`、`StaticText.Content` |
| ImgUpload / FileUpload | `Limit`、`Multiple`、`Tips`、`MaxCount`、`ShowFileList`、`Preview`、`MaxSize`、`Upload.*V8` |
| Cascader / SelectTree / Department / Address / TreeCheckbox | `Lazy`、`Filterable`、`Value`、`Label`、`Children`、`ParentField`、`ParentFields`、`Multiple`、`EmitPath`、`TreeCheckbox.*` |
| OpenTable / JoinForm / JoinTable | `OpenTable.BtnName`、`OpenTable.MultipleSelect`、`OpenTable.BeforeOpenV8`、`OpenTable.SubmitV8`、`JoinForm.*`、`JoinTable.*` |
| CodeEditor / JsonTable / Html / RichText | `CodeEditor.Height`、`JsonTable.Columns`、`JsonTable.Columns[].Config`、JSON/HTML/富文本内容配置 |
| Map / MapArea / Qrcode / FontAwesome / DevComponent | `MapCompany`、二维码源字段、图标类名、`DevComponentName`、`DevComponentPath` |
