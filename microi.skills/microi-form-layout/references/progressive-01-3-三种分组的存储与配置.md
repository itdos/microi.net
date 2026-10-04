# microi-form-layout 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-form-layout-006 sha256=a78b000a9fee46d8394b0b6cb186702e520ab513f7eff098f2226f1158e46970 -->
## 3. 三种分组的存储与配置

### 3.1 diy_table.Tabs（表级 Tab）

存储：`diy_table.Tabs`（JSON 字符串）+ 每个字段的 `diy_field.Tab`（归属 Tab 名）。

```jsonc
// diy_table.Tabs JSON 格式
[
  { "Id": "basic",   "Name": "基础信息", "Sort": 10 },
  { "Id": "business","Name": "业务明细", "Sort": 20 },
  { "Id": "attach",  "Name": "附件备注", "Sort": 30 }
]
```

字段归属：在 `diy_field.Tab` 写 `Id`（不是 `Name`）。`Tab` 留空的字段属于"非 Tab 字段"（即 `diy_table.Tabs` 之外的字段），会作为隐藏的剩余字段自动归到最后 Tab。

- 字段 `Tab="basic"` → 归属"基础信息"Tab
- 字段 `Tab=""` 且 `diy_table.Tabs` 存在 → 自动归到最后一个 Tab 的剩余字段
- 字段 `Tab=""` 且 `diy_table.Tabs` 不存在 → 全部在第一屏平铺

**不推荐用法**：把 `diy_table.Tabs` 拆出 3 个 Tab、每个 Tab 内只有 2~3 个字段。这会让用户必须点击 3 次 Tab 才能看完一张表，且首屏只看到 2~3 个字段。

### 3.2 字段级 Tabs 控件（`diy_field.Component='Tabs'`）

存储：`diy_field` 行 + `Config.FieldTabs`（JSON）。

```jsonc
// diy_field 必要字段
{
  "Id": "TabsField_Main",
  "Name": "TabsMain",
  "Label": "主分组",
  "Component": "Tabs",
  "Type": "varchar(50)",
  "Sort": 50,
  "Visible": 0,        // 通常设为 0，因为 Tabs 本身是布局控件
  "AppVisible": 0,
  "Config": "{\"FieldTabs\":{...}}"
}

// Config.FieldTabs
{
  "ScopeMode": "FieldCount",   // 或 "Manual"
  "TotalFieldCount": 0,        // 0 表示直到下一个 Tabs
  "DefaultActiveKey": "tab1",
  "Type": "card",               // "" | "card" | "border-card"
  "Position": "top",            // top | bottom | left | right
  "Stretch": false,
  "ShowFieldCount": true,
  "CaptureRest": true,
  "Description": "",
  "Theme": "default",
  "Tabs": [
    { "Key": "tab1", "Title": "页签一", "Icon": "fas fa-info-circle", "FieldCount": 6, "Disabled": false }
  ]
}
```

**作用范围**：从该 Tabs 字段开始，到下一个 `Component in (Tabs, CollapseGroup, Divider)` 字段为止。

### 3.3 字段级 CollapseGroup 折叠分组（`diy_field.Component='CollapseGroup'`）

存储：`diy_field` 行 + `Config.CollapseGroup`（JSON）。

```jsonc
// diy_field 必要字段
{
  "Id": "CollapseGroup_MRP",
  "Name": "MrpGroup",
  "Label": "MRP 运算",
  "Component": "CollapseGroup",
  "Type": "",
  "Sort": 120,
  "Visible": 1,
  "AppVisible": 1,
  "FormWidth": 24,
  "Config": "{\"CollapseGroup\":{...}}"
}

// Config.CollapseGroup
{
  "DefaultCollapsed": false,            // 默认展开；高频访问分组可设 false
  "ScopeMode": "UntilNextGroup",        // 直到下一个折叠/Tab/Divider
  "FieldCount": 5,                      // ScopeMode=FieldCount 时生效
  "Description": "MRP 运算结果与时间",
  "Icon": "fas fa-calculator",
  "Theme": "primary",                    // default | primary | success | warning | danger
  "ShowFieldCount": true
}
```

**作用范围**：从该 CollapseGroup 字段开始，到下一个 `Component in (Tabs, CollapseGroup, Divider)` 字段为止。

**默认值硬规则**：`CollapseGroup` 必须保存 `FormWidth=24`（PC 表单 100% 宽度）；
`Config.CollapseGroup.ShowFieldCount` 省略时必须补为 `true`。只有用户明确要求隐藏数量时
才允许写 `ShowFieldCount=false`，只有用户明确要求非整行实验布局时才允许覆盖宽度。

**与 Tab 的关键区别**：所有 CollapseGroup 标题**始终可见**，分组内字段**默认展开**或**默认收起**，但所有分组的字段**都在同一页面**，可同时展开多个。

### 3.4 控件视觉对比

| 视觉表现 | Tabs | CollapseGroup |
|---------|------|---------------|
| 首屏可见字段数 | 仅一个 Tab 的字段 | **所有分组的标题 + 展开分组的字段** |
| 用户切换分组方式 | 必须点击 Tab 头 | 可直接滚动或逐个点击展开 |
| 同时看到多组 | ❌ | ✅ |
| 适合"展开后阅读" | ❌（频繁切换会烦） | ✅ |
| 适合"互斥分组" | ✅ | ❌ |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-form-layout-007 sha256=5944a965b1ac9a5c87a0e066af7f6489d2b5cd09e55fff7dc4e43d8d3a029fd6 -->
## 7. 反例参考（必须避免）

### 反例 1：MRP 运算 3 字段单独建 Tab

```
❌ 错误：
diy_table.Tabs = [
  { Id: 'basic',  Name: '基础信息' },     // 5 字段
  { Id: 'mrp',    Name: 'MRP 运算' },     // 3 字段
  { Id: 'remark', Name: '备注' }          // 1 字段
]
// 用户打开表单，第一屏只看到 5 个"基础信息"字段，"MRP 运算"和"备注"被藏在 Tab 里

✅ 正确：
// 不创建 diy_table.Tabs，把"MRP 运算" 3 字段用 CollapseGroup 收在表单末尾（默认展开）
// 把"备注"也用 CollapseGroup 或 Divider 收
// 第一屏用户能看到所有基础信息 + MRP 运算
```

### 反例 1.1：项目收款记录拆成 2/9/2 三个 Tab

```
❌ 错误：
项目(2 个短字段) + 收款(9 个短字段) + 附件备注(2 个整行字段)分别建 Tab。
结果是每页只有 1~5 行内容，桌面抽屉出现大面积空白，用户要切换三次才能看完整记录。

✅ 正确：
取消表级 Tab，按原顺序建立“项目信息 / 收款信息 / 附件备注”三个 CollapseGroup。
核心组默认展开，低频附件备注可默认收起；保留原字段、数据源、必填规则和 V8 代码。
```

### 反例 2：13 字段表全平铺

```
❌ 错误：
// 13 字段全部 Tab 留空
// 用户必须向下滚动 3 屏才能看到所有字段

✅ 正确：
// 13 字段按业务分两组：8 字段"基础信息" + 5 字段"业务明细"
// 用 1 个 diy_table.Tabs（基础信息 + 业务明细）
// 或用 1 个 CollapseGroup 把"业务明细"5 字段收起
```

### 反例 3：42 字段表用 6 个 Tab

```
❌ 错误：
// 6 个 Tab：基础(14) + 项目业主(2) + 发货通知(13) + 生产需求(3) + 审核(4) + ERP出库(4) + 其他(2)
// 用户要点 6 次才能看完，且"项目业主"和"生产需求"这种 2~3 字段的 Tab 完全没必要

✅ 正确：
// 4 个 Tab：基础(14) + 发货通知+生产需求(16) + 审核+ERP出库(8) + 其他(4)
// 或 3 个 Tab + 内部嵌套 CollapseGroup
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-form-layout-008 sha256=1d93c83d865ef941f62c4e8e0dd6238489645bf53367b61e6e397543447dcdbd -->
## 8. 快速参考代码片段

### 8.1 MCP 创建表级 Tab

```js
// 假设已创建 diy_table，通过 microi_update_table 设置 Tabs
// 注意：microi_create_table 不直接接收 Tabs JSON，需创建后 microi_update_table 补全
microi_update_table({
  name: "yutaoliaojieguo",
  // 暂未直接传 Tabs，需要通过 microi_update_table 文档化的方式补全
})
```

> 实际写入 `diy_table.Tabs` 优先用 `microi_update_field` 之外的元数据写入方式或 `microi_upsert_engine` 委托接口引擎；后续 MCP 工具可补强 `Tabs` 参数。

### 8.2 MCP 创建字段级 CollapseGroup

```js
// 1. 创建一个 CollapseGroup 字段
microi_add_layout_field({
  tableId: "01KTASHWEBE514R1XTB0WVJJRX",
  name: "MrpGroup",
  label: "MRP 运算",
  component: "CollapseGroup",
  sort: 150,
  visible: 1,
  appVisible: 1,
  config: JSON.stringify({
    CollapseGroup: {
      DefaultCollapsed: false,
      ScopeMode: "UntilNextGroup",
      Description: "MRP 运算状态、批次号与时间",
      Icon: "fas fa-calculator",
      Theme: "primary",
      ShowFieldCount: true
    }
  }),
  confirmExecution: "MrpGroup"
})

// 工具默认写入 FormWidth=24；回读必须确认宽度为 24 且 ShowFieldCount=true。

// 2. 让"MRP 运算"相关字段归属到该 CollapseGroup
// 范围方式：把 CalcStatus、CalcBatchNo、MrpTime 三个字段的 Sort 排在 150~300 之间，
// 下一个 CollapseGroup/Tabs/Divider 字段之前的所有字段都属于该分组
```

### 8.3 MCP 把字段 Tab 归属到 diy_table.Tabs

```js
// 创建表级 Tab
// 1. microi_update_table 设置 diy_table.Tabs 字段（待 MCP 工具补全）
// 2. 给字段写 Tab 归属
microi_update_field({
  id: "01KVTWDJ7WXB3Z60HGJ5BPTBJ0",
  tab: "basic"  // 归属到 diy_table.Tabs.Id='basic' 的 Tab
})
```

<!-- /microi-progressive:chunk -->
