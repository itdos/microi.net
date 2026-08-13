# v8-workflow 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-workflow-007 sha256=9c40c62b67065c7e9f6821ef748d75595f004f069909258d9867490b74e115b7 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-008 sha256=f023312e7d95c518428c2e6d1df99b43cc36d41659aa75768b13ff83cf52b3b0 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-009 sha256=a927ce0325e130608823800c83c85d9e83d54fea61dbcfed32208d49f4012118 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-010 sha256=ea15dea212f044a16bdccbf75ebe3a28ce3eb3ff27c989e8c6b4ec567e170032 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-011 sha256=ab8c37da582f7463663ab9a609cf31e95c94e38181bc37b7c880a27f19f01a0e -->
## 发起流程与表单保存

新建业务数据并发起流程时，应先保存表单，再启动流程，或使用平台的合并接口 `StartWorkWithForm` 在同一事务里完成。首次发起建议以 `Add` 模式打开流程表单；如果前端提前生成了 `Id` 但业务表还没有该行，后端会使用 `_NoLineForAdd` 兜底，避免 `UptFormData` 报“数据显示不存在”。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-012 sha256=39a371dc5106862955945741a65c2fd08423cfedbc028e6aba0ba6aadde9cc34 -->
## 流程相关表

| 表 | 说明 |
|---|---|
| `WF_FlowDesign` | 流程图设计表 |
| `WF_Node` | 流程节点属性表 |
| `WF_Line` | 流程条件(线)属性表 |
| `WF_Flow` | 流程实例表 |
| `WF_Work` | 流程工作待办表 |
| `WF_History` | 流程轨迹表 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-013 sha256=1e0afbf91035c773357ab43dbc3658a62e368ce65ca329d1047d543558ea2e90 -->
## 注意事项

- 条件判断 V8 事件可以设置 `V8.NextNodeId` 直接指定下一节点；未设置时才按 `V8.LineValue` 匹配条件线的**条件值**
- 配置图形化条件时，节点/路线标识来自流程拓扑，条件名称只是规则名称，不要用条件名称覆盖 `wf_line.LineName`
- 节点开始后端事件返回 `{ Code: 0, Msg: '...' }` 或 `V8.Result = { Code: 0 }` 可阻止流程提交
- 流程事件在事务中执行，任何节点返回失败都会回滚
- `V8.WF.ApprovalType === 'Auto'` 表示自动节点（发起、业务节点、自动结束），无需人工审批
- `V8.WF.ForceSelectUsers` 仅在**前端节点开始事件**中有效
<!-- /microi-progressive:chunk -->
