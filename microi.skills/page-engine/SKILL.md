---
name: page-engine
description: 生成和审查 Microi 界面引擎 Page Engine 页面 JSON。用于创建仪表盘、图表、表格、地图、组件、页面布局，或校验 mic_page formData JSON。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 界面引擎（Page Engine）页面 JSON 生成

MCP 的生成/保存入口包含 `microi_build_page_design` 与 `microi_save_page_design`；版本治理入口见下文。保存工具写入后仍需回读 `mic_page`，不能把生成成功当作持久化成功。

你正在为 Microi 吾码平台生成界面引擎页面的 JSON 数据。界面引擎页面由 `formData` 对象描述，用户导入 JSON 即可使用。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=page-engine-000 sha256=5b79a31a8484bf0a618c2810e66c0ab542fd86ceeb76e7a5cd07a86284c4f6ac -->
## 设计器源码事件

只有在扩展界面引擎设计器源码时才使用全局事件总线。用
`EventBus.on(eventName, handler)` 监听保存、日期选择或组件跳转等事件，并在
组件卸载时逐项调用 `EventBus.off(eventName)`。重复挂载不解绑会造成一次操作
触发多次；普通页面 JSON 生成不需要注册事件总线。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-001 sha256=fa60ff07b50f0d1fdbbf8c3838e94f5de8333a9072c8a5b7e86c4cc91038dfd9 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-002 sha256=6a1a85b40bcb5f8be694b0aad73a805083acd0d6fcd9cba36278dc9b51d24dcb -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-003 sha256=8afb75b0e4d85ab9f56a7ba018e1cc50f758d3e604683d8c38d5f0a45d53f135 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-004 sha256=9c7c85bb0d25267d07e45d9abeb5691c2f0ffd9da233351cf2f448a9b848cea5 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-005 sha256=c1e31dede775f14761182fc197cf428d494806c4503a622ffdad3d16d091d3e0 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-006 sha256=f50da72e63e62c2e1ea2d47ad2294deba20d6ca1ed732835eeab1e794407306e -->
## 数据来源（widgetParams[0]）

大多数组件的第一个参数（sort=0）是"数据来源"：
- **静态数据**：`value` 为空，数据在 `typeOptions.dataJson` 中
- **动态接口**：`value` 设为接口地址，运行时请求替换 `dataJson`

**接口引擎地址格式：**
```
$ApiBase$/apiengine/{ApiEngineKey}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=page-engine-007 sha256=bf6b4a76b11f27e62fe55e91258e3edb547aeb8456efde9d1ff787136533bf70 -->
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

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-所有组件类型.md](references/progressive-01-所有组件类型.md)：所有组件类型；Office/PDF 在线预览自然语言生成规则；searchData 查询条件通用结构
- [references/progressive-02-版本历史-并发保存与回滚.md](references/progressive-02-版本历史-并发保存与回滚.md)：版本历史、并发保存与回滚；本地撤销、Vue 源码桥与资产包；生成 JSON 注意事项；经营看板周期筛选与布局规则
<!-- microi-progressive:end -->
