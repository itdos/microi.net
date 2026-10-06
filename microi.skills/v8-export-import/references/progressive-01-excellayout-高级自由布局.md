# v8-export-import 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-export-import-004 sha256=828669707ddc19320767ac4b787383136ec820deb6ad1dc861b42b5d39097677 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-005 sha256=401c2cd0a4b9ea45b1709d14277cf71d74ab29dcda72d404f452a0e67b56eddc -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-006 sha256=1a74f8359e67ca4b270de414000f8416a7564c1595189c091281d0fea6dd4a45 -->
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

<!-- /microi-progressive:chunk -->
