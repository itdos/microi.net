---
name: v8-export-import
description: Microi V8 Office 导入导出指南。用于使用 V8.Office 导出单/多 Sheet Excel、Word、PowerPoint，解析 Excel，自定义表头/图片、文件响应和批量导入校验。
---

# Microi V8 Office 导入导出

你正在为 Microi 吾码平台编写自定义 Excel、Word、PowerPoint 导入/导出代码。平台通过 `V8.Office` 提供 Office 处理能力，源码在 `Microi.Office` 插件中。

文档维护必须优先更新既有后端 V8 主文档 `microi.doc/docs/doc/v8-engine/v8-server.md`，再按需补充已有专题页；不得为同一组 `V8.Office` API 新建重复 Markdown 页面或文档路由。只维护 `microi.doc/docs/doc/` 中文文档，`docs/en/` 由官网统一翻译生成，不手工同步英文版。

## 核心 API

| 方法 | 说明 |
|------|------|
| `V8.Office.ExportExcel({...})` | 自定义导出 `.xlsx`；支持标准表格、高级自由布局、单/多 Sheet、图片、公式、合并、边框、打印和行分组 |
| `V8.Office.ExcelToList({...})` | 解析上传的 Excel 文件为 JSON 数组 |
| `V8.Office.ExportWordText({...})` | 兼容旧版纯文本 Word 导出 |
| `V8.Office.ExportWord({...})` | 导出 `.docx`；支持段落、章节、表格、图片、页眉页脚和页码 |
| `V8.Office.ExportPowerPoint({...})` | 导出 `.pptx`；支持多页、文本、项目符号、表格、图片、主题和页码 |
| `V8.Office.SendEmail({...})` | 发送邮件（HTML 内容） |

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

## `ExcelLayout` 高级自由布局

审批单、套打表、主子表、多级表头和复杂合并单元格不要硬塞入 `ExcelData + ExcelHeader`。改用 `ExcelLayout`：

```javascript
var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelSheets: [{
    SheetName: '审批单',
    ExcelLayout: {
      Cells: [
        // 先给整块区域统一画细网格
        { Range: 'A1:H10', Style: {
          FontName: 'Microsoft YaHei', BorderStyle: 'Thin', BorderColor: '7F8C9A',
          VerticalAlignment: 'Center', WrapText: true
        }},
        // 后写入的非空样式属性叠加/覆盖，可以再加标题和外框
        { Range: 'A1:H1', Value: '盘盈亏及报废申请表', Merge: true, Style: {
          Bold: true, FontSize: 18, HorizontalAlignment: 'Center',
          BorderTopStyle: 'Medium', BorderTopColor: '34495E'
        }},
        { Range: 'A2', Value: '序号', Style: { Bold: true }},
        { Range: 'G2', Value: '数量', Style: { Bold: true }},
        { Range: 'H2', Value: '金额', Style: { Bold: true }},
        { Range: 'A3', Value: 1 },
        { Range: 'G3', Value: 2, DataType: 'Number' },
        { Range: 'H3', Formula: 'G3*1200', Style: { NumberFormat: '#,##0.00' }},
        { Range: 'A8:G8', Value: '合计', Merge: true, Style: { Bold: true, HorizontalAlignment: 'Right' }},
        { Range: 'H8', Formula: 'SUM(H3:H7)', Style: { Bold: true, NumberFormat: '#,##0.00' }},
        { Range: 'A9:D9', Value: '(1) 申请人：张三（已电子签）', Merge: true },
        { Range: 'E9:H9', Value: '(2) 主管意见：同意（已电子签）', Merge: true }
      ],
      MergedRanges: [],
      Columns: [{ Column: 'A', Width: 9 }, { Column: 'H', Width: 16 }],
      Rows: [{ Row: 1, Height: 42 }, { Row: 2, Height: 32 }],
      RowGroups: [{ StartRow: 3, EndRow: 7, Collapsed: false }]
    },
    ExcelOptions: {
      ShowGridLines: false,
      FreezeRows: 2,
      FreezeColumns: 1,
      AutoFilterRange: 'A2:H8',
      PrintOrientation: 'Landscape',
      PaperSize: 'A4',
      FitToWidth: 1,
      PrintArea: 'A1:H10',
      ShowPageNumber: true
    }
  }]
});
```

规则：

- `Range` 使用 `A1` / `A1:K15`，不允许跨 Sheet 的 `Sheet1!A1`；`Value/Formula` 写入左上角，样式作用于全部单元格。
- `Merge:true` 合并当前 `Range`；也可集中传 `MergedRanges`。不完全相同的合并区域不得重叠。
- `DataType` 可传 `String/Number/Boolean/DateTime/Blank`，不传时按值推断；公式可带或不带 `=`。
- `Columns` 用列字母或从 1 开始的 `Index`，支持 `Width/Hidden/AutoSize/MinWidth/MaxWidth`；`Rows.Row`、`RowGroups.StartRow/EndRow` 均从 1 开始。
- 主表/子表使用 `RowGroups` 生成 Excel 原生展开/折叠行，不要只靠缩进文本模拟层级。
- 先给实际数据块统一网格样式，再用小范围样式叠加标题、表头、合计和外框，可以显著减少 V8 代码重复。
- 官方完整接口引擎 `export-excel-advanced-demo` 一次导出 5 Sheet，覆盖截图同款申请单、主子表、复杂合并表头、标准表格和边框样式库。
- 高级布局会为覆盖区域创建真实单元格。不要对整列或百万行套样式；只配置实际使用区域，避免不必要的内存和 CPU。

### 匿名下载与 OnlyOffice 在线预览配套模式

响应文件接口本身可以同时作为浏览器下载地址和 OnlyOffice 文件源：

- `export-excel-advanced-demo` 开启【响应文件】，返回 `FileName/ContentType/FileByteBase64`，可配置 `AllowAnonymous=1` 供客户直接下载。
- `export-excel-advanced-demo-preview` 也开启【响应文件】和【允许匿名】，直接响应同一 `.xlsx`；它的完整 HTTP 地址可以传给 `/online-office?fileUrl=...`。V8 接口不需要先上传 HDFS，也不返回 `FileUrl/OnlineOfficePath` JSON；在线页面会调用后端安全中转，透明缓存到当前租户公有 HDFS 后再交给 OnlyOffice。
- `fileUrl` 必须整体 URL 编码，同时传 `fileName`（或 `fileType`）让 OnlyOffice 确定类型。
- 匿名 `fileUrl` 只能是当前平台正式 `ApiBase`，或同端口本地后端可读取的 loopback `/apiengine/...`；路径或 query 必须显式携带当前 `OsClient`，禁止接受任意外部 URL，避免 SSRF。
- 开发环境传入 `localhost/127.0.0.1` 时，只允许当前同端口后端读取源接口。后端按 URL 与文件名的 SHA-256 使用确定性 `/{OsClient}/office-preview/...` 路径写入公有对象存储，Redis 共享缓存 10 分钟；OnlyOffice 使用公网 `FileServer` 地址。中转限制 50MB、不跟随重定向并校验 Office/PDF 文件头，禁止实现成任意 URL 代理。
- 匿名链接只能用于可公开数据。敏感数据必须关闭匿名调用、上传私有桶，并要求登录后由 `/api/HDFS/OpenPrivateFile` 审计代理提供临时地址。

配套预览接口核心写法：

```javascript
var exportResult = V8.ApiEngine.Run('export-excel-advanced-demo', {});
if (!exportResult || exportResult.Code != 1 || !exportResult.Data || !exportResult.Data.FileByteBase64) {
  V8.Result = exportResult && exportResult.Code != 1
    ? exportResult
    : { Code: 0, Msg: 'Excel 生成失败' };
  return;
}
// 当前接口配置：AllowAnonymous=1、ResponseFile=1、StopHttp=0。
V8.Result = exportResult;
```

预览 URL 形式：`/?OsClient=tenant_demo#/online-office?fileUrl=<URL编码后的接口地址>&fileName=示例.xlsx&fileType=xlsx&canEdit=0`。`canEdit` 只是编辑申请，不是授权依据；未登录时即使传 `canEdit=1` 也必须强制只读，并隐藏左侧菜单、顶部导航和页签。公网匿名文件接口应配置频率限制或让导出逻辑足够轻量，不能依赖进程内变量控制并发。

## 多 Sheet Excel 导出

`ExcelSheets` 中每项是一张独立工作表，可以使用 `ExcelLayout` 高级布局，也可以传 `ExcelData + ExcelHeader` 标准表格；标准表格还可传 `FormEngineKey`、查询条件等让后端自行查询。两种模式可以在同一工作簿混用。`Sheets` 是兼容别名；新代码统一使用 `ExcelSheets`。

```javascript
var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelOptions: {
    DefaultColumnWidth: 14,
    HeaderRowHeight: 28,
    HeaderStyle: { Bold: true, BackgroundColor: 'D9EAF7' }
  },
  ExcelSheets: [
    {
      SheetName: '订单',
      ExcelData: orderList,
      ExcelHeader: [
        { Name: 'OrderNo', Label: '订单号', Component: 'Text', Width: 22 },
        { Name: 'Amount', Label: '金额', Component: 'NumberText', Type: 'decimal', Width: 16, NumberFormat: '#,##0.00' }
      ],
      ExcelOptions: { FreezeHeader: true, AutoFilter: true }
    },
    {
      SheetName: '客户',
      ExcelData: customerList,
      ExcelHeader: [
        { Name: 'Name', Label: '客户名称', Component: 'Text', Width: 24 },
        { Name: 'Phone', Label: '联系电话', Component: 'Text', Width: 18 }
      ],
      ExcelOptions: { DataRowHeight: 22 }
    }
  ]
});
if (excelResult.Code !== 1) return excelResult;

return {
  Code: 1,
  Data: {
    FileName: '业务数据.xlsx',
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    FileByteBase64: System.Convert.ToBase64String(excelResult.Data)
  }
};
```

`SheetName` 会自动处理 Excel 非法字符、31 字符上限和重名。未传 `ExcelHeader` 时，可以在每个 Sheet 中传 `TableId`、`FormEngineKey`、`_Where`、`_OrderBy`、`_PageSize` 等查询参数，并继承外层的 `OsClient`、`TableId`、`_SysMenuId` 等默认值。外层 `ExcelOptions` 也是所有 Sheet 的默认值；Sheet 内的 `ExcelOptions` 只覆盖已传属性。

图片列：`ImgUpload.Multiple=1` 会按最大图片数展开为多列并合并表头；列上的 `Width` 会应用到每个展开列，`DataRowHeight/RowHeight` 控制图片行高。自动列宽会遍历单元格，大批量导出不要对所有列盲目开启。

## Word 导出

新代码使用对象参数的 `ExportWord`；`ExportWordText` 继续保留，只用于兼容旧版纯文本场景。Word 的页面边距、图片宽高单位为厘米，字体大小单位为磅。

```javascript
var wordResult = V8.Office.ExportWord({
  Title: '月度经营报告',
  Subtitle: DateNow('yyyy年MM月'),
  Author: V8.CurrentUser.Name,
  Subject: '经营分析',
  Keywords: '经营,月报',
  PageSize: 'A4',                 // A4 | Letter
  Orientation: 'Portrait',       // Portrait | Landscape
  MarginTop: 2.2,
  MarginRight: 2.0,
  MarginBottom: 2.2,
  MarginLeft: 2.0,
  FontFamily: 'Microsoft YaHei',
  FontSize: 10.5,
  TitleFontSize: 20,
  HeaderText: '吾码经营中心',
  FooterText: '内部资料',
  ShowPageNumber: true,
  Paragraphs: [
    { Text: '本月经营情况总体稳定。', FirstLineIndent: 0.74 },
    { Text: '以下数据未经授权不得外传。', Bold: true, FontColor: 'C00000' }
  ],
  Sections: [{
    Heading: '一、核心指标',
    HeadingLevel: 1,
    Content: '本节展示主要经营指标。',
    Tables: [{
      Title: '指标明细',
      Headers: ['指标', '本月', '同比'],
      Rows: [['销售额', 1280000, '12.5%'], ['订单数', 860, '8.1%']],
      ColumnWidths: [4, 4, 4],
      HeaderBackgroundColor: 'D9EAF7'
    }]
  }],
  Images: [{
    FileByteBase64: chartBase64,  // 支持纯 Base64 或 data URI
    FileName: 'chart.png',
    ContentType: 'image/png',
    Width: 15,
    Height: 8,
    Alignment: 'Center',
    Caption: '图 1：趋势分析'
  }]
});
if (wordResult.Code !== 1) return wordResult;
return {
  Code: 1,
  Data: {
    FileName: '月度经营报告.docx',
    ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    FileByteBase64: System.Convert.ToBase64String(wordResult.Data)
  }
};
```

段落支持 `Text/Alignment/Bold/Italic/Underline/FontFamily/FontSize/FontColor/SpacingBefore/SpacingAfter/LineSpacing/FirstLineIndent/PageBreakBefore`。章节支持 `Heading/HeadingLevel/Content/Paragraphs/Tables/Images/PageBreakBefore`；表格支持 `Headers/Rows/ColumnWidths/Alignment/HeaderBold/HeaderBackgroundColor/HeaderFontColor/BorderColor/FontSize`。

## PowerPoint 导出

PowerPoint 的幻灯片尺寸、图片/表格位置与宽高单位均为英寸，默认画布为 16:9（13.333 × 7.5）。

```javascript
var pptResult = V8.Office.ExportPowerPoint({
  Title: '季度经营汇报',
  Author: V8.CurrentUser.Name,
  Subject: '季度复盘',
  Company: '吾码',
  SlideWidth: 13.333,
  SlideHeight: 7.5,
  FontFamily: 'Microsoft YaHei',
  BackgroundColor: 'FFFFFF',
  TitleColor: '17365D',
  TextColor: '222222',
  TitleFontSize: 28,
  BodyFontSize: 18,
  ShowSlideNumber: true,
  Slides: [
    {
      Layout: 'TitleSlide',
      Title: '季度经营汇报',
      Subtitle: DateNow('yyyy-MM-dd')
    },
    {
      Layout: 'TitleAndContent',
      Title: '核心结论',
      Bullets: ['收入保持增长', '重点客户续约稳定'],
      TextItems: [
        { Text: '风险：回款周期延长', Bullet: true, Level: 0, Bold: true, FontColor: 'C00000' }
      ],
      Tables: [{
        Headers: ['指标', '本期', '目标'],
        Rows: [['销售额', '128万', '120万']],
        X: 0.7, Y: 4.0, Width: 11.9, Height: 2.2,
        HeaderBackgroundColor: '17365D'
      }]
    },
    {
      Title: '趋势图',
      Images: [{
        FileByteBase64: chartBase64,
        FileName: 'trend.png',
        ContentType: 'image/png',
        X: 1.2, Y: 1.5, Width: 10.9, Height: 5.2
      }]
    }
  ]
});
if (pptResult.Code !== 1) return pptResult;
return {
  Code: 1,
  Data: {
    FileName: '季度经营汇报.pptx',
    ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    FileByteBase64: System.Convert.ToBase64String(pptResult.Data)
  }
};
```

`Layout` 支持 `TitleSlide`、`TitleAndContent`。单页支持独立覆盖 `BackgroundColor/TitleColor/TextColor/TitleFontSize/BodyFontSize`。`TextItems` 支持 `Text/Level/Bullet/Bold/Italic/FontSize/FontColor/Alignment`；表格支持位置、尺寸、列宽、表头/单元格颜色；图片支持 Base64/data URI、位置和尺寸。

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

## 完整导入模式（含进度跟踪）

模块引擎【导入接口替换】+【导入进度接口替换】可实现实时进度提示。

### 导入接口（替换默认导入）

```javascript
if (!V8.Param.TableId) {
  return { Code: 0, Msg: '必须指定 TableId 标记当前导入哪张表' };
}

var importingKey = 'Microi:' + V8.OsClient + ':ImportTableDataStart:' + V8.Param.TableId;
var stepKey      = 'Microi:' + V8.OsClient + ':ImportTableDataStep:'  + V8.Param.TableId;

// 防止重复导入
if (V8.Cache.Get(importingKey) === '1') {
  return { Code: 0, Msg: '有数据正在导入中，请稍后再试' };
}
V8.Cache.Set(importingKey, '1');

var stepList = [];
function pushStep(msg) {
  stepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + '：' + msg);
  V8.Cache.Set(stepKey, JSON.stringify(stepList));
}

pushStep('正在读取文件数据...');

// 解析 Excel
var base64 = Object.values(V8.FilesByteBase64)[0];
var parsed = V8.Office.ExcelToList({ FileByteBase64: base64, SheetIndex: 0 });
if (parsed.Code !== 1) {
  V8.Cache.Set(importingKey, '0');
  pushStep('文件解析失败：' + parsed.Msg);
  return parsed;
}

pushStep('已读取【' + parsed.Data.length + '】条数据');
pushStep('已导入【0】条数据...');

// 循环导入
for (var i = 0; i < parsed.Data.length; i++) {
  var row = parsed.Data[i];
  // 字段映射 / 校验
  row.AAA = 111;

  var addResult = V8.FormEngine.AddFormData(V8.Param.TableName, row, V8.DbTrans);
  if (addResult.Code !== 1) {
    V8.Cache.Set(importingKey, '0');
    pushStep('导入第 ' + (i + 1) + ' 条出错：' + addResult.Msg + '（已回滚）');
    return { Code: 0, Msg: addResult.Msg };  // 平台自动回滚事务
  }
  // 覆盖最后一条进度
  stepList[stepList.length - 1] = DateNow('yyyy-MM-dd HH:mm:ss') + '：已导入【' + (i + 1) + '】条';
  V8.Cache.Set(stepKey, JSON.stringify(stepList));
}

pushStep('导入成功，已结束');
V8.Cache.Set(importingKey, '0');
return { Code: 1, Data: { Imported: parsed.Data.length } };
```

### 导入进度查询接口

```javascript
if (!V8.Param.TableId) return { Code: 0, Msg: '需要 TableId' };
var stepStr = V8.Cache.Get('Microi:' + V8.OsClient + ':ImportTableDataStep:' + V8.Param.TableId);
return { Code: 1, Data: stepStr ? JSON.parse(stepStr) : [] };
```

## 接收并下载文件（HTTP 链接转 Excel）

```javascript
// 从 URL 下载图片插入 Excel 等场景
var resp = V8.Http.GetResponse({
  Url: 'https://static.itdos.com/path/file.png'
});
var bytes = resp.RawBytes;            // .NET byte[]
var base64 = System.Convert.ToBase64String(bytes);
```

## 子表导入自动关联主表

当单独导入 `TableChild` 子表时，Excel 经常没有主表 Id，只带项目编号、客户名称等业务字段。默认导入引擎支持通过子表控件配置批量反查主表，并自动补齐子表外键。

本节只适用于“主表 1:N 子表”；单条独立记录关联应使用 `JoinForm`，不能把明细导入模型
设计成 `JoinForm`。在主表 `TableChild` 字段的 `Config` 中配置，其中子表、菜单和外键
位于 Config 根节点，导入选项位于 `Config.TableChild`：

```json
{
  "TableChildTableId": "子表 diy_table.Id",
  "TableChildSysMenuId": "子表 sys_menu.Id",
  "TableChildSysMenuName": "项目成品清单",
  "TableChildFkFieldName": "XiangmuId",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "ImportAutoFillFk": true,
    "FieldRelations": [
      ["Code", "XiangmuBM", true],
      ["Name", "XiangmuMC"]
    ]
  }
}
```

配置含义：

- 根节点 `TableChildTableId` / `TableChildSysMenuId` / `TableChildFkFieldName` 必须是
  回读后的真实子表、隐藏子菜单和子表物理外键，不能猜 Id，也不能放进内层
  `Config.TableChild`。
- `ImportAutoFillFk`：是否在导入子表时自动补齐 Config 根节点指定的
  `TableChildFkFieldName`；默认建议开启。
- `FieldRelations`：每项为 `[主表字段, 子表/Excel字段, 是否参与导入匹配]`。全部关系用于新增回写和导入回填；第三位为 `true` 的关系用于反查主表，多项为 `true` 时作为组合条件匹配。
- 不要把所有回填关系都标为 `true`。例如 Excel 只保证有项目编号时，`["Code","XiangmuBM",true]` 负责匹配，`["Name","XiangmuMC"]` 只在找到主表后补名称。
- 后端继续读取旧版 `ImportParentMatchFieldName` / `ImportChildMatchFieldName`、`ImportRelations`、`ImportBackfillFields` 和根节点 `TableChildCallbackField`；新版前端会合并去重为 `FieldRelations`，并在字段下次保存时清除旧键。

运行规则：

- 只有子表外键为空时才补齐；Excel 已传外键时不覆盖。
- `FieldRelations` 回填只有在子表对应字段为空时才写入；Excel 已传该字段值时不覆盖。
- 导入前按业务字段批量查询主表，避免逐行查询。
- 从主表表单内、左右树形页面或 `V8.OpenAnyTable` 带主表条件打开子表后导入时，即使 Excel 没有匹配字段，也可以通过固定主表 Id 查询主表并回填子表外键和全部 `FieldRelations`。
- 如果业务字段为空、主表找不到或匹配到多条主表，当前行不自动补齐，并写入导入进度/后台日志，避免错误关联。
- 示例：项目主表 `xiangmuguanli.Code` 匹配用料清单 `yongliaoqqingdan.XiangmuBM`，自动写入 `yongliaoqqingdan.XiangmuID`。
- 示例：项目主表 `xiangmuguanli.Name` 回填成品清单 `xiangmugoujianqd.XiangmuMC`，保证导入模板缺少项目名称列时列表仍显示正常。

## 安全 / 性能注意

- ❌ 不要在循环中逐条 `AddFormData` 而不传 `V8.DbTrans`：每条独立事务，性能差且部分失败会留脏数据
- ✅ 传 `V8.DbTrans` 让所有插入在同一事务，失败自动回滚
- ✅ 大文件（>1万行）建议拆批 `AddTableData` 批量插入
- ✅ 校验字段长度、类型、必填，防脏数据
- ✅ 接口引擎要返回文件，必须在配置中开启【响应文件】
- ✅ 进度 Key 用 `Microi:${V8.OsClient}:Category:Key` 命名，区分租户

### 复盘：应用包同步物理字段时直接 ALTER 导致安装异常

- 触发场景：目标租户安装或升级应用包时，已有长文本配置超过来源包的 `varchar(N)` 长度，或历史数值字段仍以空字符串保存，`MODIFY COLUMN` 分别报 `Data too long`、`Incorrect integer value: ''`。
- 根因：导入器把来源库物理字段定义直接覆盖到目标库，没有判断是否属于缩窄变更，也没有在文本转数值前兼容平台历史空值。
- 通用规则：物理字段同步必须只扩宽、不缩窄；目标库已有更宽文本类型或更大整数类型时保留目标类型。文本转数值前仅可把空字符串规范为 `NULL`，发现非空非数字值必须中止该字段迁移并报告数量，禁止静默转为 `0` 或截断数据。只要导入日志存在异常，就不得写入“安装成功”的应用版本记录。
- 自动化检查：准备“超长 JSON + 空字符串数值 + 非数字脏值”三类旧库样本，重复安装同一应用包；前两类应无异常且数据不丢失，第三类应明确失败且原数据保持不变。

### 复盘：重复字段与业务 Key 改名破坏应用包幂等安装

- 触发场景：应用包中同一张表出现两个同名字段时，第一次 `ADD COLUMN` 成功、第二次报 `Duplicate column name`；在线应用保留原 Id 但修改 `AppKey/MsKey` 后，目标库按新 Key 查不到记录，又用原 Id 执行 INSERT，报主键重复。
- 根因：安装器只在阶段开始时读取一次物理字段快照，新增后没有更新；同时只按业务 Key 判断在线应用是否存在，没有优先按稳定 Id 对齐，也没有迁移旧 Key 关联的微服务和页面。
- 通用规则：包内字段必须按 `TableId + lower(Name)` 去重，新增物理列后立刻更新内存快照；并发或历史残留造成的重复列错误需回查后按幂等跳过。在线应用、微服务及版本数据必须先按 Id、再按业务 Key 查找；Id 命中而 Key 变化时更新原记录并沿用原 Id，把关联页面统一迁移到新 Key，禁止再次 INSERT。
- 自动化检查：构造“同表重复字段”和“固定 AppId、AppKey 从 old-key 改为 new-key”两个包，连续安装至少两次；每次都应 `Code=1`，物理列、应用、微服务均只有一条，所有页面引用新 Key 且保留原关联 Id。

### 复盘：租户历史残留绕过 FormEngine 查询后触发主键和重命名冲突

- 触发场景：同一应用包在平台主租户、平台子租户和客户独立部署中表现不同；字段导入报 `diy_field.PRIMARY` 重复，字段改名报目标物理列已存在，旧版微服务包还可能调用不存在的 ZIP 哈希函数。
- 根因：导入器只用 FormEngine 判断记录是否存在，软删除、空 OsClient 或历史异常记录会被过滤，但物理主键仍在；字段重命名只判断元数据变化，没有在 DDL 前分别检查源列和目标列；修复只写入某个租户接口引擎，没有让全局升级器按导入器能力重新刷新。
- 通用规则：元数据 UPSERT 必须在 FormEngine 未命中时直查物理主键；同一逻辑字段应恢复后更新，真正的 Id 冲突应生成目标 Id 并建立包内引用映射。执行 `CHANGE COLUMN` 前必须检查源列存在且目标列不存在，目标列已存在时按幂等跳过。导入器修复必须同时更新官方资源、目标租户和自动升级能力检测，禁止只依赖全局版本号。
- 自动化检查：准备软删除主键、空租户主键、同表目标列已存在、旧导入器函数缺失四类租户快照；连续安装系统设置、首页数据包和含源码 ZIP 的微服务包两次，均应 `Code=1` 且版本记录只反映无异常安装。再把全局版本号设为高于修复版本、导入器降级，验证启动升级仍会按能力标记自动恢复导入器且不降低全局版本号。

### 复盘：数据库空库导出日期区域化且导入器吞错导致延迟误报

- 触发场景：空库 SQL 把 MySQL `datetime` 导出成 `05/12/2026 12:50:33` 等区域格式；导入器逐句执行时跳过或吞掉失败语句，后续初始化才误报“缺少默认 admin 用户”。
- 根因：导出器只按 CLR 返回类型格式化，没有以 `information_schema.COLUMNS.DATA_TYPE` 为事实源；导入器把局部失败计数后仍返回成功，也没有在导入结束立即校验核心表和模板账号。
- 通用规则：数据库转储必须按真实物理列类型格式化 `date/datetime/timestamp`，统一输出 ISO 日期；完整 SQL 导入任一语句失败必须整体失败并保留原始数据库错误，禁止吞错继续。导入完成后立即校验核心表和模板账号，后端读取最新发布包时优先直读对象存储，避免 CDN 长缓存返回旧包。
- 自动化检查：制作并发布空库后校验 ZIP 哈希、SQL 中区域日期匹配数为 0、核心表和默认 `admin` 存在；再从真实注册页创建新租户，并使用新租户 `admin` 的初始密码登录一次，不能只验证发布任务或租户记录返回成功。
