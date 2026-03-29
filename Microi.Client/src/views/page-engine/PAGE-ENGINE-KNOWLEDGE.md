# Microi吾码 界面引擎（Page Engine）知识库

> 本知识库用于指导 AI 生成界面引擎页面的 JSON 数据。AI 可以根据用户需求，直接输出完整的 formData JSON，用户导入界面引擎即可使用。

---

## 一、核心数据结构总览

界面引擎页面由一个 `formData` 对象描述，结构层级为：

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

---

## 二、formData — 页面基础信息

```json
{
  "Id": "GUID字符串",
  "Title": "页面标题",
  "Number": "PAGE编号",
  "Desc": "页面描述",
  "JsonObj": {
    "formConfig": { ... },
    "wrapperList": [ ... ]
  }
}
```

---

## 三、formConfig — 页面全局配置

```json
{
  "gutter": 0,              // 栅格间距（默认0）
  "mask": true,              // 编辑模式遮罩
  "drag": true,              // 编辑模式拖拽
  "left": true,              // 是否显示左侧栏
  "hover": true,             // 悬停阴影
  "shadow": true,            // 卡片阴影
  "link": false,             // 启用链接跳转（渲染模式）
  "watermark": false,        // 水印
  "mobile": false,           // 移动端视图
  "dark": false,             // 暗黑模式
  "autoRefresh": 0,          // 自动刷新间隔秒数，0=不刷新
  "lastRefreshTime": "",     // 最后刷新时间戳
  "watermarkStyle": {
    "content": "Microi吾码",
    "font": { "fontSize": 16, "color": "rgba(255, 0, 0, 0.15)" },
    "rotate": -22
  },
  "dynamicStyle": {
    "padding": "4px",        // 页面内边距
    "backgroundColor": "",   // 页面背景色（空=透明）
    "opacity": 1             // 页面透明度
  }
}
```

---

## 四、wrapperList — 容器列表

### 4.1 容器类型

| type | label | 说明 |
|------|-------|------|
| `pannel` | 卡片 | 标准容器，包含一个 `widgetList` |
| `tabs` | 选项卡 | 多标签页容器，使用 `tabWidgetMap` 存储每个 tab 的组件 |

### 4.2 卡片容器（pannel）结构

```json
{
  "type": "pannel",
  "label": "卡片",
  "hidden": false,
  "icon": "",
  "img": "",
  "wrapperOption": {
    "number": 12345,               // 容器编号（随机5位整数）
    "gutter": 0,                   // 内部栅格间距
    "span": 12,                    // 栅格宽度（1-24，24=满宽）
    "offset": 0,                   // 左侧间隔格数
    "push": 0,                     // 栅格右移格数
    "pull": 0,                     // 栅格左移格数
    "height": 300,                 // 容器高度（px）
    "marginTop": 0,                // 上移像素
    "margin": "0px 10px 10px 0px", // 外边距
    "pannelColor": "",             // 面板背景色
    "dynamicStyle": {
      "padding": "10px",           // 内边距
      "backgroundColor": ""        // 内容背景色
    },
    "titleOption": {
      "hidden": true,              // true=隐藏标题
      "title": "未命名",
      "dynamicStyle": {
        "textAlign": "left",
        "padding": "0px",
        "height": "20px",
        "lineHeight": "20px",
        "fontSize": "14px",
        "color": ""
      },
      "moreOption": {
        "hidden": true,
        "icon": "More",
        "iconShow": false,
        "text": "更多",
        "linkurl": "/",
        "linktype": "router",
        "refresh": "0",
        "datetime": "0",
        "autotime": false,
        "autotimeval": 1,
        "dynamicStyle": {
          "color": "",
          "fontSize": "12px"
        }
      }
    }
  },
  "widgetList": [ ... ]
}
```

### 4.3 选项卡容器（tabs）结构

```json
{
  "type": "tabs",
  "label": "选项卡",
  "hidden": false,
  "icon": "Menu",
  "img": "",
  "wrapperOption": {
    "number": 12345,
    "span": 24,
    "height": 400,
    "tabType": "",           // '' | 'card' | 'border-card'
    "tabPosition": "top",    // 'top' | 'right' | 'bottom' | 'left'
    "tabs": [
      { "key": "tab_1", "label": "标签页1" },
      { "key": "tab_2", "label": "标签页2" }
    ],
    "activeTab": "tab_1",
    "...其余同 pannel 的 wrapperOption"
  },
  "tabWidgetMap": {
    "tab_1": [ /* widgetList */ ],
    "tab_2": [ /* widgetList */ ]
  },
  "widgetList": []
}
```

---

## 五、widgetList — 组件列表

### 5.1 组件通用结构

每个组件对象：

```json
{
  "type": "bar",              // 组件类型（见组件类型表）
  "label": "柱状图",          // 组件名称
  "category": 0,              // 0=内置, 1=自定义
  "show": 1,                  // 1=显示, 0=隐藏
  "icon": "",                 // Element Plus 图标组件名
  "img": "",                  // 图片图标URL
  "widgetOption": {
    "number": 54321,           // 组件编号（随机5位整数）
    "wrapperNumber": 12345,    // 所属容器编号（必须与容器number一致）
    "span": 24,                // 栅格宽度（1-24）
    "offset": 0,               // 左侧间隔
    "push": 0,                 // 栅格右移
    "pull": 0,                 // 栅格左移
    "height": 280,             // 组件高度（px）
    "marginTop": 0,            // 上移像素
    "dynamicStyle": {
      "padding": "8px",        // 内边距
      "backgroundColor": ""    // 背景色
    }
  },
  "widgetParams": [ ... ]      // 组件私有配置参数
}
```

### 5.2 编号生成规则

- `wrapperOption.number`: 随机5位正整数，如 `Math.floor(Math.random() * 90000) + 10000`
- `widgetOption.number`: 同上，确保唯一
- `widgetOption.wrapperNumber`: 必须等于其所在容器的 `wrapperOption.number`

---

## 六、widgetParams 参数类型系统

`widgetParams` 是一个数组，每项定义组件的一个可配置参数：

```json
{
  "sort": 0,                // 排序序号
  "label": "参数名称",        // 显示标签
  "type": "textarea",        // 表单类型
  "value": "",               // 当前值
  "typeOptions": { ... }     // 类型附加选项
}
```

### 参数 type 类型

| type | 说明 | value 类型 | typeOptions |
|------|------|-----------|-------------|
| `textarea` | 多行文本 | `string` | `{ rows: 3, dataJson: {...}, dataHtml: "..." }` |
| `input` | 单行文本 | `string` | `{ disabled: bool }` |
| `number` | 数字 | `number` | `{ min, max, step }` |
| `switch` | 开关 | `boolean` | — |
| `slider` | 滑块 | `number` | `{ min, max, step }` |
| `color` | 颜色选择 | `string` | — |
| `select` | 下拉选择 | `string` | `{ options: [{ value, label }] }` |
| `radio` | 单选组 | `string` | `{ options: [{ value, label }] }` |

---

## 七、数据来源（widgetParams[0]）详解

大多数组件的第一个参数（sort=0）是"数据来源"，有两种工作模式：

### 7.1 静态数据模式

`value` 为空字符串，数据存储在 `typeOptions.dataJson` 中，适合演示和静态页面。

### 7.2 动态接口模式

`value` 设为接口地址，运行时自动请求该接口，返回数据覆盖 `dataJson`。

**接口引擎地址格式：**
```
$ApiBase$/apiengine/{ApiEngineKey}--OsClient--$OsClient$--
```
- `$ApiBase$` — 自动替换为当前 API 服务器地址
- `$OsClient$` — 自动替换为当前租户标识

**直接 API 地址格式示例：**
```
https://api.example.com/apiengine/MyDataApi--OsClient--iTdos--
```

### 7.3 接口返回数据格式

接口需返回与 `typeOptions.dataJson` 相同结构的 JSON 对象，系统会自动替换 `dataJson`。

---

## 八、所有组件类型及其 widgetParams 定义

### 8.1 workbench — 工作台

默认高度: 100

| sort | label | type | 默认值 | 说明 |
|------|-------|------|--------|------|
| 0 | 数据来源 | textarea | `""` | dataJson: `{ icon, title, subTitle }` |

**dataJson 结构：**
```json
{ "icon": "图片URL", "title": "欢迎语", "subTitle": "副标题" }
```

---

### 8.2 progress — 进度

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 栅格宽度 | slider | `12` |
| 2 | 背景颜色 | color | `""` |
| 3 | 栅格边距 | input | `"5px"` |
| 4 | 对齐方式 | select | `"left"` |
| 5 | 进度条类型 | radio | `"line"` |
| 6 | 进度条厚度 | input | `10` |
| 7 | 进度值显示 | switch | `true` |
| 8 | 进度值内显 | switch | `false` |
| 9 | 进度值 | switch | `true` |
| 10 | 圆形半径 | number | `86` |
| 11 | 进度条边距 | input | `"0px"` |
| 12 | 显示标题 | switch | `true` |
| 13 | 标题字号 | input | `"13px"` |
| 14 | 标题字宽 | input | `"400"` |
| 15 | 标题颜色 | color | `""` |
| 16 | 标题边距 | input | `"0px 0px 10px 0"` |
| 17 | 值字号 | input | `"22px"` |
| 18 | 值字宽 | input | `"600"` |
| 19 | 值颜色 | color | `""` |
| 20 | 值边距 | input | `"0px 0px 10px 0"` |
| 21 | 显示副标题 | switch | `true` |
| 22 | 副标题字号 | input | `"13px"` |
| 23 | 副标题字宽 | input | `"400"` |
| 24 | 副标题颜色 | color | `""` |
| 25 | 副标题边距 | input | `"10px 0px 10px 0px"` |
| 26 | 显示查询 | switch | `false` |
| 27 | 日期筛选 | switch | `false` |

**dataJson 结构：**
```json
{
  "data": [
    { "title": "标题", "value": "￥1,000.00", "subTitle": "目标金额: ￥10,000.00", "percentage": 60, "color": "#409EFF" }
  ],
  "searchData": [
    { "prop": "字段名", "value": "默认值", "label": "显示名", "type": "select|input", "options": [{ "label": "显示名", "value": "值" }] }
  ]
}
```

---

### 8.3 links — 快捷导航

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 栅格宽度 | slider | `6` |
| 2 | 背景颜色 | color | `""` |
| 3 | 栅格边距 | input | `"5px"` |
| 4 | 标题字号 | input | `"13px"` |
| 5 | 标题字宽 | input | `"400"` |
| 6 | 标题颜色 | color | `""` |
| 7 | 标题边距 | input | `"5px 0px 10px 0"` |
| 8 | 图标宽度 | input | `"60px"` |
| 9 | 图标高度 | input | `"60px"` |

**dataJson 结构：**
```json
[
  { "title": "导航名称", "iconUrl": "图标URL", "linkUrl": "/路由路径" }
]
```

---

### 8.4 carousel — 轮播图

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 切换间隔 | number | `3000` |
| 2 | 轮播方向 | radio | `"horizontal"` |
| 3 | 指示器位置 | radio | `""` |
| 4 | 显示类型 | radio | `""` |
| 5 | 自动播放 | switch | `true` |

**dataJson 结构：**
```json
[
  { "url": "图片URL" }
]
```

---

### 8.5 statistic — 统计面板

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 栅格宽度 | slider | `8` |
| 2 | 背景颜色 | color | `""` |
| 3 | 栅格边距 | input | `"5px"` |
| 4 | 块状色彩 | input | `"#ff444f,#FF71D2,..."` |
| 5 | 内边距 | input | `"20px"` |
| 6 | 边框圆角 | input | `"8px"` |
| 7-10 | 标题样式 | 混合 | — |
| 11-13 | 值样式 | 混合 | — |
| 14 | 图标位置 | radio | `"prefix"` |
| 15-16 | 图标样式 | 混合 | — |
| 17 | 块背景图 | input | `"图片URL"` |
| 18 | 显示查询 | switch | `false` |
| 19 | 日期筛选 | switch | `false` |
| 20 | 数字精度 | number | `0` |
| 21-23 | 值/图标边距 | input | — |

**dataJson 结构：**
```json
{
  "data": [
    { "name": "指标名", "value": 100000, "icon": "Top", "bgColor": "", "bgImage": "linear-gradient(...)", "linkUrl": "/" }
  ],
  "searchData": [ ... ]
}
```

---

### 8.6 tabel — 表格

默认高度: 310

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示查询 | switch | `true` |
| 2 | 表头颜色 | color | `""` |
| 3 | 表尺寸 | select | `"small"` |
| 4 | 边框线 | switch | `true` |
| 5 | 斑马纹 | switch | `true` |
| 6 | 日期筛选 | switch | `false` |
| 7 | 每页条数 | number | `-1` |
| 8 | 表头字号 | input | `"13px"` |
| 9 | 行字号 | input | `"12px"` |
| 10 | 分页模式 | select | `"web"` |

**dataJson 结构：**
```json
{
  "headerData": [
    { "prop": "字段名", "label": "列标题", "width": "", "align": "center", "icon": "图标名" },
    { "prop": "进度", "label": "进度", "progress_ui": true, "align": "center" },
    { "prop": "占比", "label": "占比", "chart_ui": true },
    { "prop": "评级", "label": "评级", "rate_ui": true },
    { "prop": "状态", "label": "状态", "status_ui": true },
    { "prop": "父列", "label": "父列", "children": [ { "prop": "子列", "label": "子列" } ] }
  ],
  "bodyData": [
    { "字段名": "值", "进度": 80, "progress_ui": "success" }
  ],
  "total": 2,
  "searchData": [ ... ]
}
```

表格特殊UI标记：`progress_ui`(进度条), `chart_ui`(迷你图), `rate_ui`(评分), `status_ui`(状态标签), `children`(多级表头)

---

### 8.7 calendar — 日历

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |

**dataJson 结构：**
```json
[
  { "date": "2024-12-01", "content": "事件内容" }
]
```

---

### 8.8 collapse — 折叠面板

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 内容边距 | input | `"10px"` |
| 2 | 内容字号 | input | `"12px"` |
| 3 | 字体颜色 | color | `""` |

**dataJson 结构：**
```json
[
  { "title": "标题", "content": "HTML内容" }
]
```

---

### 8.9 image — 图片

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 图片地址 | input | `"图片URL"` |

注意：图片组件的 widgetParams[0] 不是 textarea 类型，而是 input 类型。

---

### 8.10 video — 视频

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 视频地址 | input | `"视频URL"` |
| 1 | 控制器开关 | switch | `false` |
| 2 | 自动播放 | switch | `true` |
| 3 | 循环播放 | switch | `true` |
| 4 | 静音 | switch | `true` |

---

### 8.11 steps — 步骤

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 步骤间距 | input | `""` |
| 2 | 排列方向 | radio | `"horizontal"` |
| 3 | 居中显示 | switch | `false` |
| 4 | 简洁模式 | switch | `false` |

**dataJson 结构：**
```json
{
  "activeIndex": 0,
  "stepArr": [
    {
      "title": "步骤名称",
      "description": "描述",
      "timestamp": "2024-10-13",
      "icon": "Position",
      "status": "success",
      "subdata": [
        { "id": "001001", "content": "子项内容", "timestamp": "", "color": "#0bbd87", "router": "/" }
      ]
    }
  ]
}
```

---

### 8.12 timeline — 时间轴

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |

**dataJson 结构：**
```json
[
  { "date": "2024-05-01", "title": "标题", "content": "内容" }
]
```

---

### 8.13 browser — 浏览器（iframe）

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 网址 | input | `"https://microi.net"` |

---

### 8.14 line — 折线图

默认高度: 280

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示查询 | switch | `false` |
| 2 | X轴留白 | switch | `false` |
| 3 | 平滑模式 | switch | `false` |
| 4 | 区域填充 | switch | `false` |
| 5 | 标题 | input | `""` |
| 6 | 副标题 | input | `""` |
| 7 | 显示图例 | switch | `true` |
| 8 | 图例排列 | select | `"horizontal"` |
| 9 | 图例位置 | select | `"center"` |
| 10 | 提示框 | switch | `true` |
| 11 | trigger | select | `"axis"` |
| 12 | 显示工具箱 | switch | `true` |
| 13 | 显示标签 | switch | `true` |
| 14 | 标签位置 | select | `"outside"` |
| 15 | 分割线 | switch | `true` |
| 16 | 日期筛选 | switch | `false` |

**dataJson 结构：**
```json
{
  "xAxis": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "series": [
    { "name": "系列名", "data": [420, 132, 101, 134, 90, 230, 210] }
  ],
  "searchData": [ ... ]
}
```

---

### 8.15 bar — 柱状图

默认高度: 280

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示查询 | switch | `false` |
| 2 | X轴留白 | switch | `true` |
| 3 | 柱状效果 | select | `"shadow"` |
| 4 | 单位 | input | `""` |
| 5 | 标题 | input | `""` |
| 6 | 副标题 | input | `""` |
| 7 | 显示图例 | switch | `true` |
| 8 | 图例排列 | select | `"horizontal"` |
| 9 | 图例位置 | select | `"center"` |
| 10 | 提示框 | switch | `true` |
| 11 | trigger | select | `"axis"` |
| 12 | 显示工具箱 | switch | `true` |
| 13 | 显示标签 | switch | `true` |
| 14 | 标签位置 | select | `"outside"` |
| 15 | 分割线 | switch | `true` |
| 16 | 日期筛选 | switch | `false` |
| 17 | 旋转显示 | switch | `false` |

**dataJson 结构：** 同 line 折线图

---

### 8.16 pie — 饼图

默认高度: 280

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示查询 | switch | `false` |
| 2 | 内圈半径 | number | `0` |
| 3 | 外圈半径 | number | `100` |
| 4 | 单位 | input | `""` |
| 5 | 标题 | input | `""` |
| 6 | 副标题 | input | `""` |
| 7 | 显示图例 | switch | `true` |
| 8 | 图例排列 | select | `"vertical"` |
| 9 | 图例位置 | select | `"left"` |
| 10 | 提示框 | switch | `true` |
| 11 | trigger | select | `"item"` |
| 12 | 显示工具箱 | switch | `true` |
| 13 | 显示标签 | switch | `true` |
| 14 | 标签位置 | select | `"outside"` |
| 15 | 边框圆角 | number | `10` |
| 16 | 边框宽度 | number | `2` |
| 17 | 内外环间距 | number | `2` |
| 18 | 南丁格尔 | switch | `false` |
| 19 | 日期筛选 | switch | `false` |
| 20 | 标签格式 | input | `"{d}%"` |

**dataJson 结构：**
```json
{
  "data": [
    { "value": 1048, "name": "搜索引擎" },
    { "value": 735, "name": "直接" }
  ],
  "searchData": [ ... ]
}
```

---

### 8.17 map — 地图（高德地图）

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 中心点位置 | input | `"121.592474,29.855748"` |
| 2 | 地图级别 | number | `11` |
| 3 | 缩放工具 | switch | `true` |
| 4 | 比例尺 | switch | `true` |
| 5 | 鹰眼 | switch | `false` |
| 6 | 地图类型 | switch | `false` |
| 7 | 当前定位 | switch | `false` |
| 8 | 显示标题 | switch | `true` |

**dataJson 结构：**
```json
[
  { "id": "1", "title": "标记名称", "position": "经度,纬度", "icon": "图标URL", "content": "" }
]
```

---

### 8.18 funnel — 漏斗图

默认高度: 280

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示查询 | switch | `false` |
| 2 | 单位 | input | `""` |
| 3 | 标题 | input | `""` |
| 4 | 副标题 | input | `""` |
| 5 | 显示图例 | switch | `true` |
| 6 | 图例排列 | select | `"horizontal"` |
| 7 | 图例位置 | select | `"center"` |
| 8 | 提示框 | switch | `true` |
| 9 | trigger | select | `"item"` |
| 10 | 显示工具箱 | switch | `true` |
| 11 | 显示标签 | switch | `true` |
| 12 | 标签位置 | select | `"outside"` |
| 13 | 日期筛选 | switch | `false` |
| 14 | 排序方式 | select | `"descending"` |

**dataJson 结构：**
```json
{
  "data": [
    { "value": 100, "name": "展示" },
    { "value": 80, "name": "点击" },
    { "value": 60, "name": "访问" }
  ],
  "searchData": [ ... ]
}
```

---

### 8.19 linebar — 折柱混合

默认高度: 280

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示查询 | switch | `false` |
| 2 | X轴留白 | switch | `true` |
| 3 | 单位左 | input | `""` |
| 4 | 单位右 | input | `""` |
| 5 | 标题 | input | `""` |
| 6 | 副标题 | input | `""` |
| 7-15 | 图例/提示/标签 | 同 bar | — |
| 16 | 分割线左 | switch | `false` |
| 17 | 分割线右 | switch | `false` |
| 18 | 日期筛选 | switch | `false` |

**dataJson 结构：**
```json
{
  "xAxis": ["周一", "周二", ...],
  "series": [
    { "name": "蒸发量", "type": "bar", "unit": "ml", "data": [2.0, 4.9, ...] },
    { "name": "温度", "type": "line", "unit": "°C", "data": [2.0, 2.2, ...] }
  ],
  "searchData": [ ... ]
}
```

---

### 8.20 gantt — 甘特图

默认高度: 500

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 提示框 | switch | `true` |
| 2 | 允许拖放 | switch | `true` |
| 3 | 表头高度 | number | `40` |
| 4 | 表格行高 | number | `24` |
| 5 | bar高度 | number | `16` |
| 6 | 动态尺寸 | switch | `false` |
| 7 | 只读模式 | switch | `false` |
| 8 | 左侧表格 | switch | `true` |
| 9 | 显示进度 | switch | `true` |
| 10 | bar弹框 | switch | `false` |
| 11 | 编辑回调 | input | `""` |
| 12 | 自动计算 | switch | `false` |
| 13 | 分支排序 | switch | `true` |
| 14 | 自由排序 | switch | `false` |
| 15 | 任务字号 | number | `10` |
| 16 | 任务字色 | color | `"#fff"` |
| 17 | 左侧宽度 | number | `400` |
| 18 | 添加关联 | input | `""` |
| 19 | 删除关联 | input | `""` |
| 20 | 日列宽度 | number | `35` |
| 21 | 实时更新 | switch | `false` |
| 22 | 进度颜色 | color | `"#529b2e"` |
| 23 | 默认视图 | select | `"day"` |

**dataJson 结构：**
```json
{
  "tasks": [
    { "id": 10, "text": "任务名", "type": "project", "progress": 0.1, "open": true, "person": "", "color": "#000", "status": "进行中" },
    { "id": 12, "text": "子任务", "start_date": "2025-01-02 09:00", "duration": 72, "parent": 10, "progress": 1, "status": "已完成" }
  ],
  "links": [
    { "id": 10, "source": 12, "target": 13, "type": 1 }
  ],
  "columns": [
    { "name": "text", "label": "任务名称", "width": 220, "tree": true, "align": "left" }
  ],
  "readonly": "off",
  "personapi": "人员接口URL"
}
```

---

### 8.21 fish — 鱼骨图

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1-17 | 样式参数 | input/color | — |

**dataJson 结构：**
```json
[
  { "label": "类别名", "router": "/", "children": [{ "label": "子项", "router": "/" }] }
]
```

---

### 8.22 webgl — WebGL 3D

默认高度: 500

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 缩放 | number | `10` |
| 2 | 相机角度 | number | `60` |
| 3 | 近裁剪面 | number | `0.25` |
| 4 | 远裁剪面 | number | `20` |
| 5 | 相机X轴 | number | `2.5` |
| 6 | 相机Y轴 | number | `1.5` |
| 7 | 相机Z轴 | number | `3.0` |

**dataJson 结构：**
```json
{ "gltfPath": "GLTF模型URL", "hdrPath": "HDR环境贴图URL", "variant": "材质变体名" }
```

---

### 8.23 office — Office 文档

默认高度: 600

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |

**dataJson 结构：**
```json
{ "filePath": "文件URL（支持xlsx/docx/pdf）" }
```

---

### 8.24 areamap — 区域地图

默认高度: 500

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 省编号 | input | `"330000"` |
| 2 | 是否下钻 | switch | `true` |
| 3 | tooltip | input | `"统计值"` |
| 4 | 最小值 | number | `0` |
| 5 | 最大值 | number | `100` |
| 6 | 块颜色组 | input | `"#F5F67A, #E6B6E6, ..."` |
| 7 | 字体颜色 | color | `"#ffffff"` |
| 8 | 字体大小 | number | `14` |
| 9 | 模拟数据 | switch | `false` |
| 10 | geoJson | input | `"geoJson URL"` |
| 11 | 回调接口 | input | `""` |
| 12 | 路由地址 | input | `"/"` |
| 13 | 市编号 | input | `"330000"` |

**dataJson 结构：**
```json
[
  { "name": "地区名", "value": 74, "path": "/路径" }
]
```

---

### 8.25 fullcalendar — 日历看板

默认高度: 600

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 事件颜色 | color | `"#f08f00"` |
| 2 | 周计方式 | input | `"ISO"` |
| 3 | 全天事件 | switch | `true` |
| 4 | 启用编辑 | switch | `true` |
| 5 | 启用选择 | switch | `false` |
| 6 | 镜像选择 | switch | `true` |
| 7 | 事件限制 | switch | `true` |
| 8 | 显示周末 | switch | `true` |
| 9 | 日期链接 | switch | `false` |
| 10 | 开启拖拽 | switch | `true` |
| 11 | 添加事件 | input | `""` |
| 12 | 删除事件 | input | `""` |
| 13 | 拖拽事件 | input | `""` |

**dataJson 结构：**
```json
[
  { "id": "event_01", "title": "事件名称", "start": "2025-05-12", "end": "2025-05-13", "allDay": true },
  { "id": "event_02", "title": "会议", "start": "2025-05-12T15:00:00", "end": "", "allDay": false }
]
```

---

### 8.26 html — 超文本

默认高度: 300

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |

**dataJson + dataHtml 结构：**
```json
{
  "dataJson": { "col21": "替换值col21", "col31": "替换值col31" },
  "dataHtml": "<!DOCTYPE html>...<td>${col21}</td>..."
}
```
HTML 模板中用 `${变量名}` 引用 dataJson 中的值。

---

### 8.27 descriptions — 描述列表

默认高度: 210

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 数据来源 | textarea | `""` |
| 1 | 显示边框 | switch | `true` |
| 2 | 每行列数 | number | `5` |
| 3 | 排列方式 | select | `"vertical"` |
| 4 | 列表尺寸 | select | `"small"` |
| 5 | 标题 | input | `""` |
| 6 | 扩展标题 | input | `""` |
| 7 | 列宽 | input | `""` |
| 8 | 进度厚度 | number | `8` |
| 9 | pie宽度 | number | `30` |
| 10 | pie背景色 | color | `"#409eff50"` |
| 11 | pie边框色 | color | `"#409eff"` |

**dataJson 结构：**
```json
[
  { "label": "字段名", "value": "值或数值", "span": 1, "rowspan": 1, "align": "center", "labelAlign": "center", "width": "150px" },
  { "label": "评分", "value": 3, "rate_ui": true },
  { "label": "进度", "value": 30, "progress_ui": true, "progress_status": "", "progress_color": "#5cb87a" },
  { "label": "图例", "value": 30, "chart_ui": true },
  { "label": "状态", "value": "及格", "tag_ui": true, "tag_status": "warning" }
]
```

---

### 8.28 diytable — DIY表格（低代码表格）

默认高度: 600

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 模块ID | input | `""` |
| 1 | 菜单ID | input | `""` |
| 2 | 容器样式 | input | `""` |

直接嵌入 Microi 低代码平台的表格模块，传入表ID和菜单ID即可。

---

### 8.29 diyform — DIY表单（低代码表单）

默认高度: 600

| sort | label | type | 默认值 |
|------|-------|------|--------|
| 0 | 表ID | input | `""` |
| 1 | 记录ID | input | `""` |
| 2 | 表单模式 | select | `"View"` |
| 3 | 表名 | input | `""` |

嵌入低代码表单，支持查看/编辑/新增模式。

---

### 8.30 diycalendar — DIY日历（低代码日历）

默认高度: 600

widgetParams: `[]`（无可配置参数）

嵌入低代码日历组件（fullcalendar.vue）。

---

## 九、searchData 查询条件通用结构

多个组件支持 `searchData` 查询条件（统计面板、进度、表格、所有图表）：

```json
{
  "searchData": [
    {
      "prop": "department",      // 字段名（传给API的参数名）
      "value": "5",              // 默认值
      "label": "部门",            // 显示标签
      "type": "select",          // 类型：select | input
      "remote": false,           // 是否远程搜索
      "optionUrl": "",           // 远程选项接口
      "options": [
        { "label": "全部", "value": "" },
        { "label": "前端", "value": "0" }
      ]
    },
    {
      "prop": "keyword",
      "value": "",
      "label": "关键词",
      "type": "input"
    }
  ]
}
```

---

## 十、完整 JSON 示例

以下是一个包含统计面板 + 柱状图的完整页面 JSON：

```json
{
  "Id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "Title": "销售看板",
  "Number": "PAGE_SALES",
  "Desc": "销售数据看板",
  "JsonObj": {
    "formConfig": {
      "gutter": 0,
      "mask": true,
      "drag": true,
      "left": true,
      "hover": true,
      "shadow": true,
      "link": false,
      "watermark": false,
      "mobile": false,
      "dark": false,
      "autoRefresh": 0,
      "lastRefreshTime": "",
      "watermarkStyle": {
        "content": "Microi吾码",
        "font": { "fontSize": 16, "color": "rgba(255, 0, 0, 0.15)" },
        "rotate": -22
      },
      "dynamicStyle": {
        "padding": "4px",
        "backgroundColor": "",
        "opacity": 1
      }
    },
    "wrapperList": [
      {
        "type": "pannel",
        "label": "卡片",
        "hidden": false,
        "icon": "",
        "img": "",
        "wrapperOption": {
          "number": 10001,
          "gutter": 0,
          "span": 24,
          "offset": 0,
          "push": 0,
          "pull": 0,
          "height": 160,
          "marginTop": 0,
          "margin": "0px 10px 10px 0px",
          "pannelColor": "",
          "dynamicStyle": { "padding": "10px", "backgroundColor": "" },
          "titleOption": {
            "hidden": false,
            "title": "销售统计",
            "dynamicStyle": { "textAlign": "left", "padding": "0px", "height": "20px", "lineHeight": "20px", "fontSize": "14px", "color": "" },
            "moreOption": { "hidden": true, "icon": "More", "iconShow": false, "text": "更多", "linkurl": "/", "linktype": "router", "refresh": "0", "datetime": "0", "autotime": false, "autotimeval": 1, "dynamicStyle": { "color": "", "fontSize": "12px" } }
          }
        },
        "widgetList": [
          {
            "type": "statistic",
            "label": "统计面板",
            "category": 0,
            "show": 1,
            "icon": "",
            "img": "",
            "widgetOption": {
              "number": 20001,
              "wrapperNumber": 10001,
              "span": 24,
              "offset": 0,
              "push": 0,
              "pull": 0,
              "height": 120,
              "marginTop": 0,
              "dynamicStyle": { "padding": "8px", "backgroundColor": "" }
            },
            "widgetParams": [
              {
                "sort": 0,
                "label": "数据来源",
                "type": "textarea",
                "value": "$ApiBase$/apiengine/GetSalesStatistic--OsClient--$OsClient$--",
                "typeOptions": {
                  "rows": 3,
                  "dataJson": {
                    "data": [
                      { "name": "今日销售", "value": 12580, "icon": "Top", "bgColor": "", "bgImage": "linear-gradient(to right bottom, rgb(236, 71, 134), rgb(185, 85, 164))", "linkUrl": "/" },
                      { "name": "本月销售", "value": 358000, "icon": "Top", "bgColor": "", "bgImage": "linear-gradient(to right bottom, rgb(134, 94, 192), rgb(81, 68, 180))", "linkUrl": "/" },
                      { "name": "客户总数", "value": 1260, "icon": "CaretTop", "bgColor": "", "bgImage": "linear-gradient(to right bottom, rgb(86, 205, 243), rgb(113, 157, 227))", "linkUrl": "/" }
                    ]
                  }
                }
              },
              { "sort": 1, "label": "栅格宽度", "type": "slider", "value": 8, "typeOptions": { "min": 1, "max": 24, "step": 1 } },
              { "sort": 2, "label": "背景颜色", "type": "color", "value": "" },
              { "sort": 3, "label": "栅格边距", "type": "input", "value": "5px" },
              { "sort": 4, "label": "块状色彩", "type": "input", "value": "#ff444f,#FF71D2,#FBBD12,#914F2C,#409EFF,#6e26ba,#67C23A,#000" },
              { "sort": 5, "label": "内边距", "type": "input", "value": "20px" },
              { "sort": 6, "label": "边框圆角", "type": "input", "value": "8px" },
              { "sort": 7, "label": "标题字号", "type": "input", "value": "13px" },
              { "sort": 8, "label": "标题字宽", "type": "input", "value": "400" },
              { "sort": 9, "label": "标题颜色", "type": "color", "value": "#fff" },
              { "sort": 10, "label": "标题边距", "type": "input", "value": "0px 0px 10px 0" },
              { "sort": 11, "label": "值字号", "type": "input", "value": "18px" },
              { "sort": 12, "label": "值字宽", "type": "input", "value": "400" },
              { "sort": 13, "label": "值颜色", "type": "color", "value": "#fff" },
              { "sort": 14, "label": "图标位置", "type": "radio", "value": "prefix", "typeOptions": { "options": [{ "label": "前置", "value": "prefix" }, { "label": "后置", "value": "suffix" }] } },
              { "sort": 15, "label": "图标颜色", "type": "color", "value": "#fff" },
              { "sort": 16, "label": "图标大小", "type": "input", "value": "16px" },
              { "sort": 17, "label": "块背景图", "type": "input", "value": "" },
              { "sort": 18, "label": "显示查询", "type": "switch", "value": false },
              { "sort": 19, "label": "日期筛选", "type": "switch", "value": false },
              { "sort": 20, "label": "数字精度", "type": "number", "value": 0 },
              { "sort": 21, "label": "值内边距", "type": "input", "value": 0 },
              { "sort": 22, "label": "值外边距", "type": "input", "value": 0 },
              { "sort": 23, "label": "图标边距", "type": "input", "value": 0 }
            ]
          }
        ]
      },
      {
        "type": "pannel",
        "label": "卡片",
        "hidden": false,
        "icon": "",
        "img": "",
        "wrapperOption": {
          "number": 10002,
          "gutter": 0,
          "span": 24,
          "offset": 0,
          "push": 0,
          "pull": 0,
          "height": 350,
          "marginTop": 0,
          "margin": "0px 10px 10px 0px",
          "pannelColor": "",
          "dynamicStyle": { "padding": "10px", "backgroundColor": "" },
          "titleOption": {
            "hidden": false,
            "title": "月度趋势",
            "dynamicStyle": { "textAlign": "left", "padding": "0px", "height": "20px", "lineHeight": "20px", "fontSize": "14px", "color": "" },
            "moreOption": { "hidden": true, "icon": "More", "iconShow": false, "text": "更多", "linkurl": "/", "linktype": "router", "refresh": "0", "datetime": "0", "autotime": false, "autotimeval": 1, "dynamicStyle": { "color": "", "fontSize": "12px" } }
          }
        },
        "widgetList": [
          {
            "type": "bar",
            "label": "柱状图",
            "category": 0,
            "show": 1,
            "icon": "",
            "img": "",
            "widgetOption": {
              "number": 20002,
              "wrapperNumber": 10002,
              "span": 24,
              "offset": 0,
              "push": 0,
              "pull": 0,
              "height": 300,
              "marginTop": 0,
              "dynamicStyle": { "padding": "8px", "backgroundColor": "" }
            },
            "widgetParams": [
              {
                "sort": 0,
                "label": "数据来源",
                "type": "textarea",
                "value": "",
                "typeOptions": {
                  "rows": 3,
                  "dataJson": {
                    "xAxis": ["1月", "2月", "3月", "4月", "5月", "6月"],
                    "series": [
                      { "name": "销售额", "data": [120000, 132000, 101000, 134000, 190000, 230000] },
                      { "name": "退款额", "data": [12000, 8200, 9100, 4300, 9000, 13000] }
                    ]
                  }
                }
              },
              { "sort": 1, "label": "显示查询", "type": "switch", "value": false },
              { "sort": 2, "label": "X轴留白", "type": "switch", "value": true },
              { "sort": 3, "label": "柱状效果", "type": "select", "value": "shadow", "typeOptions": { "options": [{ "value": "shadow", "label": "shadow" }, { "value": "line", "label": "line" }, { "value": "none", "label": "none" }] } },
              { "sort": 4, "label": "单位", "type": "input", "value": "元" },
              { "sort": 5, "label": "标题", "type": "input", "value": "" },
              { "sort": 6, "label": "副标题", "type": "input", "value": "" },
              { "sort": 7, "label": "显示图例", "type": "switch", "value": true },
              { "sort": 8, "label": "图例排列", "type": "select", "value": "horizontal", "typeOptions": { "options": [{ "value": "horizontal", "label": "水平" }, { "value": "vertical", "label": "垂直" }] } },
              { "sort": 9, "label": "图例位置", "type": "select", "value": "center", "typeOptions": { "options": [{ "value": "center", "label": "居中" }, { "value": "left", "label": "左侧" }, { "value": "right", "label": "右侧" }] } },
              { "sort": 10, "label": "提示框", "type": "switch", "value": true },
              { "sort": 11, "label": "trigger", "type": "select", "value": "axis", "typeOptions": { "options": [{ "value": "axis", "label": "axis" }, { "value": "item", "label": "item" }, { "value": "none", "label": "none" }] } },
              { "sort": 12, "label": "显示工具箱", "type": "switch", "value": true },
              { "sort": 13, "label": "显示标签", "type": "switch", "value": true },
              { "sort": 14, "label": "标签位置", "type": "select", "value": "outside", "typeOptions": { "options": [{ "value": "inside", "label": "inside" }, { "value": "outside", "label": "outside" }, { "value": "center", "label": "center" }, { "value": "left", "label": "left" }, { "value": "right", "label": "right" }, { "value": "top", "label": "top" }, { "value": "bottom", "label": "bottom" }] } },
              { "sort": 15, "label": "分割线", "type": "switch", "value": true },
              { "sort": 16, "label": "日期筛选", "type": "switch", "value": false },
              { "sort": 17, "label": "旋转显示", "type": "switch", "value": false }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 十一、AI 生成 JSON 注意事项

1. **编号唯一性**：每个 `wrapperOption.number` 和 `widgetOption.number` 必须在整个页面中唯一
2. **关联一致**：`widgetOption.wrapperNumber` 必须等于其所在容器的 `wrapperOption.number`
3. **高度合理**：容器高度应 >= 内部组件高度之和
4. **widgetParams 完整**：必须包含该组件定义的所有 widgetParams（参考第八章），不能遗漏
5. **栅格布局**：span 总和 24 为一行，如 span=12 的两个容器为两列布局
6. **数据来源**：若使用接口引擎，value 格式为 `$ApiBase$/apiengine/{Key}--OsClient--$OsClient$--`
7. **默认值**：生成时应使用各参数的默认值，除非用户明确指定要修改
8. **配置完整**：formConfig 的所有字段都应包含，不能省略
9. **容器标题**：通过 `wrapperOption.titleOption.hidden = false` 显示，`hidden = true` 隐藏
10. **选项卡容器**：组件放在 `tabWidgetMap[tabKey][]` 中，不放在 `widgetList` 中
