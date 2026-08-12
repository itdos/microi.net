---
name: v8-table-event
description: Microi V8 表单事件开发。用于编写 InFormV8、SubmitFormV8、SubmitBeforeServerV8、SubmitAfterServerV8、OutFormV8、DataFilterV8 和事务感知事件。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 表单事件开发

你正在开发 Microi 吾码平台的 V8 表单事件。事件绑定在表单引擎的表上，在数据操作的不同阶段自动触发。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-table-event-000 sha256=dd86294c8cf42f580b2eb806d981c239c0efc2934505c0716e804de2f8a9235c -->
## 本地优先与版本头（必做）

AI 本地开发表单 V8 事件时，优先修改 `microi-v8-engine/<租户>/<项目>/表单引擎/.../<事件Label>（<EventType>）.js` 本地文件，再通过 MCP 或 VS Code 插件同步到数据库。文件中文名必须取 `diy_table` 对应 `diy_field.Label`，其中 `SubmitFormV8` 为 `前端表单提交前V8事件（SubmitFormV8）.js`，`OutFormV8` 为 `前端表单提交后V8事件（OutFormV8）.js`。若插件显示“本地和远端不一致”，先读取本地与远端并合并有效差异，不能直接覆盖。

每一次修改、上传、推送 `InFormV8.js`、`SubmitFormV8.js`、`SubmitBeforeServerV8.js`、`SubmitAfterServerV8.js`、`OutFormV8.js`、`DataFilterV8.js` 等事件文件，都必须维护顶部版本区域。版本号从 `v1.0.0` 开始；每次上传/推送/修改递增 1；补丁位和次版本位最大为 9 并向前进位（`v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`）。代码头只写完整功能说明，不写修改历史、时间戳或 ChangeLog。

```javascript
/*
 * V8 Event
 * TableKey: 示例表Key
 * EventType: SubmitBeforeServerV8
 * Version: v1.0.0
 * 功能说明：
 * - 完整说明该事件的触发时机、校验/加工逻辑、读写字段和阻止提交条件。
 */
```

同步流程：`读取远端 -> 修改本地并递增语义版本头 -> JS 语法检查 -> 保存远端 -> 回读远端确认版本头一致 -> 查询 mic_data_version 确认形成新版本 -> 执行触发该事件的最小表单操作验证`。表单设计器保存和 MCP 保存共用服务端代码版本链路；只有代码真实变化才新增版本，普通布局/字段属性保存不得产生代码版本。修改记录不得写进事件代码头。

使用 MCP 时，先调用 `microi_list_events` 发现事件，再用
`microi_get_event_code` 读取目标源码；修改后通过 `microi_save_event_code`
保存并回读。不要把接口引擎的保存工具用于表单事件，也不要在未读取远端
版本时直接覆盖。

生成 V8 事件代码时，代码内容本身（文件头、普通注释、`console.log`、返回 `Msg` 等）不要包含 `Microi`、`吾码` 等平台品牌文字，除非业务数据或字段值本身必须如此。生成代码要有可维护注释：每个 `function` 前写清用途、关键参数和返回值；提交前校验、提交后联动、字段显隐、数据脱敏、跨表写入、复杂条件判断等代码段前写短注释说明业务原因；避免“给变量赋值”这类无信息量注释。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-001 sha256=7bad55ca6781e6ca458a0333a47c71a3bad30334d146e940496c45c4ffa7ddf5 -->
## 事件类型

| 事件 | 运行端 | V8.EventName | 触发时机 | 用途 |
|------|--------|-------------|---------|------|
| `InFormV8.js` | **前端** | `FormIn` | 表单打开时 | 初始化字段显隐、默认值 |
| `SubmitFormV8.js` | **前端** | `FormSubmitBefore` | 表单提交时 | 前端校验、数据预处理 |
| `OutFormV8.js` | **前端** | `FormOut` | 表单提交后离开时 | 刷新列表、跳转 |
| `SubmitBeforeServerV8.js` | **后端** | `FormSubmitBefore` | 数据写入 DB 之前 | 服务端校验、数据加工 |
| `SubmitAfterServerV8.js` | **后端** | `FormSubmitAfter` | 数据写入 DB 之后 | 触发通知、同步其它表、日志 |
| `DataFilterV8.js` | **后端** | `DataFilter` | 获取列表/表单数据后 | 每行数据加工、脱敏、补充字段 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-002 sha256=1956a46955c57434582c8dd5a41ffe9d445a74f42b26706c7d2033dfb822ffc0 -->
## 事件触发规则

- 后端 V8 事件 / 接口引擎中调用 `V8.FormEngine` 增删改 → **不触发**表单 V8 事件
- 传入 `_InvokeType: 'Client'` → **触发**表单 V8 事件
- Postman 等直接调用接口 → 前端事件**不执行**，后端事件**仍执行**
- 服务器端提交前/后 V8 事件在**同一事务**中执行
- `diy_table.V8Unlimited` 只控制该表的后端提交前、提交后和数据处理 V8；仅当事件链必须保持一个事务且无法安全分片时开启。它解除当前 Jint Engine 的超时、语句、函数递归和累计分配限制，但不解除进程常驻内存、取消、并发、接口嵌套深度、权限和数据库保护。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-003 sha256=65a1e728982d4e534d06dc2440eac111fe53a08f0a3012c6a9f8b1de45b4b81f -->
## ⚠️ 关键陷阱（必读）

### 1. 设计模式保护（前端事件必加）

```javascript
// 防止【表单设计器】中编辑字段时误触发事件
if (V8.LoadMode === 'Design') return;
```

### 2. 死循环禁忌

- ❌ **禁止** 在 `SubmitFormV8.js` 中调 `V8.FormSubmit()` —— 无限递归
- ❌ **禁止** 在 `FieldValueChange` 中 `V8.FormSet(同字段, ...)` —— 循环触发
- ❌ **禁止** 在后端提交前/后事件中再次写当前表；即使默认 Server 调用不递归，也可能覆盖本次增量数据、引发死锁或重复副作用。确需跨表联动时使用同一 `V8.DbTrans`，且不要传 `_InvokeType:'Client'`

### 3. 阻止提交（后端）

后端事件返回 `{ Code: 0, Msg: '错误' }` 平台自动回滚事务并阻止提交：

```javascript
if (V8.Form.Money > 100000 && V8.CurrentUser.RoleName.indexOf('总经理') === -1) {
  return { Code: 0, Msg: '金额超过 10 万必须总经理提交' };
}
```

### 4. 共享事务操作其它表

```javascript
// 在 SubmitBeforeServerV8 / SubmitAfterServerV8 中
V8.FormEngine.UptFormData('OtherTable', { Id: 'x', Field: 'v' }, V8.DbTrans);
V8.ApiEngine.Run('other-engine', { Form: V8.Form }, V8.DbTrans);
// 不传 V8.DbTrans 会导致并行事务、可能死锁或脏读
```

### 5. 模板引擎与 DataFilterV8 的区别

- 数据**加工**（计算字段、脱敏、查关联表名）→ 用 `DataFilterV8`（后端，每行执行，可用 `V8.CacheData` 防 N+1）
- 数据**渲染**（颜色徽章、HTML、图片）→ 用【表格 V8 模板引擎】，详见 `v8-template-engine/SKILL.md`

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-004 sha256=d3852ea4ed2f399ca19b537372d7f53a7d8f667d39ebd215210957fb8b6d9c0f -->
## 前端事件特有 API

```javascript
// 普通 diy-form 中设置字段值（触发目标字段值变更事件）
// diy-table 列表上下文只更新当前行和模板，不递归触发目标字段 V8
V8.FormSet('FieldName', 'value');
V8.FormSet('DropdownField', { Id: 1, Name: '选项' }); // 下拉框

// 设置字段属性
V8.FieldSet('FieldName', 'Visible', false);     // 隐藏字段
V8.FieldSet('FieldName', 'Readonly', true);      // 只读字段
V8.FieldSet('FieldName', 'Required', true);      // 必填
V8.FieldSet('FieldName', 'Data', [{Id:1, Name:'选项'}]); // 动态设置数据源

// 访问字段属性
var isReadonly = V8.Field.UserName.Readonly;
// 属性：Name, Label, Config, Data, Readonly, Visible, Placeholder 等

// 前端提示
V8.Tips('操作成功', true);    // 成功提示（1秒消失）
V8.Tips('操作失败', false);   // 错误提示（5秒消失）

// 确认框
V8.ConfirmTips('确定删除？', function() { /* 确定 */ }, function() { /* 取消 */ });
// content 使用 HTML 模式渲染；只能传固定文案或已转义内容，复杂交互用 OpenAppDialog

// 前端 HTTP 请求
V8.Post('/api/xxx', { key: 'value' }, function(res) { });
V8.Get('/api/xxx', {}, function(res) { });

// 前端调用接口引擎
var result = await V8.ApiEngine.Run('engineKey', { param1: 'value' });

// 当前表单模式
V8.FormMode      // 'Add' / 'Edit' / 'View'
V8.FormOutAction // 'Insert' / 'Update' / 'Close' / 'Delete'

// 刷新表格
V8.RefreshTable({ _PageIndex: 1 });  // -1 = 最后一页

// 表单操作
V8.FormSubmit({ CloseForm: true });   // 提交表单（不能在提交前事件中调用）
V8.FormClose();                        // 关闭表单
V8.ReloadForm({ Id: 'xxx' }, 'Edit'); // 重新加载

// 按钮和Tab控制
V8.HideFormBtn('Update');  // 隐藏按钮：'Delete' / 'Save' / 'Update'
V8.HideFormTab('tabName'); // 隐藏Tab
V8.ShowFormTab('tabName'); // 显示Tab
V8.ClickFormTab('tabName'); // 选中Tab
```

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-informv8-js-表单打开事件.md](references/progressive-01-informv8-js-表单打开事件.md)：InFormV8.js — 表单打开事件；SubmitFormV8.js — 前端提交校验；SubmitBeforeServerV8.js — 服务端提交前；SubmitAfterServerV8.js — 服务端提交后；DataFilterV8.js — 服务端数据处理事件；事件上下文变量
- [references/progressive-02-前端事件名-v8-eventname-可能的值.md](references/progressive-02-前端事件名-v8-eventname-可能的值.md)：前端事件名（V8.EventName 可能的值）；注意事项
<!-- microi-progressive:end -->
