---
name: v8-workflow
description: Microi V8 工作流事件指南。用于编写审批流条件、节点 V8 代码、wf_flowdesign/wf_node/wf_line 逻辑、V8.WF 变量和工作流路由。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 工作流事件开发

你正在开发 Microi 吾码平台的工作流（审批流程）V8 事件。流程引擎基于表单引擎，通过 V8 事件控制审批逻辑。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-workflow-000 sha256=9030cd2de9f1febfb9a749c82cf83e97ccb8fb972a3f8f0ff11067488e14cd8e -->
## 本地优先与版本头（必做）

工作流节点、连线条件、开始/结束节点等 V8 代码如果有本地文件，必须优先修改 `microi-v8-engine/<租户>/<项目>/...` 下的本地文件，再同步到数据库。插件提示本地/远端不一致时，先比对并合并，不得直接覆盖。

每次修改、上传、推送工作流 V8 事件代码，都要维护顶部版本区域。版本号从 `v1.0.0` 开始；每次上传/推送/修改递增 1；补丁位和次版本位最大为 9 并向前进位（`v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`）。代码头只写完整功能说明，不写修改历史、时间戳或 ChangeLog。

```javascript
/*
 * V8 工作流
 * WorkflowKey: 示例流程Key
 * EventType: WFNodeLine/WFNodeStart/WFNodeEnd
 * Version: v1.0.0
 * 功能说明：
 * - 完整说明该工作流 V8 控制的节点动作、路线条件、审批变量和副作用。
 */
```

保存工作流包前要先跑拓扑/条件检查；保存后用样例表单数据测试至少一条会经过该 V8 的路线。

生成工作流 V8 代码时，代码内容本身（文件头、普通注释、`console.log`、返回 `Msg` 等）不要包含 `Microi`、`吾码` 等平台品牌文字，除非业务数据或字段值本身必须如此。生成代码要有可维护注释：每个 `function` 前写清用途、关键参数和返回值；路线选择、审批人计算、状态回写、撤回/驳回处理、跨表联动等复杂代码段前写短注释说明业务原因；避免“给变量赋值”这类无信息量注释。若工作流存储表支持 `Version`/`ChangeHistory`，历史说明也必须最新在前并保留旧记录。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-001 sha256=013233bfa935a24b668691318ea79c2f0a95787d05d0b033b82859a5999878ba -->
## 工作流物理表

| 表名 | 说明 |
|------|------|
| `wf_flowdesign` | 流程设计（流程定义） |
| `wf_node` | 流程节点 |
| `wf_line` | 节点间连线/条件 |
| `wf_flow` | 流程实例（一次发起对应一行） |
| `wf_work` | 待办/已办工作 |
| `wf_history` | 审批历史（每次同意/拒绝/撤回的记录） |

直接 SQL 查询常用场景：

```javascript
// 我的待办
var todo = V8.Db.FromSql(
  'SELECT * FROM wf_work WHERE TodoUserId = @p0 AND Status = @p1 ORDER BY CreateTime DESC'
).AddInParameter("@p0", V8.CurrentUser.Id)
 .AddInParameter("@p1", 'Pending')
 .ToArray();

// 我发起的
var mine = V8.Db.FromSql(
  'SELECT * FROM wf_flow WHERE CreateUserId = @p0 ORDER BY CreateTime DESC'
).AddInParameter("@p0", V8.CurrentUser.Id)
 .ToArray();

// 流程历史
var history = V8.Db.FromSql(
  'SELECT * FROM wf_history WHERE FlowId = @p0 ORDER BY CreateTime ASC'
).AddInParameter("@p0", V8.Param.flowId)
 .ToArray();
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-002 sha256=1f94d40c041929aafc45ec975f42bcbbc50c3ba424ed499c7bdf65fa73a41041 -->
## 流程 V8 事件执行顺序

1. 用户点击发起流程或处理工作
2. **表单进入 V8 事件（前端 FormIn）**
3. 用户点击【提交】按钮
4. **节点开始 V8 事件（前端 WFNodeStart）**
5. 表单提交前 V8 事件（前端 FormSubmitBefore）
6. 表单提交前 V8 事件（后端 FormSubmitBefore）
7. 表单提交后 V8 事件（后端 FormSubmitAfter）
8. 表单提交后 V8 事件（前端）
9. 调用后端处理工作接口
10. **条件判断 V8 事件（后端 WFNodeLine）**
11. **节点开始 V8 事件（后端 WFNodeStart）**
12. **节点结束 V8 事件（后端 WFNodeEnd）**
13. **节点结束 V8 事件（前端 WFNodeEnd）**

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-003 sha256=f5776a5b8fe4e460f79e20e9806b3a80bcadf6f1e09408880bd5ca911cb79533 -->
## V8.WF 上下文属性

### 所有流程事件可访问

| 属性 | 类型 | 说明 |
|------|------|------|
| `V8.WF.ApprovalType` | string | 审批类型：`Agree`(同意)/`Disagree`(拒绝)/`Recall`(撤回)/`Auto`(自动) |
| `V8.WF.ApprovalIdea` | string | 用户填写的审批意见 |
| `V8.WF.AddUsers` | array | 用户添加的审批人 |
| `V8.WF.SelectUsers` | array | 用户选择的审批人 |
| `V8.WF.CurrentFlowDesign` | object | 当前流程设计图实体 |
| `V8.WF.CurrentNode` | object | 当前节点实体 |
| `V8.WF.BackNodeId` | string | 拒绝时选择退回的节点 Id |

### 节点开始事件（前端）额外属性

| 属性 | 说明 |
|------|------|
| `V8.WF.ForceSelectUsers` | 强制指定下一节点审批人（可写），赋值 `['userid1', 'userid2']` |

### 节点结束事件（后端）额外属性

| 属性 | 说明 |
|------|------|
| `V8.WF.NextNode` | 下一节点实体 |
| `V8.WF.NextTodoUsers` | 接收人，格式：`[{ Id: '', Name: '' }]` |

### 节点结束事件（前端）额外属性

| 属性 | 说明 |
|------|------|
| `V8.WF.WorkResult` | 流程执行结果（发送到了哪个节点、哪些审批人） |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-004 sha256=d8445c1d473579fde063179d6330eefaa2373f1166e837656b780058295de3a3 -->
## ApprovalType 审批类型

| 值 | 说明 |
|---|---|
| `Agree` | 同意 |
| `Disagree` | 拒绝 |
| `Recall` | 撤回 |
| `Auto` | 发起流程(开始节点) / 业务节点 / 自动结束节点 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-005 sha256=96e49e15fcb4b9da83f46b6818e198f338cb77ce76d11c56dfddebc2cc24f881 -->
## 条件判断 V8 事件（后端 WFNodeLine）

根据业务规则决定流程走向。优先推荐设置 `V8.NextNodeId` 直接指定下一节点；如仍使用条件线的条件值，也可以设置 `V8.LineValue`。

```javascript
// V8.EventName === 'WFNodeLine'
// V8.Form 是当前表单数据

if (V8.Form.Money <= 100) {
  V8.NextNodeId = 'node_id_1';    // 直接走指定下一节点（推荐）
} else if (V8.Form.Money <= 10000) {
  V8.LineValue = 2;             // 也可走条件值为 2 的线（兼容旧配置）
} else {
  V8.NextNodeId = 'node_id_3';
}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-006 sha256=e67b72bf060a38ed5f94a57f3978026d151bb971fcf47a0b30a434dba819c264 -->
## 前端发起流程

```javascript
// 在 V8 按钮或自定义逻辑中发起流程
V8.WF.StartWork({
  FlowDesignId: 'flow-design-id',      // 必传：流程设计 Id
  TableRowId: V8.Form.Id,               // 必传：关联数据 Id
  FormData: JSON.stringify(V8.Form),     // 可选：表单数据
  NoticeFields: JSON.stringify([         // 可选：通知字段
    { Id: 'field1', Name: 'Name', Label: '姓名', Value: V8.Form.Name }
  ])
}, function(result) {
  if (result.Code === 1) {
    V8.Tips('流程发起成功', true);
    V8.RefreshTable({ _PageIndex: 1 });
  } else {
    V8.Tips(result.Msg, false);
  }
});
```

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-节点开始-v8-事件.md](references/progressive-01-节点开始-v8-事件.md)：节点开始 V8 事件；节点结束 V8 事件；前端打开流程表单；MCP 创建/检查/测试工作流；发起流程与表单保存；流程相关表；注意事项
<!-- microi-progressive:end -->
