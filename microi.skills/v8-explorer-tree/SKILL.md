---
name: v8-explorer-tree
description: Microi.VSCode 插件 V8 资源管理器目录规范（表单引擎 / 字段V8事件 / 模块引擎按钮）。覆盖 diy_table V8 事件、diy_field V8 事件、sys_menu 按钮 JSON 拆分回写，含 7 条安全不变量。用于实现 VSCode V8 事件树、重构目录布局或处理 sys_menu 按钮 JSON 序列化。
---

# v8-explorer-tree — V8 资源管理器目录规范 v2（2026-05）

> 涉及文件：[Microi.VSCode/src/explorer/engineTreeProvider.ts](Microi.VSCode/src/explorer/engineTreeProvider.ts)、[Microi.VSCode/src/sync/syncManager.ts](Microi.VSCode/src/sync/syncManager.ts)、[Microi.VSCode/src/constants.ts](Microi.VSCode/src/constants.ts)、[Microi.VSCode/src/utils.ts](Microi.VSCode/src/utils.ts)、[Microi.Server/Microi.net.Api/Controllers/V8EngineController.cs](Microi.Server/Microi.net.Api/Controllers/V8EngineController.cs)

---

## 0. 命名规范（强制）

**所有目录与文件**统一使用 **中文（英文）** 形式，使用**全角括号 `（）`**：

| 元素 | 格式 | 示例 |
|------|------|------|
| 表 | `<表Label>（<表Name>）` | `仓库档案（diy_cangkuda）` |
| 字段 | `<字段Label>（<字段Name>）` | `仓库名称（CangKuName）` |
| 菜单 | `<菜单Name中文>（<菜单英文Name>）` | `订单管理（OrderManage）` |
| 事件 | `<事件中文名>（<EventType>）` | `前端表单进入V8事件（InFormV8）.js` |
| 字段事件 | `<事件中文名>（<英文Key>）` | `值变更V8事件（V8Code）.js` |
| 按钮 | `<按钮Name>（<按钮Id>）` | `指派（01K3X...）.js` |
| 按钮显隐 | `<按钮Name>_显隐判断（<按钮Id>）` | `指派_显隐判断（01K3X...）.js` |
| 按钮分类目录 | `<按钮类型中文>（<EnglishField>）` | `[行]更多按钮（MoreBtns）/` |

### 0.1 6 类表单 V8 事件中文名

| EventType | 中文名 |
|-----------|--------|
| InFormV8 | 前端表单进入V8事件 |
| SubmitFormV8 | 前端表单提交V8事件 |
| SubmitBeforeServerV8 | 后端提交前V8事件 |
| SubmitAfterServerV8 | 后端提交后V8事件 |
| ServerDataV8 | 后端数据V8事件 |
| OutFormV8 | 前端表单退出V8事件 |
| DataFilterV8 | 后端数据过滤V8事件 |

> 统一用“后端”，不要再生成“服务端”或“服务器端”可见目录/文件名。

### 0.2 4 类字段 V8 事件中文名

| Key | 中文名 |
|-----|--------|
| V8Code | 值变更V8事件 |
| KeyupV8Code | 键盘抬起V8事件 |
| V8TmpEngineTable | 表格列模板V8事件 |
| V8TmpEngineForm | 表单字段模板V8事件 |

### 0.3 6 类按钮中文名

| Field | 中文名 |
|-------|--------|
| PageTabs | 页面多Tab |
| PageBtns | [页面]更多按钮 |
| MoreBtns | [行]更多按钮 |
| FormBtns | [表单]更多按钮 |
| BatchSelectMoreBtns | [批量选择]更多按钮 |
| ExportMoreBtns | [导出]更多按钮 |

---

## 1. 当前结构（v1 基线）

```
<workspace>/microi-v8-engine/
├── 接口引擎/
│   └── <ApiEngineName>(<ApiEngineKey>).js    // 半角括号，保留不变
└── V8事件/
    └── <表Description(表Name)>/
        └── <EventType>.js                    // 扁平，无中文事件名
```

## 2. 目标结构（v2）

```
<workspace>/microi-v8-engine/<server>/<osClient>/
├── 接口引擎/                                                 // 保持不变
│   └── <分类>/<ApiEngineName>(<ApiEngineKey>).js
│
├── 表单引擎/
│   └── <表Label>（<表Name>）/
│       ├── 表单V8事件/
│       │   ├── 前端表单进入V8事件（InFormV8）.js              // 仅远端非空代码生成文件
│       │   ├── 前端表单提交V8事件（SubmitFormV8）.js
│       │   ├── 后端提交前V8事件（SubmitBeforeServerV8）.js
│       │   ├── 后端提交后V8事件（SubmitAfterServerV8）.js
│       │   ├── 后端数据V8事件（ServerDataV8）.js
│       │   ├── 前端表单退出V8事件（OutFormV8）.js
│       │   └── 后端数据过滤V8事件（DataFilterV8）.js
│       └── 字段V8事件/
│           └── <字段Label>（<字段Name>）/
│               ├── 值变更V8事件（V8Code）.js                   // 右键单表拉取后生成，仅远端非空代码生成文件
│               ├── 键盘V8事件（KeyupV8Code）.js
│               ├── 模板V8引擎（表格）（V8TmpEngineTable）.js
│               └── 模板V8引擎（表单）（V8TmpEngineForm）.js
│
└── 模块引擎/
    └── <父菜单Name>（<ParentMenuId>）/                     // 非叶子模块只显示子模块，不生成按钮目录
        └── <叶子菜单Name>（<LeafMenuId>）/
            ├── 页面多Tab（PageTabs）/                     // 叶子模块固定生成全部 6 个按钮目录，即使为空
            │   ├── <按钮Name>（<按钮Id>）.js              // V8Code，仅远端非空代码生成文件
            │   └── <按钮Name>_显隐判断（<按钮Id>）.js     // V8CodeShow，仅在非空时生成
            ├── [页面]更多按钮（PageBtns）/
            ├── [行]更多按钮（MoreBtns）/
            ├── [表单]更多按钮（FormBtns）/
            ├── [批量选择]更多按钮（BatchSelectMoreBtns）/
            └── [导出]更多按钮（ExportMoreBtns）/
```

### 2.1 ⚠️ 空代码不落文件规则（关键约束）

> **前端 V8 引擎**只要事件 / 按钮代码字符串非空（哪怕只有注释、空格），就会调用 Jint 解析并执行——产生不必要的 CPU 开销。
>
> 因此：拉取远端资源时，空 V8 代码**不要生成本地 `.js` 文件**。若历史同步留下空 `.js` 文件，且远端代码同样为空，应删除本地空文件，避免被“查看同步状态”误判为本地未推送。
>
> 用户需要清空远端代码时，可以把已有非空文件清空并推送；推送成功后插件应删除该本地空文件或对齐为“无本地文件”状态。

---

## 3. 数据流

### 3.1 表单 V8 事件（✅ 已实现 2026-05）

- **拉取**：复用 `GetV8EventList`。对每个返回项：
  1. 每张表固定生成表单 V8 事件目录
  2. 仅远端非空代码生成 `.js`；空代码不生成文件，历史空文件应删除
- **保存**：`parseEventFilePath` 解析新旧两种结构，调 `UpdateV8EventCode`
- **删除**：用户删除本地文件默认只删除本地文件，不自动清空远端；清空远端必须通过清空已有文件内容并执行推送，或使用明确的“清空远端代码”命令

### 3.2 字段 V8 事件（✅ 已实现 2026-05）

**接口**：
- `GET /api/V8Debug/GetFieldList?osClient&tableId` — 返回字段列表带 `V8Code/KeyupV8Code/V8TmpEngineTable/V8TmpEngineForm`
- `POST /api/V8Debug/UpdateField` — Body 含 `Id` 或 `TableName + Name`，仅 V8 字段更新时直接写 `diy_field`，不触发表字段物理列变更

**实施清单**：
1. 在 `engineTreeProvider.ts` 的表节点加 inline action「拉取此表字段V8事件」
2. 调 `GetFieldList` 拿字段，对每个字段固定生成 4 个文件：`字段V8事件/<Label>（<Name>）/<事件中文>（<Key>）.js`
3. 保存时按文件路径解析 `(TableId, FieldName, V8Key)` → 调 `UpdateField`

### 3.3 sys_menu 按钮 JSON 拆分（✅ 已实现 2026-05）

**接口**：
- `GET /api/V8Debug/GetModule?osClient&moduleId` — 返回菜单详情含 6 类按钮 JSON
- `POST /api/V8Debug/UpdateModule` — Body 含 `OsClient/ModuleId` 及 6 类按钮 JSON

**拉取**：
1. 解析 `PageTabs/PageBtns/MoreBtns/FormBtns/BatchSelectMoreBtns/ExportMoreBtns` 6 个 JSON 数组（非法 JSON 记录错误并跳过该字段）
2. 按 `ParentId` 生成与 `sys_menu/GetSysMenuStep` 一致的模块树；非叶子模块只生成子模块目录，不生成按钮目录
3. 叶子模块固定生成全部 6 个按钮分类目录，即使远端数组为空
4. 对每个按钮：
  - 仅在 `V8Code` 非空时生成 `<按钮Name>（<按钮Id>）.js`
  - 若 `V8CodeShow` 非空 → 生成 `<按钮Name>_显隐判断（<按钮Id>）.js`
  - 在空按钮目录中新建 `<按钮Name>（<按钮Id>）.js` 并推送时，可按文件名创建远端新按钮
5. `.microi-meta.json` 写入按钮 JSON hash；回写前写 `.backups/<moduleId>/<ButtonField>-<timestamp>.json`

**保存（事务，必须满足 §4 全部不变量）**：
1. 从文件路径解析 `ModuleId / ButtonField / ButtonId / V8Code 或 V8CodeShow`
2. 二次调 `GetModule` 拉远端当前 JSON
3. JSON 解析失败立即中止
4. **Id-Diff 合并**：只修改目标按钮的 `V8Code` 或 `V8CodeShow`，远端其它按钮全部原样保留
5. 写一份 `.backups/<moduleId>/<ButtonField>-<timestamp>.json`（变更前的远端 JSON）
6. 调 `UpdateModule` 整段写回；任何一步失败不写库

**修改状态**：接口引擎、表单V8事件、字段V8事件、模块按钮文件都必须写入 `.microi-meta.json` 的 `updateTime/filePath`；本地 `mtime > updateTime + 1s` 时树节点显示 `已修改`，推送成功后同步更新 meta 并将文件 mtime 设置为远端更新时间以清除标记。

**Controller OsClient 规则**：`CheckPermission()` 返回的 `token` 是 `dynamic`。调用 `V8McpLogic.ResolveOsClient` 时必须传 `(object)token`，并让 `ResolveOsClient(string osClient, object currentToken)` 返回真正的 `string`；Controller 中 OsClient 空判断用 `string.IsNullOrWhiteSpace(osClient)`，不要对 `osClient` 调 `DosIsNullOrWhiteSpace()`。

---

## 4. 风险与不变量（实施 Stage 2/3 前必读）

| # | 不变量 | 违反后果 | 检测手段 |
|---|--------|---------|---------|
| I1 | 按钮 `Id` 必须保留且唯一 | 远端按钮丢失/重复 | 文件名中 `（<Id>）` 段 + 头部 `@ButtonId` 双校验，二者必须一致 |
| I2 | 远端按钮在本地缺失时**保留**而非删除 | 用户只拉了一类按钮就保存 → 其余被清空 | 保存前必须 `GetModule` 重新拉取做 Id-Diff |
| I3 | 远端整段 JSON 哈希在保存前必须匹配 | 多人/多端冲突覆盖 | `.microi-menu.json.RemoteHash` 检查 |
| I4 | 任何 JSON 解析失败必须中止保存 | JSON 损坏 | try/catch + 弹窗 |
| I5 | 按钮元数据头被用户改坏（如 `@ButtonId` 被删） | 写回失败 | 元数据头丢失 → 该文件标记 dirty，提示从远端覆盖 |
| I6 | 每次回写前自动写 `.backups/<timestamp>.json` | 误操作可恢复 | 强制执行，无配置开关 |
| I7 | 用户重命名/删除按钮文件 | 误操作 | 重命名按 Id 匹配；删除需弹窗输入按钮名二次确认 |

---

## 5. 实施状态（2026-05-22）

- ✅ **Stage 1 表单V8事件分层 + 中文命名 + 空代码跳过文件生成** —— 已实现
- ✅ **Stage 2 字段V8事件** —— 已实现：右键单表拉取字段 V8 事件；空代码不生成文件；推送仅更新目标字段的目标 V8 字段
- ✅ **Stage 3 sys_menu 按钮拆分** —— 已实现：主拉取同步模块引擎；按钮 V8Code 仅在非空时生成 `.js`；推送前重拉远端 JSON、按 ButtonId 只改目标按钮并保留其它按钮，写入前自动备份
- ✅ **Stage 4 树形模块引擎 + 全类型修改状态** —— 已实现：模块按 ParentId 树形拉取；非叶子只显示子模块；叶子固定生成 6 个按钮目录；字段/按钮文件也显示并清除 `已修改`

---

## 6. 实施约束总结

- **不要**在没看过 §4 全部 7 条不变量就动手实现 Stage 3
- **不要**为远端空代码生成 `.js` 文件；历史空 `.js` 文件在同步收尾时应删除
- **不要**用半角括号；统一用全角 `（）`
- **不要**清空 V8事件/ 旧目录；保留兼容直到用户主动删除
- 文件名中 `<英文Key>` 段必须 ASCII，避免 Windows 不可见字符

## 7. AI 远端修改后的同步约束

AI 使用 MCP、接口引擎、数据库脚本或平台 API 修改远端 V8 代码后，必须在任务收尾时同步本地 V8 资源树，并用“查看同步状态”或等价 dry-run 复核。

- 远端写入后以远端当前生效代码为准，回写本地文件并更新/对齐 meta 与文件 mtime。
- 覆盖范围至少包含本次 touched 的接口引擎、表单 V8 事件、字段 V8 事件、模块按钮 V8、工作流节点 V8、数据源 V8。
- 若没有插件 API 可调用，可在 `.tmp/` 编写一次性同步脚本；脚本必须先 dry-run 输出差异数量，再 apply。
- 收尾复核应确认 touched 范围没有 `changed/created/local-only` 差异；若存在差异，必须在最终回复中说明原因。
- 空 V8 代码不生成本地 `.js` 文件；同步收尾时应清理历史空文件。
- 插件“查看同步状态”不能只显示数量。若本地未推送数量大于 0，必须能列出具体资源类型、Key、名称、同步基准时间、本地修改时间和文件路径，并支持直接打开该文件。
- 表单事件、字段事件、按钮事件等远端 Key 比对要做大小写兼容；当本地代码与远端代码相同但 mtime 晚于 meta 时，应自动刷新 meta/mtime，避免误报“本地未推送”。
