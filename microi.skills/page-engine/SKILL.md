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

### 平台内置业务组件

| type | label | 关键参数 | 说明 |
|------|-------|----------|------|
| `aiengine` | AI引擎 | 无 | 嵌入 `Microi.Client/src/views/ai-engine/index.vue`；运行态使用紧凑嵌入模式，缩小英雄区、统计卡和快捷入口 |
| `workcenter` | 工作中心 | `[0]` 内容；`[1]` 待办模块；`[2]` 流程模块 | 展示“我的工作”时可用两个隐藏 `sys_menu` 模块让 `diy-table` 承载待办与流程列表；日历/公告为兼容模式 |
| `pageengine` | 界面引擎 | `widgetParams[0].type = "pageengine"`，`value` 为 `mic_page.Id` | 嵌入另一个界面引擎页面，设计器提供图形化页面下拉选择 |

界面引擎嵌套必须通过无 `Layout` 的独立路由 `/mic/renderer-embed/:Id` 和同源 iframe 渲染，不得直接在父页面递归挂载 `renderer.vue`。父子页面共享同一个应用实例时会复用单例 Pinia `pageEngine` store，子页面加载会覆盖父页面的 `formData`。iframe 负责隔离 store；嵌入页不得再次显示菜单栏或顶部导航。运行态 `pageengine` 使用 `scrolling="no"`，通过同源 `ResizeObserver + MutationObserver` 同步内容高度；父容器和组件高度设为 `0` 表示自动高度，由最外层页面统一滚动。

界面引擎渲染页会为 `_IsAdmin` 或 `Level >= 9999` 的用户提供“界面设计”入口，跳转 `/mic/autopage?Id={mic_page.Id}`。入口优先放入后台 TagsView 页签右键菜单，并在页面第一个容器标题栏右侧提供紧凑快捷入口，与 `moreOption` 等操作使用同一个 flex 操作区垂直居中、右对齐；不得额外占用页面高度、增加顶部空白或覆盖标题，非管理员不显示。嵌套 `pageengine` 的第一个容器也必须显示其自身页面的设计入口，点击后由父页面打开对应子页面设计器，不能把设计器困在 iframe 内。

首页编排可以组合 `aiengine`、`workcenter`、`diycalendar`、`diytable` 和一个占大区域的 `pageengine`。公告应优先通过绑定 `diy_notice` 的 `diytable` 渲染，使增删改权限继续由 `sys_menu + _RoleLimits` 控制；统计子页面由客户独立替换时，只需修改被嵌入的 `mic_page`，无需重做首页布局。

## 运行态布局与滚动规范

- 页面只保留一个主滚动容器：仪表盘、首页和嵌套界面优先继承最外层页面滚动；单个 `pannel`、`workcenter`、`diytable`、`diycalendar`、嵌套 `pageengine` 在运行态默认使用内容自适应高度和 `overflow: visible`，不得无条件设置 `overflow: auto`。
- 固定高度只用于设计器拖拽预览、图表画布或确有虚拟滚动需求的组件。设计态可按 `widgetOption.height` 提供滚动，运行态必须先验证内容能完整展开；不能用双滚动条掩盖容器高度不足。
- 表格型容器通常按 15 条数据验收，表头、工具栏、全部数据行和分页区应同时可见；首页紧凑表格可通过 `diy-table` 的 `PageSizeList` 追加 `[10]`，并在 `sys_menu.DefaultPageSize` 为空时默认选择候选页码中的最小值。空间不足时先压缩统计卡、工具栏、行高和间距，再考虑增加外层页面长度，不隐藏分页、不在卡片内部滚动。
- 同一行的容器使用一致的左右边距、内边距、标题高度和顶部基线；同层卡片间距必须相同，左右边缘、标题、工具栏和内容区应形成稳定对齐线。推荐使用统一的 8px 基础间距和 8/12/16px 倍数。
- 成对容器应设置相同的最小高度；内容较少的组件通过内容居中、合理留白或自适应布局消化空间，不能在底部留下明显的大块无意义空白。内容较多时允许容器自然增高并由页面继续向下滚动。
- 日历和公告应完整展示工具栏、主体和底部操作区；日历优先使用 `height: auto` / `contentHeight: auto`，公告优先使用标准表单引擎分页与权限按钮。
- 运行态移动端必须按实际视口自动切为 24 栅格，不能只依赖保存 JSON 中的 `formConfig.mobile`；窗口旋转或宽度变化时也要同步。嵌入的 `diytable` 不得渲染独立列表页的固定返回栏和全局 FAB，新增、页面按钮、批量操作应留在当前容器工具栏内；容器标题操作区允许紧凑换行，但不能绝对定位覆盖标题或其它卡片。
- `aiengine` 在移动端嵌入首页时应使用内容自适应高度和外层页面滚动，指标卡与快捷入口优先两列紧凑排布，避免 4 个指标和全部快捷入口单列堆叠造成超长首屏；输入区和模型/推理设置必须保持可见且不横向溢出。
- 交付前必须在真实运行页检查：是否存在内部纵向/横向滚动条、15 条表格分页是否可见、同排容器是否对齐、四周边距是否一致、组件底部是否有异常空白。仅检查设计器画布不算验收完成。

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
- 接口引擎会收到 `period`、`_period`、`start`、`end`、`startDate`、`endDate`。当 `period` 是 `today/week/month/quarter/year/lastYear` 时，必须优先按 `period` 计算时间范围、标题前缀和图表粒度；只有 `period=custom` 或没有 `period` 但有 `start/end` 时，才按自定义时间范围处理。
- “更多”筛选里放业务条件，例如 `keyword`、`ownerId`、`customerType`、`status`、`department` 等；日期范围作为自定义时间范围保留在更多筛选中。

### 交付类首页例外与乱码验收

- 如果用户明确说明首页是“项目交付看板、全量采集看板、客户交付状态看板”，或统计的是表单数、模块数、接口引擎数、用户数等平台全量资源，并明确不要本日/本周/本月/本年筛选，则统计组件的 `searchData` 必须保持 `[]`，相关显示查询开关必须为 `false`，不要套用经营看板的周期筛选默认值。
- 交付类首页优先使用 `statistic`、`progress`、`pie`、`bar`、`linebar`、`html` 等图形化组件，不要为了凑数据把明细表格放到首页；明细应放在低代码表单菜单里查看。
- 使用脚本或 FormEngine 写入 `mic_page.JsonObj` 时，中文 JSON 必须做编码安全处理：可将最终 JSON 字符串中的非 ASCII 字符转为 `\uXXXX` 后写入，避免数据库或中间层把标题写成 `????`。
- 写入界面引擎后必须回读 `mic_page.JsonObj` 并检查：不包含 `????`；用户要求无周期筛选时，不包含 `period`、`本日`、`本周`、`本月`、`本年`；`JSON.parse(JsonObj)` 后标题能还原为中文。
- 如果使用 MCP 或自动页面生成工具后发现它注入了默认周期筛选，必须在最终写入前移除这些筛选，并再次回读验证。
- 交付类首页必须做可读性验收：彩色统计卡片、深色渐变、图表标签、HTML 组件中的文字必须显式设置高对比文字色。深色/饱和背景使用白色或接近白色文字；浅色背景使用 `#0f172a/#334155` 等深色文字。不得只设置背景色而遗漏标题、数值、图标颜色。
- 写入后必须检查页面 JSON 和接口返回内容不包含直接暴露的 ECharts 模板占位符：`{a}`、`{b}`、`{c}`、`{d}`、`{value}`。这些只能作为图表 formatter 内部配置使用，不能出现在用户可见标题、饼图中心标题、HTML 文案或默认加载文本中。
- 容器标题栏的 `moreOption.hidden` 语义必须按“true=隐藏、false=显示”处理。交付首页、统计驾驶舱如无明确跳转需求，容器标题可直接留空并在 HTML/组件内部渲染标题，避免右上角出现默认 `More/更多`。
- 如果 Page Engine 前端标准图表组件会因为远程数据源自动显示周期筛选，而用户明确要求不要筛选条，可优先使用 `html` 组件承载实时接口返回的图形化驾驶舱；接口返回扁平字段如 `{ html: "<div>...</div>" }`，页面 `dataHtml` 使用 `${html}`。写入后回读验证无周期词、无 `More/更多`、无占位符、无低对比色。
- 生成首页前必须判断组件沉淀层级：如果某个能力是平台高频标准能力（如指标卡、进度列表、状态分布、排行榜、时间线、描述列表、Office 预览），优先使用或补充 Page Engine 标准组件源码；如果只是当前项目的强业务驾驶舱、组合排版、一次性说明区块，可以用 `html` 组件定制。不要把明显可复用的标准能力长期塞进项目 HTML，也不要为了单个业务驾驶舱新增一堆低复用组件。
- `html` 组件承载长文本、失败原因、学校清单、备注说明、交付结论时，必须设置 `white-space:normal`、`overflow-wrap:anywhere` 或使用逐条列表/卡片渲染；禁止把多条内容用 `；`、`,` 拼成一整行导致底部说明挤在一起。写入后必须检查长文本在 1366/1440 宽度下能自然换行且不横向溢出。
- 交付类首页如果使用一个远程 `html` 组件承载整页驾驶舱，运行态应由外层框架滚动，不要给容器和组件写死 1000px 这类固定高度。页面 JSON 可将 `wrapperOption.height` 与 `widgetOption.height` 设为 `0`（或运行态支持的 `auto`），前端运行态必须按内容自适应高度；设计器模式再使用可编辑的默认高度。
- 首页写入口径说明时，必须区分“客户口头期望数量”“原始 Excel 工作表数量”“按主体合并后的学校数量”“后台项目/规则/别名数量”。不要只显示一个“未交付 N 个”，应同时列出部分交付、待执行、阻塞/需老师配合的清单和原因。

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
- 接口返回的指标名、图例名、表格列名禁止固定写成“月新增客户、月订单金额”等，必须根据最终生效周期输出“本日/本周/本月/本季/本年/去年/自定义”或保持中性名称；否则切换周期后文案会和数据口径冲突。
- `/mic/autopage/:Id` 面向最终用户运行态展示，应渲染 `formRenderer`；设计器入口才渲染 `formDesigner`，避免导航、组件面板、引导遮罩干扰看板访问和自动化截图。
