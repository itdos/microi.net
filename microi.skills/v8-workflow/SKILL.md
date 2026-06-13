---
name: v8-workflow
description: Microi V8 工作流事件指南。用于编写审批流条件、节点 V8 代码、wf_flowdesign/wf_node/wf_line 逻辑、V8.WF 变量和工作流路由。
---

# Microi V8 工作流事件开发

你正在开发 Microi 吾码平台的工作流（审批流程）V8 事件。流程引擎基于表单引擎，通过 V8 事件控制审批逻辑。

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

## ApprovalType 审批类型

| 值 | 说明 |
|---|---|
| `Agree` | 同意 |
| `Disagree` | 拒绝 |
| `Recall` | 撤回 |
| `Auto` | 发起流程(开始节点) / 业务节点 / 自动结束节点 |

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

## 节点开始 V8 事件

### 前端 — 指定审批人

```javascript
// V8.EventName === 'WFNodeStart'
// 可以强制指定下一节点审批人
if (V8.Form.DeptId === 'special-dept') {
  V8.WF.ForceSelectUsers = ['user-id-1', 'user-id-2'];
}
```

### 后端 — 阻止流程提交

```javascript
// V8.EventName === 'WFNodeStart'
// 返回 Code: 0 可以阻止流程提交并回滚事务
if (!V8.Form.ApprovalFiles) {
  V8.Result = { Code: 0, Msg: '请先上传审批附件' };
}
```

## 节点结束 V8 事件

### 后端 — 流程结束后业务处理

```javascript
// V8.EventName === 'WFNodeEnd'
var approvalType = V8.WF.ApprovalType;

// 同意 — 更新业务状态
if (approvalType === 'Agree') {
  // 判断是否到达最终节点
  var nextNode = V8.WF.NextNode;
  if (!nextNode || nextNode.NodeType === 'End') {
    // 流程结束，更新业务状态
    V8.FormEngine.UptFormData(V8.TableModel.Name, {
      Id: V8.Form.Id,
      ApprovalStatus: 'Approved',
      ApprovalTime: DateNow('yyyy-MM-dd HH:mm:ss')
    });
  }
}

// 拒绝 — 回退状态
if (approvalType === 'Disagree') {
  V8.FormEngine.UptFormData(V8.TableModel.Name, {
    Id: V8.Form.Id,
    ApprovalStatus: 'Rejected',
    RejectReason: V8.WF.ApprovalIdea
  });
}

// 撤回
if (approvalType === 'Recall') {
  V8.FormEngine.UptFormData(V8.TableModel.Name, {
    Id: V8.Form.Id,
    ApprovalStatus: 'Draft'
  });
}

// 通知下一审批人
if (V8.WF.NextTodoUsers && V8.WF.NextTodoUsers.length > 0) {
  for (var i = 0; i < V8.WF.NextTodoUsers.length; i++) {
    V8.ApiEngine.Run('send-notification', {
      userId: V8.WF.NextTodoUsers[i].Id,
      title: '您有新的审批任务',
      content: V8.CurrentUser.Name + '提交了' + V8.TableModel.Name + '审批'
    });
  }
}
```

### 前端 — 流程提交后提示

```javascript
// V8.EventName === 'WFNodeEnd'
if (V8.WF.WorkResult) {
  V8.Tips('流程已提交', true);
}
```

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

## 前端打开流程表单

```javascript
// 发起流程
V8.OpenFormWF(V8.Form, 'Add', {
  WorkType: 'StartWork',
  FlowDesignId: 'flow-design-id'
});

// 查看流程
V8.OpenFormWF(V8.Form, 'View', {
  WorkType: 'ViewWork',
  FlowDesignId: 'flow-design-id'
});
```

## MCP 创建/检查/测试工作流

从自然语言需求创建审批流时，优先整理成完整 Manifest 的 `workflows` 配置，再走 MCP 干跑和验收流程。

```json
{
  "workflows": [
    {
      "FlowDesign": { "FlowName": "请假审批", "table": "diy_leave", "IsEnable": 1 },
      "Nodes": [
        { "Id": "start", "NodeName": "发起人", "NodeType": "Start", "LineValueV8": "" },
        { "Id": "leader", "NodeName": "部门负责人审批", "NodeType": "Approve", "Roles": "dept-leader" },
        { "Id": "end", "NodeName": "结束", "NodeType": "End" }
      ],
      "Lines": [
        { "Id": "line_start_leader", "FromNodeId": "start", "ToNodeId": "leader", "LineName": "发起人 到 部门负责人审批", "LineValue": "" },
        { "Id": "line_leader_end", "FromNodeId": "leader", "ToNodeId": "end", "LineName": "部门负责人审批 到 结束", "LineValue": "" }
      ]
    }
  ]
}
```

MCP 操作顺序：

1. `microi_get_db_schema`：确认业务表、已有流程、角色、字段。
2. `microi_get_manifest_schema`：按 Manifest 协议生成 tables/modules/workflows。
3. `microi_plan_system`：本地干跑，必须修复 workflow 拓扑错误。
4. `microi_check_workflow_package`：单独检查某个 workflow package。
5. `microi_test_workflow_condition`：对图形条件生成的 `LineValueV8` 传入样例 `formData`，验证会选中哪条路线。
6. `microi_generate_system` 或 `microi_save_workflow_package`：用户明确确认后再写入。

工作流建模规则：

- 必须有且仅有 1 个开始节点，至少 1 个结束节点。
- 所有 `wf_line.FromNodeId/ToNodeId` 必须指向存在的节点。
- 线路标题 `LineName` 默认使用 `{起点节点名称} 到 {终点节点名称}`，不要把业务条件名写成线路标题。
- 条件名称只作为图形配置/注释标记里的业务说明；修改条件名称不应改变线路标题。
- 多出线节点必须配置条件判断 V8，优先设置 `V8.NextNodeId`，只有兼容旧条件值时才设置 `V8.LineValue`。
- 图形条件生成的 V8 会带 `MICROI_WF_LINE_CONDITION_JSON` 标记，MCP 测试工具只解析该标记，不执行任意手写 V8。

## 发起流程与表单保存

新建业务数据并发起流程时，应先保存表单，再启动流程，或使用平台的合并接口 `StartWorkWithForm` 在同一事务里完成。首次发起建议以 `Add` 模式打开流程表单；如果前端提前生成了 `Id` 但业务表还没有该行，后端会使用 `_NoLineForAdd` 兜底，避免 `UptFormData` 报“数据显示不存在”。

## 流程相关表

| 表 | 说明 |
|---|---|
| `WF_FlowDesign` | 流程图设计表 |
| `WF_Node` | 流程节点属性表 |
| `WF_Line` | 流程条件(线)属性表 |
| `WF_Flow` | 流程实例表 |
| `WF_Work` | 流程工作待办表 |
| `WF_History` | 流程轨迹表 |

## 注意事项

- 条件判断 V8 事件可以设置 `V8.NextNodeId` 直接指定下一节点；未设置时才按 `V8.LineValue` 匹配条件线的**条件值**
- 配置图形化条件时，节点/路线标识来自流程拓扑，条件名称只是规则名称，不要用条件名称覆盖 `wf_line.LineName`
- 节点开始后端事件返回 `{ Code: 0, Msg: '...' }` 或 `V8.Result = { Code: 0 }` 可阻止流程提交
- 流程事件在事务中执行，任何节点返回失败都会回滚
- `V8.WF.ApprovalType === 'Auto'` 表示自动节点（发起、业务节点、自动结束），无需人工审批
- `V8.WF.ForceSelectUsers` 仅在**前端节点开始事件**中有效
