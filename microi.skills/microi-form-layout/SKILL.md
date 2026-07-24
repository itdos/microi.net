---
name: microi-form-layout
description: Microi 吾码低代码表单布局分组规范。用于通过 MCP、Manifest、VS Code 插件或 V8 引擎创建/优化 `diy_table` 和 `diy_field` 时，决定使用 `diy_table.Tabs` 表单全局 Tab、字段级 `Tabs` 控件、字段级 `CollapseGroup` 折叠分组，还是直接平铺字段。覆盖"何时分 Tab、何时分折叠分组、字段数判断阈值、JSON 配置示例、回读验收与回滚"。
---

# Microi 表单布局分组规范（Tabs vs CollapseGroup）

Microi 吾码低代码提供 **三种** 表单分组能力，但每种都有明确的使用场景。**AI 必须先按本规范评估，再决定如何分组**，禁止盲目创建 Tab。

本 Skill 中的 Tabs、CollapseGroup、Divider 是编辑表单布局。模块级 Detail/Edit/List/Card 跨端视图必须配置在 `sys_menu.ViewSchema` 物理字段中；EntityHero、MetricStrip、ActionGrid、ResponsiveSection 属于独立视图区块，不得伪装成 `diy_field`。三个核心表的 `DiyConfig` 均已废弃，禁止作为新布局或新功能配置入口。

控件事实源：`Microi.Client/src/views/form-engine/diy-field-component/diy-component-list.json` 中 `Sort=1000` 附近的 `Divider`、`CollapseGroup`、`Tabs`、`Alert`、`StaticText`、`Html`、`RichText` 等都属于 Advanced 布局控件。

## 1. 三种分组能力速查

| 能力 | 存储位置 | 控件 | 核心作用 | 适用场景 |
|------|---------|------|---------|---------|
| **A. diy_table.Tabs（表级 Tab）** | `diy_table.Tabs`（JSON 字符串） | 表单顶部 Tab 条 | 把整张表的字段切到不同 Tab 中，**同屏只能看一个 Tab** | 单个 Tab 内**字段数 ≥ 8**，且 Tab 之间字段**业务强隔离**（基础信息 vs 业务明细 vs 附件） |
| **B. 字段级 Tabs 控件** | `diy_field.Component='Tabs'` + `Config.FieldTabs` | 字段本身就是 Tab 容器 | 多个 Tab 字段组合嵌套，**同屏只能看一个 Tab** | 同一张表内需要二级 Tab，或 Tab 内容互相独立 |
| **C. 字段级 CollapseGroup（折叠分组）** | `diy_field.Component='CollapseGroup'` + `Config.CollapseGroup` | 字段是折叠面板标题 | **所有分组可在同一页面展开**，用户一屏看到全部标题和分组字段 | Tab 内**字段数 ≤ 7** 的小分组（次要信息、可选信息、补充信息） |
| **D. 不分组（默认平铺）** | 无 | — | 全部字段在第一屏 | 表单字段总数 ≤ 12，且没有明显业务分组 |

## 2. 黄金决策流程（AI 必须按此顺序判断）

```
开始
  ↓
Q1: 表单总字段数（含 TableChild 子表、子表行字段）？
  ├─ ≤ 12 → D. 不分组（默认平铺）。【不要为 ≤12 字段的表创建任何 Tab】
  └─ 13 ~ 30
       ↓
       Q2: 字段是否能拆出 ≥ 2 个独立业务域（如"基础信息/明细/附件"）？
       ├─ 否 → D. 不分组，或用 CollapseGroup 把次要字段收起
       └─ 是
            ↓
            Q3: 每个业务域字段数？
            ├─ 全部 ≥ 8 → A. diy_table.Tabs（表级 Tab）
            └─ 存在 ≤ 7 的小业务域
                 ↓
                 混合方案：Tab 容纳大业务域（≥8 字段）+ CollapseGroup 收起小业务域（≤7 字段）
                 ↓
                 注意：所有 Tab 内的 ≤7 字段小业务域，必须用 CollapseGroup 折叠分组
  ↓
Q4: 总字段数 > 30？
  ├─ 是 → 优先 A. diy_table.Tabs，每个 Tab 字段数控制在 6~12；Tab 内若还有 ≤5 字段的小逻辑组，嵌套 CollapseGroup
  └─ 否 → 走 Q1 分支
```

**简明决策表**：

| 场景 | 推荐方案 | 禁止做法 |
|------|---------|---------|
| 13 字段表 + 1 个"MRP 运算"子集（3 字段） | C. CollapseGroup 折叠"MRP 运算"分组，剩余 10 字段平铺 | 禁止用 diy_table.Tabs 拆出"MRP 运算"Tab（用户必须点击切换才能看到 3 个字段） |
| 35 字段表 + 4 个业务域（10/8/9/8） | A. diy_table.Tabs（4 个 Tab） | 禁止把每个 Tab 内 ≤5 字段的"备注/其他"再开 Tab |
| 42 字段表 + 5 个业务域（14/13/6/5/4） | A. diy_table.Tabs（5 个 Tab），后两个 Tab 内用 C. CollapseGroup 收次要字段 | 禁止为了 4~5 字段"审核信息"单独建 Tab |
| 8 字段简单登记表 | D. 不分组 | 禁止任何 Tab/折叠 |
| 工作流审批表（≤10 字段） | D. 不分组 | 禁止使用 Tab |

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
  "Type": "varchar(50)",
  "Sort": 120,
  "Visible": 1,
  "AppVisible": 1,
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

**与 Tab 的关键区别**：所有 CollapseGroup 标题**始终可见**，分组内字段**默认展开**或**默认收起**，但所有分组的字段**都在同一页面**，可同时展开多个。

### 3.4 控件视觉对比

| 视觉表现 | Tabs | CollapseGroup |
|---------|------|---------------|
| 首屏可见字段数 | 仅一个 Tab 的字段 | **所有分组的标题 + 展开分组的字段** |
| 用户切换分组方式 | 必须点击 Tab 头 | 可直接滚动或逐个点击展开 |
| 同时看到多组 | ❌ | ✅ |
| 适合"展开后阅读" | ❌（频繁切换会烦） | ✅ |
| 适合"互斥分组" | ✅ | ❌ |

## 4. AI 生成表单布局的标准动作

### 4.1 必做顺序

1. **先数字段**：调用 `microi_get_field_list` 拉出全部字段，统计**有效字段数**（排除 `Visible=0` 隐藏字段、`Id`、系统字段）。
2. **再分业务域**：用 `Sort` 顺序浏览字段，把字段聚类到 2~5 个业务域（基础信息 / 业务明细 / 业主/组织 / 财务 / 附件备注 / 状态 / 时间 / 其他）。
3. **算每个域字段数**：A. 大于等于 8 → Tab；B. 小于等于 7 → CollapseGroup；C. 等于 0 → 删除该域。
4. **决定顶层方案**：A. 全 Tab / B. Tab+CollapseGroup 混合 / C. 全 CollapseGroup / D. 平铺。
5. **写配置**：先写 `diy_table.Tabs`（若有 Tab），再逐字段写 `Tab` 归属或 `Component=CollapseGroup`。
6. **回读验收**：调用 `microi_get_field_list` 回读，确认 `Tab` 字段、`Config.FieldTabs` / `Config.CollapseGroup` JSON 正确。
7. **清缓存**：`microi_refresh_schema_cache tables=['表名']`，避免前端看到旧配置。

### 4.2 后端实现备忘

后端表结构（`diy_table`）：
- `Tabs` 字段：JSON 字符串，存表级 Tab 列表。
- `TabsPosition` 字段：top / bottom / left / right。
- `TableTabs` / `TableTabsPosition`：表格视图的 Tab，与表单 Tab 独立。
- `FormArticle` / `TableArticle`：表单/表格的说明文案（不是 Tab）。

后端字段结构（`diy_field`）：
- `Tab` 字段：归属 Tab 名（与 `diy_table.Tabs.Id` 对应）。
- `Component = Tabs` / `CollapseGroup` / `Divider` / `Alert` 等 Advanced 控件，作为布局节点。
- `Config` 字段：JSON 字符串，存 `FieldTabs` / `CollapseGroup` 等子配置。

V8 事件中可用 `V8.HideFormTab('tabId')` / `V8.ShowFormTab('tabId')` / `V8.ClickFormTab('tabId')` 动态控制 Tab 显隐和默认选中。

## 5. 必填与禁止

### 5.1 必填

- 字段数 13~30 的表单，必须有可见的**业务分组**（Tab 或 CollapseGroup 二选一），不能让用户上下滚动 5 屏找字段。
- 创建 CollapseGroup 分组时，必须设置 `Icon`（如 `fas fa-calculator` / `fas fa-info-circle`），不要默认空白。
- 任何 Tab / CollapseGroup 都必须有 `Description` 解释分组用途，不要只放一个标题。
- 修改 `diy_table.Tabs` 或 `diy_field.Tab` / `Config.CollapseGroup` / `Config.FieldTabs` 后，必须调用 `microi_refresh_schema_cache`。
- Tab 内嵌套 CollapseGroup 时，CollapseGroup 必须设 `DefaultCollapsed=true`（默认收起），避免 Tab 内继续被折叠分组抢首屏空间。

### 5.2 禁止

- ❌ **禁止**为 ≤7 字段的业务域单独创建 Tab（必须改用 CollapseGroup）。
- ❌ **禁止**为 13~30 字段的表把所有字段平铺（必须用 Tab 或 CollapseGroup 分组）。
- ❌ **禁止**为 8~10 字段的简单业务表创建多层 Tab 嵌套（直接用 CollapseGroup 即可）。
- ❌ **禁止**在用户没有要求时使用 `Tabs` 字段控件（`diy_field.Component='Tabs'`），更优先用 `diy_table.Tabs`。
- ❌ **禁止**为 `Tabs` / `CollapseGroup` / `Divider` / `Alert` 等布局控件设置 `FormWidth=24`，这些控件天然占整行。
- ❌ **禁止**只创建 Tab 不写字段的 `Tab` 归属（每个 Tab 必须有至少 1 个非空 `Tab` 的字段）。
- ❌ **禁止**用 Tabs 控件的 `FieldCount` 跨过 CollapseGroup 或 Divider 计数（不同布局控件的计数是隔离的）。
- ❌ **禁止**把高频访问的字段（如单据编号、项目名称）放进默认收起的 CollapseGroup。

## 6. 验收清单

修改或新建表单布局后，AI 必须按以下顺序验收：

1. **回读字段**：`microi_get_field_list` 检查 `Tab` / `Component` / `Config` 与设计一致。
2. **回读表**：`microi_get_table_data _SelectFields=['Id'] _PageSize=1` 验证表可读。
3. **清缓存**：`microi_refresh_schema_cache tables=['表名']`。
4. **手动打开表单**：通过 Playwright 或 V8 引擎调用，截图第一屏。
5. **视觉确认**：
   - 第一屏必须能看到至少 6~10 个字段（而不是 2~3 个）。
   - Tab 或 CollapseGroup 标题与说明文字清晰可见。
   - 没有任何"只剩 1 个字段的 Tab"。
6. **业务闭环**：新建一条测试数据、编辑、查看、删除，验证字段在正确分组中显示。

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
microi_add_field({
  tableId: "01KTASHWEBE514R1XTB0WVJJRX",
  name: "MrpGroup",
  label: "MRP 运算",
  type: "varchar(50)",
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
  })
})

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

## 9. 与其他 Skill 的关系

- 字段创建流程：`v8-table-event/SKILL.md` 写 InFormV8 / SubmitFormV8 等。
- 外键 Id+Name 双字段：`ui-design/SKILL.md` 中的"外键字段必须使用 Id+Name 双控件设计"。
- 整行控件规则：`microi-system-delivery/SKILL.md` 中 `FormWidth=24` 的使用条件。
- 表单设计器与按钮：`v8-menu-buttons/SKILL.md`。
- V8 事件 Tab 显隐 API：`v8-table-event/SKILL.md` 中 `V8.HideFormTab` / `V8.ShowFormTab` / `V8.ClickFormTab`。
