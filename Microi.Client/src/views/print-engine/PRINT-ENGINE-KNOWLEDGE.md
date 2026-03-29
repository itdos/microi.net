# Microi 打印引擎知识库 — AI 生成打印模板 JSON 指南

> 此知识库用于指导 AI 根据用户需求自动生成打印引擎的 PageObj（模板JSON）和 PrintObj（打印数据JSON）。

---

## 1. 数据模型概览

打印引擎的数据存储在 `mic_print` 表中，每条记录代表一个打印模板。

| 字段 | 类型 | 说明 |
|------|------|------|
| Id | string | 模板唯一标识 |
| Title | string | 模板标题 |
| Number | string | 模板编号（自动生成） |
| Desc | string | 模板描述 |
| DataApi | string | 关联的接口引擎 Id（用于动态数据） |
| PageObj | JSON string | 页面模板定义（面板 + 元素布局） |
| PrintObj | JSON string | 打印数据（运行时填充到模板中） |

---

## 2. PageObj 模板结构

PageObj 是打印模板的核心，定义了页面面板和所有可打印元素的布局。

```json
{
  "panels": [
    {
      "index": 0,
      "name": "面板名称",
      "height": 297,
      "width": 210,
      "paperType": "A4",
      "paperHeader": 49.5,
      "paperFooter": 780,
      "paperNumberContinue": false,
      "printElements": []
    }
  ]
}
```

### Panel 面板属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| index | number | 是 | 面板序号（从0开始） |
| name | string | 否 | 面板名称 |
| height | number | 是 | 页面高度（mm），A4=297, A3=420 |
| width | number | 是 | 页面宽度（mm），A4=210, A3=297 |
| paperType | string | 否 | 纸张类型：A3, A4, A5, B3, B4, B5, Letter, Legal |
| paperHeader | number | 否 | 页眉区域底部位置（pt） |
| paperFooter | number | 否 | 页脚区域顶部位置（pt） |
| paperNumberContinue | boolean | 否 | 续页时是否继续页码编号 |
| printElements | array | 是 | 该面板上的所有打印元素 |

### 常用纸张尺寸

| 纸张 | 宽度(mm) | 高度(mm) |
|------|----------|----------|
| A3 | 297 | 420 |
| A4 | 210 | 297 |
| A5 | 148 | 210 |
| B4 | 257 | 364 |
| B5 | 182 | 257 |
| Letter | 216 | 279 |
| 自定义 | 自由设定 | 自由设定 |

---

## 3. 打印元素 (PrintElement)

每个元素包含 `options`（配置属性）和 `printElementType`（元素类型定义）。

```json
{
  "options": { /* 元素具体配置 */ },
  "printElementType": {
    "type": "text",
    "title": "文本"
  }
}
```

### 坐标系统

- 单位：pt（磅，约 0.35mm）
- 原点：面板左上角 (0, 0)
- `left`：元素左边距离面板左边的距离
- `top`：元素上边距离面板上边的距离
- 栅格间距默认为 7.5pt

---

## 4. 元素类型详解

### 4.1 文本元素 (text)

用于显示静态文本或绑定动态字段数据。

```json
{
  "options": {
    "left": 60,
    "top": 30,
    "height": 13,
    "width": 120,
    "title": "静态文本内容",
    "field": "fieldName",
    "testData": "预览测试数据",
    "fontSize": 10.5,
    "fontFamily": "微软雅黑",
    "fontWeight": "600",
    "color": "#333333",
    "textAlign": "left",
    "textContentVerticalAlign": "middle",
    "lineHeight": 18,
    "backgroundColor": "",
    "textDecoration": "",
    "borderStyle": "",
    "borderWidth": 0.75,
    "borderColor": "#000",
    "hideTitle": false,
    "fixed": false,
    "contentPaddingTop": 0,
    "contentPaddingLeft": 0
  },
  "printElementType": { "type": "text" }
}
```

**属性说明：**

| 属性 | 类型 | 说明 |
|------|------|------|
| title | string | 静态文本内容（无 field 绑定时显示） |
| field | string | 绑定 PrintObj 中的字段名 |
| testData | string | 设计器预览时的测试数据 |
| fontSize | number | 字号（pt），常用：9=小五, 10.5=五号, 12=小四, 14=四号 |
| fontFamily | string | 字体：微软雅黑, SimSun(宋体), SimHei(黑体), KaiTi(楷体) |
| fontWeight | string | 字重：400(常规), 600(半粗), 700(粗) |
| color | string | 文字颜色（十六进制） |
| textAlign | string | 水平对齐：left / center / right / justify |
| textContentVerticalAlign | string | 垂直对齐：top / middle / bottom |
| lineHeight | number | 行高（pt） |
| hideTitle | boolean | 隐藏标签文字（field绑定时仅显示值） |
| fixed | boolean | 固定位置（不随内容流动） |

### 4.2 表格元素 (table)

用于显示绑定的数组数据。

```json
{
  "options": {
    "left": 30,
    "top": 150,
    "height": 56,
    "width": 511.5,
    "field": "tableData",
    "fields": [
      { "text": "编号", "field": "id" },
      { "text": "名称", "field": "name" },
      { "text": "数量", "field": "count" },
      { "text": "金额", "field": "amount" }
    ],
    "columns": [
      [
        { "title": "编号", "field": "id", "width": 80, "align": "center" },
        { "title": "名称", "field": "name", "width": 150, "align": "left" },
        { "title": "数量", "field": "count", "width": 80, "align": "right", "tableSummary": "sum" },
        { "title": "金额", "field": "amount", "width": 100, "align": "right", "tableSummary": "sum" }
      ]
    ],
    "editable": true,
    "columnDisplayEditable": true,
    "columnTitleEditable": true,
    "columnResizable": true,
    "columnAlignEditable": true,
    "isEnableEditField": true,
    "isEnableContextMenu": true,
    "isEnableInsertRow": true,
    "isEnableDeleteRow": true,
    "isEnableInsertColumn": true,
    "isEnableDeleteColumn": true,
    "isEnableMergeCell": true
  },
  "printElementType": { "type": "table" }
}
```

**columns 列定义：**

| 属性 | 类型 | 说明 |
|------|------|------|
| title | string | 列标题 |
| field | string | 绑定 PrintObj 数组元素中的字段名 |
| width | number | 列宽（pt） |
| align | string | 对齐方式：left / center / right |
| colspan | number | 合并列数（默认1） |
| rowspan | number | 合并行数（默认1） |
| checked | boolean | 是否可见（默认 true） |
| tableSummary | string | 汇总方式：count / sum / avg |

**表格函数属性（可选，字符串形式的 JS 函数）：**

| 属性 | 函数签名 | 说明 |
|------|----------|------|
| formatter2 | `function(title, field, row, index, options)` | 单元格渲染 |
| styler2 | `function(value, row, index, options)` | 单元格样式 |
| renderFormatter | `function(el, data)` | 自定义表格渲染 |
| stylerHeader | `function(value, options)` | 表头样式 |
| rowStyler | `function(row, index, options)` | 行样式 |
| footerFormatter | `function(options, rows, data, el)` | 表尾渲染 |
| tableSummaryFormatter | `function(column, data)` | 合计行渲染 |
| groupFormatter | `function(group, index, options)` | 分组头渲染 |
| groupFooterFormatter | `function(group, index, options)` | 分组尾渲染 |

### 4.3 图片元素 (image)

```json
{
  "options": {
    "left": 60,
    "top": 30,
    "height": 80,
    "width": 80,
    "field": "logoUrl",
    "src": "https://example.com/default-logo.png",
    "title": "公司Logo",
    "fit": "contain"
  },
  "printElementType": { "type": "image" }
}
```

| 属性 | 说明 |
|------|------|
| src | 默认图片URL（field未绑定或数据为空时显示） |
| field | 绑定 PrintObj 中的图片 URL 字段 |
| fit | 缩放模式：contain / cover / fill / scale |

### 4.4 长文本元素 (longText)

自动分页的长文本，适合段落、合同条款等。

```json
{
  "options": {
    "left": 30,
    "top": 100,
    "height": 40,
    "width": 511.5,
    "field": "contractContent",
    "testData": "这里是长文本预览内容...",
    "fontSize": 10.5,
    "lineHeight": 18
  },
  "printElementType": { "type": "longText" }
}
```

### 4.5 HTML 元素 (html)

通过 `formatter` 函数返回自定义 HTML。

```json
{
  "options": {
    "left": 30,
    "top": 200,
    "height": 80,
    "width": 300,
    "formatter": "function(t, e, d) {\n  return '<div style=\"color:red\">' + (d.customField || '默认值') + '</div>';\n}"
  },
  "printElementType": { "type": "html" }
}
```

**formatter 参数：**
- `t`：PrintElement 对象
- `e`：当前元素
- `d`：PrintObj 数据对象（可通过 d.fieldName 访问任意字段）

### 4.6 条形码元素 (barcode)

```json
{
  "options": {
    "left": 300,
    "top": 30,
    "height": 40,
    "width": 140,
    "field": "barcodeNo",
    "testData": "XS888888888",
    "textType": "barcode",
    "hideTitle": true
  },
  "printElementType": { "type": "text" }
}
```

> 注意：条形码本质上是 `type: "text"` 加 `textType: "barcode"` 属性。  
> 也可使用 SVG 条形码 `type: "barcode"`（矢量不失真）。

### 4.7 二维码元素 (qrcode)

```json
{
  "options": {
    "left": 450,
    "top": 30,
    "height": 60,
    "width": 60,
    "field": "qrcodeUrl",
    "testData": "https://microi.net",
    "textType": "qrcode"
  },
  "printElementType": { "type": "text" }
}
```

> 也可使用 SVG 二维码 `type: "qrcode"`（矢量不失真）。

### 4.8 辅助图形元素

**水平线 (hline)：**
```json
{
  "options": {
    "left": 30,
    "top": 80,
    "height": 9,
    "width": 511.5,
    "borderStyle": "solid",
    "borderWidth": 0.75
  },
  "printElementType": { "type": "hline" }
}
```

**垂直线 (vline)：**
```json
{
  "options": {
    "left": 100,
    "top": 30,
    "height": 200,
    "width": 9,
    "borderStyle": "dashed",
    "borderWidth": 0.75
  },
  "printElementType": { "type": "vline" }
}
```

**矩形 (rect)：**
```json
{
  "options": {
    "left": 30,
    "top": 30,
    "height": 80,
    "width": 200,
    "borderStyle": "solid",
    "borderWidth": 0.75,
    "borderColor": "#000",
    "backgroundColor": "#f5f5f5"
  },
  "printElementType": { "type": "rect" }
}
```

**椭圆 (oval)：**
```json
{
  "options": {
    "left": 250,
    "top": 30,
    "height": 80,
    "width": 80,
    "borderStyle": "solid",
    "borderWidth": 0.75,
    "borderColor": "#333"
  },
  "printElementType": { "type": "oval" }
}
```

### 4.9 内嵌页面 (iframe)

```json
{
  "options": {
    "left": 30,
    "top": 400,
    "height": 200,
    "width": 511.5,
    "formatter": "function(t, e, d) {\n  return '<iframe src=\"https://example.com\" style=\"width:100%;height:100%;border:none;\"></iframe>';\n}"
  },
  "printElementType": { "type": "html" }
}
```

---

## 5. PrintObj 打印数据结构

PrintObj 是运行时注入到模板中的数据，字段名必须与 PageObj 中元素的 `field` 属性对应。

### 基本结构

```json
{
  "companyName": "吾码科技有限公司",
  "orderNo": "ORD-2024-001",
  "date": "2024-01-15",
  "amount": "¥12,800.00",
  "logoUrl": "https://example.com/logo.png",
  "barcodeNo": "XS888888888",
  "qrcodeUrl": "https://microi.net",

  "items": [
    { "id": "1", "name": "商品A", "qty": "10", "price": "100", "total": "1000" },
    { "id": "2", "name": "商品B", "qty": "5", "price": "200", "total": "1000" }
  ],

  "longText": "合同正文内容...",
  "remark": "备注信息"
}
```

### 数据绑定规则

1. **简单字段绑定**：元素 `field: "companyName"` → 取 `PrintObj.companyName`
2. **表格数据绑定**：表格元素 `field: "items"` → 取 `PrintObj.items`（必须为数组），列 `field: "name"` → 取 `items[i].name`
3. **图片绑定**：图片元素 `field: "logoUrl"` → 取 `PrintObj.logoUrl`（URL或Base64）
4. **条形码/二维码**：文本元素 `field: "barcodeNo"` + `textType: "barcode"` → 取 `PrintObj.barcodeNo` 生成条码

---

## 6. 完整示例：商品销售单

### PageObj（模板定义）

```json
{
  "panels": [{
    "index": 0,
    "name": "销售单",
    "height": 297,
    "width": 210,
    "paperType": "A4",
    "paperHeader": 49.5,
    "paperFooter": 780,
    "printElements": [
      {
        "options": {
          "left": 180,
          "top": 15,
          "height": 20,
          "width": 200,
          "title": "商品销售单",
          "fontSize": 18,
          "fontWeight": "700",
          "textAlign": "center"
        },
        "printElementType": { "type": "text" }
      },
      {
        "options": {
          "left": 30,
          "top": 52.5,
          "height": 9,
          "width": 511.5,
          "borderStyle": "solid",
          "borderWidth": 0.75
        },
        "printElementType": { "type": "hline" }
      },
      {
        "options": {
          "left": 30,
          "top": 67.5,
          "height": 13,
          "width": 200,
          "title": "单号：",
          "field": "orderNo",
          "testData": "ORD-2024-001",
          "fontSize": 10.5
        },
        "printElementType": { "type": "text" }
      },
      {
        "options": {
          "left": 350,
          "top": 67.5,
          "height": 13,
          "width": 190,
          "title": "日期：",
          "field": "date",
          "testData": "2024-01-15",
          "fontSize": 10.5,
          "textAlign": "right"
        },
        "printElementType": { "type": "text" }
      },
      {
        "options": {
          "left": 30,
          "top": 90,
          "height": 13,
          "width": 300,
          "title": "客户：",
          "field": "customerName",
          "testData": "吾码科技有限公司",
          "fontSize": 10.5
        },
        "printElementType": { "type": "text" }
      },
      {
        "options": {
          "left": 30,
          "top": 120,
          "height": 56,
          "width": 511.5,
          "field": "items",
          "columns": [[
            { "title": "序号", "field": "seq", "width": 50, "align": "center" },
            { "title": "商品名称", "field": "name", "width": 180, "align": "left" },
            { "title": "数量", "field": "qty", "width": 70, "align": "right", "tableSummary": "sum" },
            { "title": "单价", "field": "price", "width": 80, "align": "right" },
            { "title": "小计", "field": "total", "width": 100, "align": "right", "tableSummary": "sum" }
          ]],
          "editable": true,
          "columnResizable": true
        },
        "printElementType": { "type": "table" }
      },
      {
        "options": {
          "left": 350,
          "top": 500,
          "height": 13,
          "width": 190,
          "title": "合计金额：",
          "field": "totalAmount",
          "testData": "¥12,800.00",
          "fontSize": 12,
          "fontWeight": "700",
          "textAlign": "right"
        },
        "printElementType": { "type": "text" }
      },
      {
        "options": {
          "left": 450,
          "top": 15,
          "height": 45,
          "width": 90,
          "field": "qrcodeUrl",
          "testData": "https://microi.net",
          "textType": "qrcode"
        },
        "printElementType": { "type": "text" }
      }
    ]
  }]
}
```

### PrintObj（打印数据）

```json
{
  "orderNo": "ORD-2024-001",
  "date": "2024-01-15",
  "customerName": "吾码科技有限公司",
  "totalAmount": "¥12,800.00",
  "qrcodeUrl": "https://microi.net/order/ORD-2024-001",
  "items": [
    { "seq": "1", "name": "Microi企业版授权", "qty": "1", "price": "10000", "total": "10000" },
    { "seq": "2", "name": "技术咨询服务", "qty": "2", "price": "1400", "total": "2800" }
  ]
}
```

---

## 7. Provider 系统（可拖拽元素）

打印设计器左侧面板的拖拽元素由 Provider 定义。每个 Provider 注册到 hiprint 后，用户可以在设计器中拖拽使用。

### Provider Module 1 — 基础元素

| 元素 Key | 类型 | 说明 | 分组 |
|----------|------|------|------|
| customText | text | 纯文本 | 表格/文本 |
| customText1 | text | 键值文本（带字段绑定） | 表格/文本 |
| longText | longText | 长文本（自动分页） | 表格/文本 |
| html | html | 自定义 HTML | 表格/文本 |
| table | table | 数据表格 | 表格/文本 |
| image | image | 图片 | 表格/文本 |
| barcode | text(barcode) | 条形码 | 表格/文本 |
| qrcode | text(qrcode) | 二维码 | 表格/文本 |
| hline | hline | 水平线 | 辅助/图形 |
| vline | vline | 垂直线 | 辅助/图形 |
| rect | rect | 矩形 | 辅助/图形 |
| oval | oval | 椭圆 | 辅助/图形 |
| emptyTable | table | 空白编辑表格 | 高级 |
| barcodeSvg | barcode | SVG矢量条形码 | 高级 |
| qrcodeSvg | qrcode | SVG矢量二维码 | 高级 |

### Provider Module 2 — 业务元素

| 元素 Key | 类型 | 说明 | 分组 |
|----------|------|------|------|
| header | text | 文档抬头 | 常规 |
| type | text | 文档类型 | 常规 |
| order | text | 单据号 | 常规 |
| date | text | 业务日期 | 常规 |
| platform | text | 平台名称 | 常规 |
| bindingline | text | 装订线 | 常规 |
| iframe | html | 嵌入网页 | 常规 |
| khname | text | 客户名称 | 客户 |
| tel | text | 客户电话 | 客户 |
| address | longText | 收货地址 | 客户 |
| amount | text | 金额 | 财务 |
| amountUpper | text | 大写金额 | 财务 |
| taxRate | text | 税率 | 财务 |
| signLine | text | 签名线 | 签章 |
| sealImage | image | 印章图片 | 签章 |
| dateLine | text | 日期线 | 签章 |

---

## 8. 函数属性编写指南

打印元素支持通过 JavaScript 函数自定义渲染逻辑。函数以字符串形式存储，运行时通过 `eval` 执行。

### 文本/HTML 元素 — formatter

```javascript
// 签名：function(title, value, options, templateData, target)
// 返回：HTML 字符串
function(title, value, options, templateData, target) {
  if (!value) return '<span style="color:#ccc">暂无数据</span>';
  return '<b>' + value + '</b>';
}
```

### 文本/HTML 元素 — styler

```javascript
// 签名：function(value, options, target, templateData)
// 返回：CSS 样式对象
function(value, options, target, templateData) {
  if (value > 1000) return { color: 'red', fontWeight: 'bold' };
  return {};
}
```

### 表格 — formatter2（单元格渲染）

```javascript
// 签名：function(title, field, row, index, options)
// title: 列标题
// field: 当前单元格值
// row: 当前行数据对象
// index: 行索引
function(title, field, row, index, options) {
  if (row.status === '异常') return '<span style="color:red">' + field + '</span>';
  return field;
}
```

### 表格 — styler2（单元格样式）

```javascript
// 签名：function(value, row, index, options)
function(value, row, index, options) {
  if (index % 2 === 0) return { background: '#f9f9f9' };
  return {};
}
```

### 表格 — rowStyler（行样式）

```javascript
// 签名：function(row, index, options)
function(row, index, options) {
  if (row.isTotal) return { fontWeight: 'bold', borderTop: '2px solid #000' };
  return {};
}
```

### 表格 — footerFormatter（表尾渲染）

```javascript
// 签名：function(options, rows, data, el)
function(options, rows, data, el) {
  return '<tr><td colspan="3" style="text-align:right">合计：</td><td>' + data.totalAmount + '</td></tr>';
}
```

### 表格 — tableSummaryFormatter（合计行渲染）

```javascript
// 签名：function(column, data)
function(column, data) {
  var sum = data.reduce(function(acc, row) { return acc + Number(row[column.field] || 0); }, 0);
  return '合计: ' + sum.toFixed(2);
}
```

### 元素 — onRendered（渲染完成回调）

```javascript
// 签名：function(el, isDesign)
// el: 打印元素DOM节点
// isDesign: 是否设计器模式
function(el, isDesign) {
  if (!isDesign) {
    // 仅在预览/打印时执行
    el.style.border = '1px solid #ddd';
  }
}
```

---

## 9. 数据流与运行时架构

```
┌──────────────────┐
│  mic_print 表    │  数据库存储
│  (PageObj/PrintObj) │
└────────┬─────────┘
         │ FormEngine.GetFormData()
         ▼
┌──────────────────┐
│  autoprint.vue   │  页面加载，解析JSON
│  (数据加载层)     │
└────────┬─────────┘
         │ props.remoteObj
         ▼
┌──────────────────┐
│ print-designer   │  设计器核心组件
│  .vue            │
│  ┌─────────────┐ │
│  │ hiprint     │ │  模板渲染引擎
│  │ Template    │ │
│  └─────────────┘ │
└────────┬─────────┘
         │ hiprintTemplate.getJson()
         ▼
┌──────────────────┐
│  保存             │
│  EventBus →      │  组件集成 或
│  postMessage →   │  iframe集成
│  FormEngine →    │  保存到数据库
└──────────────────┘
```

### 打印流程

```
hiprintTemplate.getHtml(PrintObj)
       ↓
合并模板中的 field → PrintObj 中的值
       ↓
执行 formatter/styler 等函数
       ↓
生成完整 HTML
       ↓
调用浏览器打印 或 中转服务直连打印机
```

---

## 10. AI 生成模板的最佳实践

### 生成规则

1. **坐标计算**：A4 纸可用宽度约 571.5pt（210mm），从 left=30 开始留白合理
2. **元素间距**：垂直间距建议 15-22.5pt，行高与字号匹配
3. **表格宽度**：所有列宽之和应等于表格 width
4. **field 命名**：使用 camelCase，与 PrintObj 键名保持一致
5. **testData**：每个绑定字段必须提供 testData 用于设计器预览
6. **标题元素**：居中、大字号，使用固定文本（title）不绑定 field
7. **分隔线**：标题下方通常添加 hline 分隔

### 常用布局模板

**标题区（top: 15-60）：**
- 居中标题（fontSize: 16-22, fontWeight: 700）
- 分隔线（hline，top 约标题下方 7.5pt）
- 二维码/LOGO（右上角或左上角, image/qrcode）

**信息区（top: 60-120）：**
- 单号、日期左右对齐
- 客户信息、经办人等

**数据区（top: 120+）：**
- 表格元素（占页面主要空间）
- 自动分页处理大量行数据

**签章区（靠近页脚）：**
- 签名线、日期线
- 印章图片

### 生成 PrintObj 数据的规则

1. 所有字段值应为字符串类型（表格数组中的值也是字符串）
2. 表格数据字段名必须与 columns 中 column.field 对应
3. 图片字段提供完整 URL 地址
4. 条形码/二维码字段提供实际编码内容

---

## 11. 接口引擎集成

打印引擎通过 `DataApi` 字段关联接口引擎，运行时自动调用接口获取动态数据填充到 PrintObj。

```javascript
// 接口引擎返回格式
return {
  Code: 1,
  Data: {
    orderNo: "ORD-2024-001",
    customerName: "某客户",
    items: [
      { seq: "1", name: "商品A", qty: "10", price: "100", total: "1000" }
    ]
  }
};
```

返回的 `Data` 对象将直接作为 PrintObj 注入模板进行渲染。
