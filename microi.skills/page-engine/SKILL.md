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

## searchData 查询条件通用结构

```json
[
  { "prop": "department", "value": "", "label": "部门", "type": "select", "remote": false, "optionUrl": "", "options": [{ "label": "全部", "value": "" }] },
  { "prop": "keyword", "value": "", "label": "关键词", "type": "input" }
]
```

## 生成 JSON 注意事项

1. **编号唯一**：`wrapperOption.number` 和 `widgetOption.number` 页面内唯一（随机5位整数）
2. **关联一致**：`widgetOption.wrapperNumber` 必须等于所在容器的 `wrapperOption.number`
3. **高度合理**：容器高度 >= 内部组件高度之和
4. **widgetParams 完整**：必须包含该组件定义的所有参数，不能遗漏
5. **栅格布局**：span 总和 24 为一行，如 span=12 的两个容器为两列布局
6. **数据来源**：接口引擎 value 格式 `$ApiBase$/apiengine/{Key}--OsClient--$OsClient$--`
7. **formConfig 完整**：所有字段都应包含，不能省略
8. **选项卡容器**：组件放在 `tabWidgetMap[tabKey][]` 中，不放在 `widgetList` 中
