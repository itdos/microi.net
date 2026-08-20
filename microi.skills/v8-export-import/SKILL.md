---
name: v8-export-import
description: Microi V8 Office 导入导出指南。用于使用 V8.Office 导出单/多 Sheet Excel、Word、PowerPoint，解析 Excel，自定义表头/图片、文件响应和批量导入校验。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 Office 导入导出

你正在为 Microi 吾码平台编写自定义 Excel、Word、PowerPoint 导入/导出代码。平台通过 `V8.Office` 提供 Office 处理能力，源码在 `Microi.Office` 插件中。

文档维护必须优先更新既有后端 V8 主文档 `microi.doc/docs/doc/v8-engine/v8-server.md`，再按需补充已有专题页；不得为同一组 `V8.Office` API 新建重复 Markdown 页面或文档路由。只维护 `microi.doc/docs/doc/` 中文文档，`docs/en/` 由官网统一翻译生成，不手工同步英文版。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-export-import-000 sha256=d3bb04ceec66bdf6b74a5bcce03be9239400497426bee7d827b25ae71bb8d840 -->
## 核心 API

| 方法 | 说明 |
|------|------|
| `V8.Office.ExportExcel({...})` | 自定义导出 `.xlsx`；支持标准表格、高级自由布局、单/多 Sheet、图片、公式、合并、边框、打印和行分组 |
| `V8.Office.ExcelToList({...})` | 解析上传的 Excel 文件为 JSON 数组 |
| `V8.Office.ExportWordText({...})` | 兼容旧版纯文本 Word 导出 |
| `V8.Office.ExportWord({...})` | 导出 `.docx`；支持段落、章节、表格、图片、页眉页脚和页码 |
| `V8.Office.ExportPowerPoint({...})` | 导出 `.pptx`；支持多页、文本、项目符号、表格、图片、主题和页码 |
| `V8.Office.SendEmail({...})` | 发送邮件（HTML 内容） |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-001 sha256=05aa0294a3ac75fb841f129fe8c76b26d7391efa7ce67b86f18d6a9e60157722 -->
## 自定义导出 Excel（接口引擎）

平台默认导出仅支持表格已展示的字段。如需自定义（如列重排、合并、计算列、图片），用接口引擎替换【导出接口】。

```javascript
// 1. 查询数据（动态条件）
var dataResult = V8.FormEngine.GetTableData('diy_blog_test', {
  _Where: [['Xingming', 'Like', V8.Param.keyword || '']]
});
if (dataResult.Code !== 1) return dataResult;

// 2. 定义动态表头
var header = [
  {
    Name: 'Biaoti', Label: '标题', Component: 'Text',
    Width: 30,
    HeaderStyle: { BackgroundColor: '17365D', FontColor: 'FFFFFF' },
    Style: { WrapText: true }
  },
  { Name: 'Xingming', Label: '姓名', Component: 'Text', Width: 16 },
  {
    Name: 'ImgUpload57',
    Label: '公有单图',
    Component: 'ImgUpload',
    Config: '{"ImgUpload":{"Multiple":0,"Limit":0}}'
  },
  {
    Name: 'ImgUpload64',
    Label: '公有多图',
    Component: 'ImgUpload',
    Config: '{"ImgUpload":{"Multiple":1,"Limit":0}}'  // Multiple=1 自动多图分列
  }
];

// 3. 调用导出引擎
var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelData: dataResult.Data,
  ExcelHeader: header,
  ExcelOptions: {
    SheetName: '业务数据',
    DefaultColumnWidth: 14,
    HeaderRowHeight: 30,
    DataRowHeight: 24,
    FreezeHeader: true,
    AutoFilter: true,
    HeaderStyle: {
      FontName: 'Microsoft YaHei', FontSize: 11, Bold: true,
      HorizontalAlignment: 'Center', VerticalAlignment: 'Center'
    },
    CellStyle: { FontName: 'Microsoft YaHei', FontSize: 10 }
  }
});
if (excelResult.Code !== 1) return excelResult;

// 4. 返回文件流（接口引擎必须开启【响应文件】配置）
return {
  Code: 1,
  Data: {
    FileName: '导出_' + DateNow('yyyyMMdd_HHmmss') + '.xlsx',
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    FileByteBase64: System.Convert.ToBase64String(excelResult.Data)
  }
};
```

### Excel 尺寸与样式参数

`ExcelOptions` 是工作表级默认配置：

| 参数 | 说明 |
|------|------|
| `SheetName` | 单 Sheet 名称 |
| `DefaultColumnWidth` | 默认列宽，单位为 Excel 字符宽度，范围 `0.1~255` |
| `DefaultRowHeight` | 默认行高，单位为磅（pt），最大 `409.5` |
| `HeaderRowHeight` / `DataRowHeight` | 表头/数据行高，单位为磅（pt），最大 `409.5` |
| `FreezeHeader` / `FreezeRows` / `FreezeColumns` | 冻结首行、顶部指定行数、左侧指定列数；`FreezeRows` 优先于 `FreezeHeader` |
| `AutoFilter` / `AutoFilterRange` | 启用自动筛选或指定筛选区域；传 `AutoFilterRange` 会自动启用 |
| `AutoSizeColumns` | 自动计算全部列宽；大数据量优先显式设置 `Width` |
| `ShowGridLines` | 是否显示工作表网格线 |
| `Zoom` | 工作表缩放比例 `10~400` |
| `PrintOrientation` / `PaperSize` | 打印方向及 A3/A4/A5/Letter/Legal 纸张 |
| `FitToWidth` / `FitToHeight` / `PrintArea` | 缩放打印页数与 A1 打印区域 |
| `MarginTop/Right/Bottom/Left` | 打印页边距，单位为英寸 |
| `CenterHorizontally/Vertically` | 打印水平/垂直居中 |
| `HeaderText` / `FooterText` / `ShowPageNumber` | 页眉、页脚和页码 |
| `HeaderStyle` / `CellStyle` | 全局表头/数据单元格样式 |

`ExcelHeader` 除 `Name/Label/Component/Type/Config` 外，还支持：

| 参数 | 说明 |
|------|------|
| `Width`（兼容 `ColumnWidth`） | 固定列宽，单位为 Excel 字符宽度 |
| `AutoSize`、`MinWidth`、`MaxWidth` | 单列自动宽度及上下限 |
| `Hidden` | 隐藏列但保留数据 |
| `HeaderHeight` / `RowHeight` | 表头/数据行高候选值，同一 Sheet 取最大值 |
| `NumberFormat` | 数字或日期格式，如 `#,##0.00`、`0.00%`、`yyyy-mm-dd` |
| `HeaderStyle` / `Style` | 当前列表头/数据样式，覆盖全局同名属性 |

样式对象支持：`FontName/FontSize/FontColor/Bold/Italic/Underline/BackgroundColor/HorizontalAlignment/VerticalAlignment/WrapText/ShrinkToFit/Rotation/NumberFormat/BorderStyle/BorderColor`。边框还可用 `BorderTop/Right/Bottom/LeftStyle` 和对应 `Color` 分别控制四条边；类型可用 `Thin/Medium/Dashed/Dotted/Double/DashDot` 等。颜色使用 `RRGGBB` 或 `#RRGGBB`。对数值字段仍应传 `Type:'int'` 或 `Type:'decimal'`，否则 `NumberFormat` 只改变显示格式，不会把文本强制转换成数值。

优先级：列级样式覆盖全局样式；`Width` 覆盖 `DefaultColumnWidth`；开启 `AutoSize` 后以自动宽度为准，再应用 `MinWidth/MaxWidth`。不传这些新参数时保持旧版导出行为。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-002 sha256=c0a4d4c30ecbb2da52a02aab3442cb4e4c76720f19c0001fb8c1d500ba432902 -->
## 文件响应与前端调用约定

- 接口引擎必须开启【响应文件】，并返回正确的 `FileName`、`ContentType`、`FileByteBase64`。
- `V8.Office.ExportExcel/ExportWord/ExportPowerPoint` 返回的是 `DosResult<byte[]>`；先判断 `Code`，再对 `Data` 调用 `System.Convert.ToBase64String`。
- 前端调用 Office 导出接口时，新代码优先使用 `V8.Http.GetResponse/PostResponse`；`V8.Post/V8.Get` 仅用于兼容历史代码，不再作为新代码首选。

### 表头基础配置项

| 字段 | 说明 |
|------|------|
| `Name` | 数据字段名（对应 `ExcelData[i].Name`） |
| `Label` | Excel 列标题 |
| `Component` | 组件类型，决定渲染方式：`Text`/`Select`/`Switch`/`ImgUpload`/`DateTime`/`NumberText` 等 |
| `Config` | 组件配置 JSON 字符串。`ImgUpload.Multiple=1` 时自动生成多列并合并；`Limit=0` 公有桶，`1` 私有桶（需临时URL） |
| `Width/AutoSize/MinWidth/MaxWidth/Hidden` | 列宽、自动宽度限制和隐藏列 |
| `HeaderHeight/RowHeight` | 表头与数据行高（磅）候选值 |
| `NumberFormat/HeaderStyle/Style` | 数字格式与列级样式 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-003 sha256=8c2868406d663d51bbd479c12b052b70ffa1014cc4ec4186b8dcecd0e5a3105b -->
## 解析上传的 Excel（导入）

```javascript
// 接口引擎接收 V8.FilesByteBase64
var filesByteBase64 = V8.FilesByteBase64;
if (!filesByteBase64) return { Code: 0, Msg: '请上传 Excel 文件' };

var base64 = Object.values(filesByteBase64)[0];

// 解析第一张工作表为对象数组
var parsed = V8.Office.ExcelToList({
  FileByteBase64: base64,
  SheetIndex: 0
});
if (parsed.Code !== 1) return parsed;

var dataList = parsed.Data;  // [{ 列标题: 值, ... }, ...]
return { Code: 1, Data: dataList, DataCount: dataList.length };
```

### 固定版式模板与后台自定义导入

默认导入适合首行即字段标题的标准表格。多行表头、合并单元格、项目名称位于固定单元格、或需按规格/材质查询存货等模板，页面按钮使用 `V8.OpenImportDialog({...})` 声明工作表、单元格和列映射；平台弹层负责浏览器解析、后台任务提交、真实进度轮询与结果呈现。

- 页面 V8 只声明 `ApiEngineKey`、`Workbook.Cells/Columns/DataStartRow/DataEndRow/KeyField`，不得拼上传 DOM、传完整工作簿 Base64 或自行轮询。
- 后台接口引擎从 `V8.Param._ImportRowsJson` 和 `_ImportMetaJson` 取值，必须重做模板、权限、字段、唯一性和状态校验。
- 先校验全部行再写入；接口引擎返回 `Code != 1` 时依靠平台事务整体回滚，禁止手动 Commit/Rollback。
- 用 `V8.Method.UpdateBackgroundTask({Current,Total,Msg,Log})` 上报真实校验/写入工作量；未知总量保持不确定进度，不伪造百分比。
- 业务幂等键使用后台任务 Id 或明确的导入操作 Id；重试前回读批次，避免重复写入。

完整前端参数见 `microi.doc/docs/doc/v8-engine/v8-client.md#v8openimportdialog`。

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-excellayout-高级自由布局.md](references/progressive-01-excellayout-高级自由布局.md)：`ExcelLayout` 高级自由布局；多 Sheet Excel 导出；Word 导出
- [references/progressive-02-powerpoint-导出.md](references/progressive-02-powerpoint-导出.md)：PowerPoint 导出；完整导入模式（含进度跟踪）；接收并下载文件（HTTP 链接转 Excel）；子表导入自动关联主表
- [references/progressive-03-安全-性能注意.md](references/progressive-03-安全-性能注意.md)：安全 / 性能注意
<!-- microi-progressive:end -->
