---
name: page-engine
description: 生成和审查 Microi 界面引擎 Page Engine 页面 JSON。用于创建仪表盘、图表、表格、地图、组件、页面布局，或校验 mic_page formData JSON。
---

# Microi 界面引擎（Page Engine）页面 JSON 生成

你正在为 Microi 吾码平台生成界面引擎页面的 JSON 数据。界面引擎页面由 `formData` 对象描述，用户导入 JSON 即可使用。

## 核心数据结构

```
formData（页面）
├── Id: string                  // 页面唯一ID（GUID）
├── Title: string               // 页面标题
├── Number: string              // 页面编号（如 PAGE1）
├── Desc: string                // 页面描述
└── JsonObj
    ├── formConfig              // 页面全局配置
    └── wrapperList[]           // 容器列表
        ├── wrapperOption       // 容器配置
        └── widgetList[]        // 组件列表
            ├── widgetOption    // 组件通用配置
            └── widgetParams[]  // 组件私有参数
```

## formConfig 页面全局配置

```json
{
  "gutter": 0, "mask": true, "drag": true, "left": true,
  "hover": true, "shadow": true, "link": false, "watermark": false,
  "mobile": false, "dark": false, "autoRefresh": 0, "lastRefreshTime": "",
  "watermarkStyle": {
    "content": "Microi吾码",
    "font": { "fontSize": 16, "color": "rgba(255, 0, 0, 0.15)" },
    "rotate": -22
  },
  "dynamicStyle": { "padding": "4px", "backgroundColor": "", "opacity": 1 }
}
```

## 容器类型

| type | label | 说明 |
|------|-------|------|
| `pannel` | 卡片 | 标准容器，包含一个 `widgetList` |
| `tabs` | 选项卡 | 多标签页容器，使用 `tabWidgetMap` 存储每个 tab 的组件 |

### 卡片容器（pannel）关键字段

```json
{
  "type": "pannel",
  "label": "卡片",
  "hidden": false,
  "wrapperOption": {
    "number": 10001,               // 随机5位整数，页面内唯一
    "span": 12,                    // 栅格宽度（1-24，24=满宽）
    "height": 300,                 // 容器高度（px）
    "margin": "0px 10px 10px 0px",
    "dynamicStyle": { "padding": "10px", "backgroundColor": "" },
    "titleOption": {
      "hidden": true,              // true=隐藏标题
      "title": "未命名",
      "dynamicStyle": { "textAlign": "left", "padding": "0px", "height": "20px", "lineHeight": "20px", "fontSize": "14px", "color": "" },
      "moreOption": { "hidden": true, "icon": "More", "iconShow": false, "text": "更多", "linkurl": "/", "linktype": "router", "refresh": "0", "datetime": "0", "autotime": false, "autotimeval": 1, "dynamicStyle": { "color": "", "fontSize": "12px" } }
    }
  },
  "widgetList": []
}
```

### 选项卡容器（tabs）

组件放在 `tabWidgetMap[tabKey][]` 中，**不**放在 `widgetList` 中。

```json
{
  "type": "tabs",
  "wrapperOption": {
    "number": 10002, "span": 24, "height": 400,
    "tabType": "",            // '' | 'card' | 'border-card'
    "tabPosition": "top",     // 'top' | 'right' | 'bottom' | 'left'
    "tabs": [
      { "key": "tab_1", "label": "标签页1" },
      { "key": "tab_2", "label": "标签页2" }
    ],
    "activeTab": "tab_1"
  },
  "tabWidgetMap": { "tab_1": [], "tab_2": [] },
  "widgetList": []
}
```

## 组件通用结构

```json
{
  "type": "bar",
  "label": "柱状图",
  "category": 0,
  "show": 1,
  "widgetOption": {
    "number": 20001,           // 随机5位整数，页面内唯一
    "wrapperNumber": 10001,    // 必须等于所在容器的 wrapperOption.number
    "span": 24,
    "height": 280,
    "dynamicStyle": { "padding": "8px", "backgroundColor": "" }
  },
  "widgetParams": []
}
```

## widgetParams 参数类型

| type | 说明 | value 类型 |
|------|------|-----------|
| `textarea` | 多行文本（数据来源） | `string` |
| `input` | 单行文本 | `string` |
| `number` | 数字 | `number` |
| `switch` | 开关 | `boolean` |
| `slider` | 滑块 | `number` |
| `color` | 颜色选择 | `string` |
| `select` | 下拉选择 | `string` |
| `radio` | 单选组 | `string` |

## 数据来源（widgetParams[0]）

大多数组件的第一个参数（sort=0）是"数据来源"：
- **静态数据**：`value` 为空，数据在 `typeOptions.dataJson` 中
- **动态接口**：`value` 设为接口地址，运行时请求替换 `dataJson`

**接口引擎地址格式：**
```
$ApiBase$/apiengine/{ApiEngineKey}--OsClient--$OsClient$--
```

## 所有组件类型

### statistic — 统计面板
```json
{ "data": [{ "name": "指标名", "value": 100000, "icon": "Top", "bgColor": "", "bgImage": "linear-gradient(...)", "linkUrl": "/" }], "searchData": [] }
```

### progress — 进度
```json
{ "data": [{ "title": "标题", "value": "￥1,000", "subTitle": "目标", "percentage": 60, "color": "#409EFF" }], "searchData": [] }
```

### links — 快捷导航
```json
[{ "title": "导航名", "iconUrl": "图标URL", "linkUrl": "/路径" }]
```

### carousel — 轮播图
```json
[{ "url": "图片URL" }]
```

### tabel — 表格
```json
{
  "headerData": [{ "prop": "字段名", "label": "列标题", "width": "", "align": "center" }],
  "bodyData": [{ "字段名": "值" }],
  "total": 2,
  "searchData": []
}
```
特殊列标记：`progress_ui`(进度条), `chart_ui`(迷你图), `rate_ui`(评分), `status_ui`(状态标签), `children`(多级表头)

### line / bar — 折线图 / 柱状图
```json
{ "xAxis": ["Mon", "Tue", "Wed"], "series": [{ "name": "系列", "data": [420, 132, 101] }], "searchData": [] }
```

### pie — 饼图
```json
{ "data": [{ "value": 1048, "name": "搜索引擎" }], "searchData": [] }
```

### funnel — 漏斗图
```json
{ "data": [{ "value": 100, "name": "展示" }], "searchData": [] }
```

### linebar — 折柱混合
```json
{ "xAxis": ["周一"], "series": [{ "name": "蒸发量", "type": "bar", "unit": "ml", "data": [2.0] }, { "name": "温度", "type": "line", "unit": "°C", "data": [2.0] }], "searchData": [] }
```

### map — 高德地图
```json
[{ "id": "1", "title": "标记名", "position": "经度,纬度", "icon": "", "content": "" }]
```

### areamap — 区域地图
```json
[{ "name": "地区名", "value": 74, "path": "/路径" }]
```

### gantt — 甘特图
```json
{
  "tasks": [{ "id": 10, "text": "任务名", "type": "project", "progress": 0.1, "open": true }],
  "links": [{ "id": 10, "source": 12, "target": 13, "type": 1 }],
  "columns": [{ "name": "text", "label": "任务名称", "width": 220, "tree": true }]
}
```

### fullcalendar — 日历看板
```json
[{ "id": "event_01", "title": "事件名", "start": "2025-05-12", "end": "2025-05-13", "allDay": true }]
```

### html — 超文本
```json
{ "dataJson": { "col21": "替换值" }, "dataHtml": "<!DOCTYPE html>...<td>${col21}</td>..." }
```

### descriptions — 描述列表
```json
[{ "label": "字段名", "value": "值", "span": 1, "align": "center" }]
```

### 其他组件
| 组件 | dataJson |
|------|----------|
| workbench | `{ "icon": "URL", "title": "欢迎", "subTitle": "副标题" }` |
| calendar | `[{ "date": "2024-12-01", "content": "事件" }]` |
| collapse | `[{ "title": "标题", "content": "HTML内容" }]` |
| steps | `{ "activeIndex": 0, "stepArr": [{ "title": "步骤1", "description": "描述" }] }` |
| timeline | `[{ "date": "2024-05-01", "title": "标题", "content": "内容" }]` |
| fish | `[{ "label": "类别", "children": [{ "label": "子项" }] }]` |
| webgl | `{ "gltfPath": "模型URL", "hdrPath": "HDR URL" }` |
| office | `{ "filePath": "文件URL" }` |
| image | widgetParams[0] 为 `input` 类型，value 为图片URL |
| video | widgetParams[0] 为 `input` 类型，value 为视频URL |
| browser | widgetParams[0] 为 `input` 类型，value 为网址 |
| diytable | 传入模块ID和菜单ID，嵌入低代码表格 |
| diyform | 传入表ID和记录ID，嵌入低代码表单 |

## Office/PDF 在线预览自然语言生成规则

当用户用自然语言要求“界面引擎预览 PDF/Word/Excel/PPT”“接口引擎返回 PDF 文件”“打开时跳到第 N 页”“按角色显示不同页码”“每 5 秒/10 秒轮询，但只有文件变化才刷新”时，优先生成 `office` 组件，而不是 `iframe/html/browser` 拼接。

`office` 组件图形化参数必须完整：

```json
{
  "type": "office",
  "label": "Office/PDF预览",
  "widgetOption": { "span": 24, "height": 720 },
  "widgetParams": [
    { "sort": 0, "label": "接口引擎地址", "type": "textarea", "value": "$ApiBase$/apiengine/{ApiEngineKey}--OsClient--$OsClient$--" },
    { "sort": 1, "label": "静态文件地址", "type": "input", "value": "" },
    { "sort": 2, "label": "文件类型", "type": "select", "value": "pdf" },
    { "sort": 3, "label": "初始页码", "type": "number", "value": 1 },
    { "sort": 4, "label": "轮询接口秒数", "type": "number", "value": 0 }
  ]
}
```

接口引擎返回契约：

```javascript
return {
  Code: 1,
  Data: {
    FileName: 'report.pdf',
    ContentType: 'application/pdf',
    FileByteBase64: base64,
    PageNumber: 2,
    InitialPage: 2,
    FileKey: activeFileKey + ':p2',
    RefreshSeconds: 5
  }
};
```

轮询但不刷新时，不要重复返回文件内容；返回下面任一写法即可，前端会保持当前预览不重建：

```javascript
return { Code: 1, Data: { NeedRefresh: false, FileKey: currentFileKey, PageNumber: currentPage } };
return { Code: 1, Data: { NotModified: true, FileKey: currentFileKey } };
```

接口引擎应读取前端轮询参数：`V8.Param.CurrentFileKey`、`V8.Param.CurrentPageNumber`、`V8.Param.PageNumber`、`V8.Param.WidgetNumber`。当 Redis/缓存中的活动文件、版本号、角色页码没有变化时返回 `NeedRefresh:false`；当文件或页码变化时返回 `FileByteBase64` 或 `FileUrl`，同时返回新的 `FileKey` 和 `PageNumber/InitialPage`。

角色页码建议在接口引擎中根据 `V8.CurrentUser.Level`、`RoleName`、`RoleIds` 判断，例如管理员第 2 页、财务第 3 页；不要把角色判断写死在前端 Page JSON。缓存 Key 使用 `Microi:${V8.OsClient}:PageEnginePdfPreview:{业务Key}`。

### Office/PDF 接口返回字段细则

- `FileName`：文件名，例如 `report.pdf`。
- `ContentType`：文件类型，PDF 必须用 `application/pdf`；Word/Excel/PPT 可用对应 Office MIME。
- `FileByteBase64`：文件字节 Base64；适合接口引擎动态生成或转发 PDF。
- `FileUrl`：文件 URL；适合文件已在 HDFS/OSS/公网可访问时返回。
- `PageNumber` / `InitialPage`：PDF 打开后跳转页码。角色控制页码必须在接口引擎中根据 `V8.CurrentUser` 判断，不要写死在页面 JSON。
- `FileKey` / `CacheKey`：文件版本标识，建议包含业务 Key、缓存版本号、角色页码，例如 `activePdf:v3:page2`。
- `NeedRefresh:false` / `NotModified:true`：轮询时文件和页码未变化，前端保持当前预览并重新按当前页码定位，不重新下载文件。
- `RefreshSeconds`：接口可返回建议轮询秒数，但页面图形化配置仍是主要控制项；没有自动刷新需求时配置为 `0`。

接口引擎要显式读取这些前端参数：

- `V8.Param.PageNumber`：组件配置的初始页码。
- `V8.Param.CurrentPageNumber`：前端当前页码。
- `V8.Param.CurrentFileKey`：前端当前文件 Key。
- `V8.Param.CurrentFileUrl`：前端当前文件地址。
- `V8.Param.WidgetNumber`：当前 office 组件编号。

生成示例接口时必须写清楚中文注释：每个参数的含义、Redis/缓存 Key 的作用、什么情况下返回 `NeedRefresh:false`、什么情况下返回新的 `FileByteBase64/FileUrl` 和 `PageNumber`。

## searchData 查询条件通用结构

```json
[
  { "prop": "period", "value": "month", "defaultValue": "month", "label": "统计周期", "type": "select", "remote": false, "options": [{ "label": "本日", "value": "today" }, { "label": "本周", "value": "week" }, { "label": "本月", "value": "month" }, { "label": "本季", "value": "quarter" }, { "label": "本年", "value": "year" }, { "label": "去年", "value": "lastYear" }] },
  { "prop": "department", "value": "", "label": "部门", "type": "select", "remote": false, "optionUrl": "", "options": [{ "label": "全部", "value": "" }] },
  { "prop": "keyword", "value": "", "label": "关键词", "type": "input" }
]
```

### 统计周期与更多筛选

- 统计类组件 `statistic`、`progress`、`bar`、`line`、`linebar`、`pie`、`funnel`、`tabel` 默认必须支持周期筛选。
- 周期按钮固定包含：本日 `today`、本周 `week`、本月 `month`、本季 `quarter`、本年 `year`、去年 `lastYear`。
- 同时开启组件的显示查询和日期筛选开关：`statistic` 为 `widgetParams[18]/[19]`，`progress` 为 `[26]/[27]`，`bar/line` 为 `[1]/[16]`，`linebar` 为 `[1]/[18]`，`pie` 为 `[1]/[19]`，`funnel/tabel` 为 `[1]/[13]`。
- 接口引擎会收到 `period`、`_period`、`start`、`end`、`startDate`、`endDate`，必须优先按 `start/end` 做时间范围过滤；没有传日期时默认按 `period` 或本月兜底。
- “更多”筛选里放业务条件，例如 `keyword`、`ownerId`、`customerType`、`status`、`department` 等；日期范围作为自定义时间范围保留在更多筛选中。

## 生成 JSON 注意事项

1. **编号唯一**：`wrapperOption.number` 和 `widgetOption.number` 页面内唯一（随机5位整数）
2. **关联一致**：`widgetOption.wrapperNumber` 必须等于所在容器的 `wrapperOption.number`
3. **高度合理**：容器高度 >= 内部组件高度之和
4. **widgetParams 完整**：必须包含该组件定义的所有参数，不能遗漏
5. **栅格布局**：span 总和 24 为一行，如 span=12 的两个容器为两列布局
6. **数据来源**：接口引擎 value 格式 `$ApiBase$/apiengine/{Key}--OsClient--$OsClient$--`
7. **formConfig 完整**：所有字段都应包含，不能省略
8. **选项卡容器**：组件放在 `tabWidgetMap[tabKey][]` 中，不放在 `widgetList` 中
## 经营看板周期筛选与布局规则

- 老板驾驶舱、经营看板、CRM/订单/售后统计页面，所有统计类组件默认都要提供统一周期筛选：本日、本周、本月、本季、本年、去年，以及“更多”里的自定义时间范围和业务条件。
- 指标名称不要写死为“月订单金额、月新增客户、月跟进活跃”等固定月份口径。优先使用“订单金额、新增客户、跟进活跃”等中性名称；如业务需要展示周期前缀，运行态会根据当前 `period` 自动显示为“本日/本周/本月/本季/本年/去年”。
- `statistic`、`progress` 这类内容型组件在运行态必须允许按内容自适应高度。生成 JSON 时也要按数据条数预留高度：统计卡片按每行列数计算行数，避免首次打开时出现卡片底部被遮挡或容器内部滚动条。
- 有远程数据源的图表/表格/统计组件，点击周期按钮必须真实触发接口请求，并把 `period`、`_period`、`startDate`、`endDate` 等查询条件传给接口。接口返回数据时不要清空组件已有的 `searchData`，除非明确返回新的完整筛选配置。
- `/mic/autopage/:Id` 面向最终用户运行态展示，应渲染 `formRenderer`；设计器入口才渲染 `formDesigner`，避免导航、组件面板、引导遮罩干扰看板访问和自动化截图。
