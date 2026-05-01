# Microi V8 工作流事件开发

你正在开发 Microi 吾码平台的工作流（审批流程）V8 事件。流程引擎基于表单引擎，通过 V8 事件控制审批逻辑。

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
  'SELECT * FROM wf_work WHERE TodoUserId = @p0 AND Status = @p1 ORDER BY CreateTime DESC',
  V8.CurrentUser.Id, 'Pending'
).ToArray();

// 我发起的
var mine = V8.Db.FromSql(
  'SELECT * FROM wf_flow WHERE CreateUserId = @p0 ORDER BY CreateTime DESC',
  V8.CurrentUser.Id
).ToArray();

// 流程历史
var history = V8.Db.FromSql(
  'SELECT * FROM wf_history WHERE FlowId = @p0 ORDER BY CreateTime ASC',
  V8.Param.flowId
).ToArray();
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

根据业务规则决定流程走向，`V8.LineValue` 对应流程图中条件线的条件值。

```javascript
// V8.EventName === 'WFNodeLine'
// V8.Form 是当前表单数据

if (V8.Form.Money <= 100) {
  V8.LineValue = 1;    // 走条件值为 1 的线（如：直接通过）
} else if (V8.Form.Money <= 10000) {
  V8.LineValue = 2;    // 走条件值为 2 的线（如：部门经理审批）
} else {
  V8.LineValue = 3;    // 走条件值为 3 的线（如：总经理审批）
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
V8.OpenFormWF(V8.Form, 'Edit', {
  WorkType: 'StartWork',
  FlowDesignId: 'flow-design-id'
});

// 查看流程
V8.OpenFormWF(V8.Form, 'View', {
  WorkType: 'ViewWork',
  FlowDesignId: 'flow-design-id'
});
```

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

- 条件判断 V8 事件中 `V8.LineValue` 的值必须与流程设计器中条件线的**条件值**对应
- 节点开始后端事件返回 `{ Code: 0, Msg: '...' }` 或 `V8.Result = { Code: 0 }` 可阻止流程提交
- 流程事件在事务中执行，任何节点返回失败都会回滚
- `V8.WF.ApprovalType === 'Auto'` 表示自动节点（发起、业务节点、自动结束），无需人工审批
- `V8.WF.ForceSelectUsers` 仅在**前端节点开始事件**中有效
