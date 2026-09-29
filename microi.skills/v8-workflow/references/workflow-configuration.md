# 工作流引擎配置清单

事实源：当前租户 `microi_get_db_schema`、`Microi.Core/Param/WFParam.cs`、
`Microi.WorkFlow` 运行时、PC `views/workflow/component`。下表只描述审批工作流。

## 定义、节点、连线

| 资源 | 可配置字段 | 用途与注意 |
|---|---|---|
| `wf_flowdesign` | `FlowName, Category, Description, Remark, Sort, Preview, JsonData` | 名称、分类、说明、排序、预览与画布数据；画布最终按 `wf_node/wf_line` 渲染。 |
| `wf_flowdesign` | `TableId, IsEnable, Roles, StartV8, EndV8` | 关联业务 `diy_table.Id`、启用、允许发起角色、流程开始/结束事件。模块流程只选已启用项。 |
| `wf_node` | `Id, NodeName, NodeType, Icon, Description, Remark, PositionLeft, PositionTop` | 稳定节点身份、类型和画布位置。坐标写为 CSS 像素；缺失时 MCP 自动布局。 |
| `wf_node` | `Users, Roles, Depts, BindJobs, SameDeptApprove` | 前四者是 `[{Id,Name}]` JSON 审批人来源；`SameDeptApprove` 只进一步筛选同部门候选人，不能单独提供接收人。不能伪造跨租户 Id。 |
| `wf_node` | `AllowSelectUsers, AllowAddUsers, AllowRecall, AllowHandOver, HideHandOverSelect, BackNodes, Timeout` | 上游手选下节点人员、加签、撤回、移交、隐藏移交选择、可退回节点、超时。`BackNodes` 保存 `[{Id,NodeName}]`；会签通常不启用手选。 |
| `wf_node` | `CopyUsers, DisplayFields, HideFields, EditFields, FieldsConfig, FieldsConfigComponent, TableId` | 抄送 `IdName` 列表、节点表单字段权限、配置组件与业务表。字段配置应从当前表真实字段建模。 |
| `wf_node` | `StartV8, StartV8Server, EndV8, EndV8Server, LineValueV8, AllowAddUserV8Code` | 前后端节点开始/结束事件、多出线选择与加签过滤代码。条件写在当前节点，不要误放在 `wf_line.V8Code`。 |
| `wf_line` | `Id, FromNodeId, ToNodeId, LineName, LineValue, V8Code` | 稳定线身份、端点、展示标题、条件值与兼容线代码。标题用“起点 到 终点”；分支由源节点 `LineValueV8` 指定 `V8.NextNodeId` 或 `V8.LineValue`。 |

`NodeType`：`Start` 发起；`Auto` 自动；`Business` 业务提交；
`Approve` 审批；`Countersign` 会签；`End` 人工结束；`AutoEnd` 自动结束。
人工节点必须有真实接收人策略，否则流程可能创建实例却无待办。

## 实例与操作

| 资源/动作 | 功能 |
|---|---|
| `wf_flow` | 流程实例、业务表/行、发起人、状态、最近表单 JSON、经办人与抄送汇总。`FormData` 会变化，不是原始快照。 |
| `wf_work` | 每个接收人的待办/已办；按 `ReceiverId + WorkState` 确定可处理工作。 |
| `wf_history` | 每一步的起止节点、连线、处理人、意见、表单与抄送历史。 |
| `StartWork / StartWorkWithForm` | 发起流程；新业务行建议使用合并表单提交接口。 |
| `SendWork / SendWorkWithForm` | 处理审批、业务节点、会签及后续自动节点。 |
| `GetStartWFNode / GetWFNodeModel / GetNextNodeConfirmUsers` | 查询开始节点、节点属性及下一节点接收人。 |
| `RecallWork / CancelFlow / HandOverWork` | 撤回、取消、移交。取消独立事务且可改写实例 `FormData`，须按业务终态复核。 |
| `GetWFWork / GetWFFlow / GetWFHistory / GetWFStats / MarkCopyRead` | 待办、实例、历史、统计与抄送已读。普通用户须走身份与菜单/工作权限边界。 |

## MCP 到模块的生成顺序

1. 查询当前租户业务表、角色、用户、部门、岗位和现有流程；不要复制其它租户 Id。
2. Manifest 写入 `workflows[]` 的 `FlowDesign/Nodes/Lines`；人工节点设置人员策略，
   所有连线指向同包节点，分支节点写 `LineValueV8`。
3. 模块设置 `openType:"WorkFlow"`、`table:"业务表名"`，同包流程传
   `flowName:"流程名称"`；现有流程传 `flowDesignId:"真实 Id"`。
4. 执行 `microi_plan_system`、`microi_check_workflow_package`，分支调用
   `microi_test_workflow_condition`；写入后回读三张定义表与 `sys_menu`，
   用实际账号发起、处理、查看历史与流程图。

`microi_check_workflow_package` 是本地结构检查；MCP 保存前还会核对当前租户的
用户、角色、部门和岗位 Id。账号是否仍有效、审批人是否有业务权限以及实际到达待办，
仍必须通过运行时与真实业务回读。
