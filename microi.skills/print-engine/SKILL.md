---
name: print-engine
description: 生成和审查 Microi 打印引擎 Print Engine 模板 JSON。用于创建 mic_print 模板、PageObj 布局、PrintObj 数据绑定、可打印报告、标签或合同。
---

# Microi 打印引擎（Print Engine）模板 JSON 生成

你正在为 Microi 吾码平台生成打印引擎模板的 JSON 数据。打印模板包含 PageObj（模板定义）和 PrintObj（打印数据）。

## 设计器源码事件

扩展打印设计器源码时，可通过 `EventBus.on('savePrintJson', handler)` 接收
保存后的模板 JSON，并在组件卸载时调用 `EventBus.off('savePrintJson')`。
这是设计器内部生命周期接口，不属于运行时打印模板 JSON，也不能替代模板的
服务端保存与回读。

## 与蓝牙直连打印的边界

本 Skill 负责 `mic_print`、`PageObj`、`PrintObj`、浏览器预览和模板化纸张输出。
如果需求明确是蓝牙标签机/小票机、TSC/TSPL、ESC/POS 或
`V8.Print.prepareSend`，应同时读取
`../v8-frontend-events/references/bluetooth-print.md`：

- Print Engine 决定“页面/模板如何排版”，适合 A4、PDF、浏览器打印和统一模板。
- `V8.Print` 生成打印机原生命令并通过 BLE 写特征，适合标签和热敏小票。
- 两者可以由同一个按钮按设备能力选择，但不能把 `PageObj` 直接交给
  `V8.Print.prepareSend`，也不能把 TSC/ESC 字节当作 Print Engine JSON。

## 数据模型

打印模板存储在 `mic_print` 表中：

| 字段 | 说明 |
|------|------|
| PageObj | 页面模板定义（面板 + 元素布局） |
| PrintObj | 打印数据（运行时填充到模板中） |
| DataApi | 关联的接口引擎 Id（动态数据） |

### `mic_print` 权限边界

- `mic_print` 是按角色管理的运行资源，不是只能由 `Level >= 9999` 读取的控制面表。打印渲染器通过 FormEngine 读取模板时，当前角色必须拥有菜单权限或高级表权限中的 `Read`；否则应明确返回 `NoAuth`，不能为兼容改成匿名读取。
- 模板新增、修改、删除分别要求明确的 `Add`、`Edit`、`Del`。只需要打印的业务角色通常只授予 `Read`，不要顺带授予设计权限。
- 角色授权界面只负责展示服务端策略。角色增删改接口必须从主库复核当前操作者确为活动平台管理员，不能相信 Postman 请求体中的 `_IsAdmin`、`Level`、`RoleIds` 或 `OsClient`。

## PageObj 模板结构

```json
{
  "panels": [{
    "index": 0,
    "name": "面板名称",
    "height": 297,          // mm，A4=297
    "width": 210,           // mm，A4=210
    "paperType": "A4",
    "paperHeader": 49.5,    // 页眉底部位置（pt）
    "paperFooter": 780,     // 页脚顶部位置（pt）
    "printElements": []
  }]
}
```

### 常用纸张尺寸

| 纸张 | 宽(mm) | 高(mm) |
|------|--------|--------|
| A3 | 297 | 420 |
| A4 | 210 | 297 |
| A5 | 148 | 210 |
| B4 | 257 | 364 |
| B5 | 182 | 257 |

### 坐标系统
- 单位：pt（磅，约 0.35mm）
- 原点：面板左上角 (0, 0)
- 栅格间距默认 7.5pt
- A4 可用宽度约 571.5pt

## 元素类型

### text — 文本元素

```json
{
  "options": {
    "left": 60, "top": 30, "height": 13, "width": 120,
    "title": "静态文本",
    "field": "fieldName",
    "testData": "预览数据",
    "fontSize": 10.5,           // pt，9=小五, 10.5=五号, 12=小四, 14=四号
    "fontFamily": "微软雅黑",    // SimSun(宋体), SimHei(黑体), KaiTi(楷体)
    "fontWeight": "600",         // 400=常规, 600=半粗, 700=粗
    "color": "#333333",
    "textAlign": "left",         // left/center/right/justify
    "textContentVerticalAlign": "middle",  // top/middle/bottom
    "lineHeight": 18,
    "hideTitle": false,          // field绑定时仅显示值
    "fixed": false
  },
  "printElementType": { "type": "text" }
}
```

### table — 表格元素

```json
{
  "options": {
    "left": 30, "top": 150, "height": 56, "width": 511.5,
    "field": "tableData",
    "columns": [[
      { "title": "编号", "field": "id", "width": 80, "align": "center" },
      { "title": "名称", "field": "name", "width": 150, "align": "left" },
      { "title": "金额", "field": "amount", "width": 100, "align": "right", "tableSummary": "sum" }
    ]]
  },
  "printElementType": { "type": "table" }
}
```

列属性：`title`, `field`, `width`(pt), `align`, `colspan`, `rowspan`, `checked`, `tableSummary`(count/sum/avg)

### image — 图片

```json
{
  "options": {
    "left": 60, "top": 30, "height": 80, "width": 80,
    "field": "logoUrl",
    "src": "默认图片URL",
    "fit": "contain"           // contain/cover/fill/scale
  },
  "printElementType": { "type": "image" }
}
```

### longText — 长文本（自动分页）

```json
{
  "options": {
    "left": 30, "top": 100, "height": 40, "width": 511.5,
    "field": "contractContent",
    "testData": "长文本预览...",
    "fontSize": 10.5, "lineHeight": 18
  },
  "printElementType": { "type": "longText" }
}
```

### html — 自定义 HTML

```json
{
  "options": {
    "left": 30, "top": 200, "height": 80, "width": 300,
    "formatter": "function(t, e, d) { return '<div>' + (d.customField || '') + '</div>'; }"
  },
  "printElementType": { "type": "html" }
}
```

### 条形码 / 二维码

```json
// 条形码（text + textType）
{ "options": { "field": "barcodeNo", "testData": "XS888888888", "textType": "barcode", "hideTitle": true }, "printElementType": { "type": "text" } }
// 二维码
{ "options": { "field": "qrcodeUrl", "testData": "https://microi.net", "textType": "qrcode" }, "printElementType": { "type": "text" } }
// SVG 版本（矢量不失真）
{ "printElementType": { "type": "barcode" } }
{ "printElementType": { "type": "qrcode" } }
```

### 辅助图形

```json
// 水平线
{ "options": { "left": 30, "top": 80, "height": 9, "width": 511.5, "borderStyle": "solid", "borderWidth": 0.75 }, "printElementType": { "type": "hline" } }
// 垂直线
{ "printElementType": { "type": "vline" } }
// 矩形
{ "printElementType": { "type": "rect" } }
// 椭圆
{ "printElementType": { "type": "oval" } }
```

## PrintObj 打印数据

```json
{
  "companyName": "吾码科技有限公司",
  "orderNo": "ORD-2024-001",
  "items": [
    { "id": "1", "name": "商品A", "qty": "10", "price": "100", "total": "1000" }
  ]
}
```

**绑定规则：**
- 简单字段：元素 `field: "companyName"` → `PrintObj.companyName`
- 表格数据：表格 `field: "items"` → `PrintObj.items`（数组），列 `field: "name"` → `items[i].name`
- 图片：`field: "logoUrl"` → URL 或 Base64
- 条形码/二维码：`field` + `textType` 自动渲染

## 表格函数属性

| 属性 | 函数签名 | 说明 |
|------|----------|------|
| formatter2 | `function(title, field, row, index, options)` | 单元格渲染 |
| styler2 | `function(value, row, index, options)` | 单元格样式 |
| rowStyler | `function(row, index, options)` | 行样式 |
| footerFormatter | `function(options, rows, data, el)` | 表尾渲染 |
| tableSummaryFormatter | `function(column, data)` | 合计行渲染 |

## 生成模板最佳实践

1. **坐标计算**：A4 可用宽度约 571.5pt，从 left=30 开始留白
2. **元素间距**：垂直间距 15-22.5pt
3. **表格列宽**：所有列宽之和应等于表格 width
4. **field 命名**：camelCase，与 PrintObj 键名一致
5. **testData**：每个绑定字段必须提供 testData
6. **PrintObj 值**：所有字段值应为字符串类型

### 常用布局

- **标题区（top: 15-60）**：居中大字号标题 + hline 分隔 + 右上角二维码/LOGO
- **信息区（top: 60-120）**：单号、日期、客户信息
- **数据区（top: 120+）**：表格元素，自动分页
- **签章区（靠近页脚）**：签名线、日期线、印章图片

## 接口引擎集成

`DataApi` 字段关联接口引擎，返回的 `Data` 对象直接作为 PrintObj 注入模板：

```javascript
return {
  Code: 1,
  Data: {
    orderNo: "ORD-2024-001",
    items: [{ seq: "1", name: "商品A", qty: "10", price: "100", total: "1000" }]
  }
};
```
