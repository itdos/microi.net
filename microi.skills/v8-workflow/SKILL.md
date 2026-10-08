---
name: v8-workflow
description: Microi V8 工作流事件指南。用于编写审批流条件、节点 V8 代码、wf_flowdesign/wf_node/wf_line 逻辑、V8.WF 变量和工作流路由。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi V8 工作流事件开发

## AI / MCP 生成流程的必检契约

这里的流程是 `wf_flowdesign + wf_node + wf_line` 审批引擎，不是 `ai-workflow`。
先用 `microi_get_db_schema` 查询 `wf_flowdesign`、`wf_node`、`wf_line`、
`sys_menu` 与目标业务表，再用 `microi_list_roles` 或管理员只读表查询确认当前租户的
真实用户、角色、部门、岗位 Id。人工节点 `Approve/Countersign/End` 必须配置
`Users/Roles/Depts/BindJobs` 至少一种真实 `[{"Id":"...","Name":"..."}]`
绑定，或明确采用上游节点 `AllowSelectUsers=1` 手动选人。
应用安装母版可显式设置 `FlowDesign.IsEnable=0`（也接受字符串 `"0"`），
此时人工节点允许空绑定并保持禁用；`false/null/空字符串/省略` 不属于该例外。
禁用模板仍检查所有节点、连线、坐标及绑定格式，任何非空人员、角色、部门或岗位
仍必须通过当前租户真实 Id 回读。不得填入 `UNBOUND_*` 等不存在的占位 Id。
目标租户配置真实审批人后，应先重新检查再显式启用，并验收真实业务流转；
禁用模板保存成功只证明安装结构完整，不能当作审批已可用或商业交付完成。
`SameDeptApprove=1` 只筛选候选人，不能单独产生审批人。
不能把 `Roles:"Manager"`、字符串 Id 数组或另一个租户的 Id 当作绑定。

节点类型只使用 `Start/Auto/Business/Approve/Countersign/End/AutoEnd`；
`End` 是人工节点，自动结束用 `AutoEnd`。每个节点应有稳定 Id；
`PositionLeft/PositionTop` 使用像素（如 `"320px"`）。新版 MCP 对缺失坐标按
拓扑层级布局并补 `px`，明确重叠、非法类型、断线、不可达、无人审批会在写入前失败。
节点人员绑定在写入时仅保留 `Id/Name`，不能把完整 `sys_user` 记录及密码字段嵌入流程。
MCP 写入前会回读当前租户的用户、角色、部门和岗位 Id；回读失败或 Id 不存在时停止保存。

模块入口使用 `sys_menu.OpenType="WorkFlow"`、`FlowDesignId=<已启用流程真实 Id>`，
`DiyTableId` 与 `wf_flowdesign.TableId` 相同。完整 Manifest 内可用模块
`flowName` 指向同一份 `workflows[].FlowDesign.FlowName`，生成器保存流程后补写并回读
`FlowDesignId`；引用既有流程时传 `flowDesignId`。上线前从模块打开并发起一条真实
业务记录，确认流程图节点、人员待办、审批、历史与模块入口均正确。

全部配置字段、节点类型和运行操作见
[流程配置清单](references/workflow-configuration.md)。

你正在开发 Microi 吾码平台的工作流（审批流程）V8 事件。流程引擎基于表单引擎，通过 V8 事件控制审批逻辑。

## 后端类库与接口边界

- 工作流运行时固定属于独立 `Microi.WorkFlow` 类库；`Microi.net.Api` 只注册 `AddMicroiWorkFlow()`，不得恢复 `WorkFlowController` 或把流程业务写回 `Program.cs`。
- 对外与旧移动端路由统一由官方 Managed `platform-workflow` 接口引擎承载，历史 `/api/WorkFlow/*` 地址写入同一记录的 `ApiRoutes`。租户个性化逻辑写在 CreateIfMissing `platform-workflow-custom-hook`，默认只返回 `{ Code: 1 }`。
- `Microi.Core` 只保留避免循环引用所需的 `IWFEngine`、模型和最小运行时合同；发起、审批、撤回、移交、退回及审批人计算实现在 `Microi.WorkFlow`，并按职责拆分 partial 文件。
- 新业务规则仍优先写工作流 V8/接口引擎。只有事务、流程状态机、可信当前用户和运行时内核缺少不可伪造的底层原子时，才扩展 `Microi.WorkFlow`。
- 官方发布时 `Microi.WorkFlow` 必须生成 NuGet 包，并与 `Microi.AI` 使用同一 Obfuscar 配置加密后替换包内 DLL；不得推送未加密的 WorkFlow 包。开源安装只消费 NuGet，不要求存在私有源码。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-workflow-000 sha256=bd13a63ee55b2a01041fc2e080ca06ab2fbfd3146fa130811061c9f9e8b4cf84 -->
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
<!-- microi-progressive:chunk id=v8-workflow-001 sha256=935b29e9f3afde02aa78a77468b48afd204facb3b1dafaf9d23dc3bd69832717 -->
## 工作流物理表

| 表名 | 说明 |
|------|------|
| `wf_flowdesign` | 流程设计（流程定义） |
| `wf_node` | 流程节点 |
| `wf_line` | 节点间连线/条件 |
| `wf_flow` | 流程实例（一次发起对应一行） |
| `wf_work` | 待办/已办工作 |
| `wf_history` | 审批历史（每次同意/拒绝/撤回的记录） |

### 原生人员、自动结束与取消快照契约

- `wf_node.Users` 是 JSON 序列化的 `IdName` 对象数组，例如 `[{"Id":"<user-id>","Name":"审核人"}]`；不能保存为字符串 Id 数组。`Name` 仅供显示，业务授权仍须按当前主库用户、角色和实际待办接收人判断。前端 `V8.WF.ForceSelectUsers` 的字符串数组是另一份 API 契约，不能混用。
- 自动结束节点的 `NodeType` 使用 `AutoEnd`。它可能继承上一人工节点的 `ApprovalType=Agree`，并生成一条结束历史；核对独立审批人数时只计入明确配置的人工节点，不能把结束节点当成额外审核人。
- 原生 `CancelFlow` 可将请求中的 `FormData` 写回 `wf_flow.FormData`；未传时可能保存 `{}`。应用不能把取消后的实例 `FormData` 当成不可变的原始提交快照。需要恢复冻结业务单时，优先核对业务表保存的服务端快照摘要；若使用原生历史，必须限定同一实例、同一业务表/行、唯一原始开始节点及发起人、自动提交历史，并检查版本、金额、配置摘要和零待办。此分支只能恢复草稿或驳回状态，不能据此批准或过账。
- 当前 `CancelFlow(WFParam)` 使用独立事务，没有 `StartWork/SendWork` 的共享 `DbTrans` 重载。应用不得在持有实例、工作或业务行锁的接口事务内调用取消，也不能假设给它多传一个参数便会共享事务。微服务可顺序执行“服务端核验并返回真实待办坐标 → 原生取消 → 业务终态复核”，每个请求完成后释放其事务；网络结果未知时先复核终态，不能盲目重发取消或提前恢复业务状态。
- 业务接口与原生节点共同读取配置、公共引用和业务行时，先画出宿主与脚本合并的锁图。原生审批进入节点前可能已持有流程实例锁；既存流程的业务复核应先通过当前主库有界只读发现真实实例，再在同一共享事务锁定该实例，随后获取固定配置/引用锁及业务行锁，重读验证归属未变。待办发现扫描只读不能提前锁工作行后再等流程；公共引用围栏只协调锁序，不能读取配置值来继承授权。必须逐入口审查包括定义、身份与配置的相反锁序，不以一条 SQL 或单次模拟成功宣称全系统无死锁。
- 已由可信原生历史证明取消或驳回的终态恢复只校验原提交归属、当前授权和可恢复状态，不应要求审批期间未发生正常库存、成本或其他业务余额变化；此恢复不产生过账副作用。批准与过账仍必须严格比较冻结快照、当前期间及业务版本，并覆盖撤权、并发和响应未知时使用原请求键恢复。
- 真实原生多接收人流程中的 `OtherDone` 只表示同阶段并列待办被 `CloseOtherWork` 关闭，不是该接收人已经审批。仅在同实体/实例/定义/审批节点/来源节点与唯一真实 `Agree` + `Done` 工作精确绑定，接收人不同于实际办理人，且没有该并列工作办理历史时，才能作为终态旁证；不能把它计作独立审核人。开始提交、实际人工审批仍必须 `Done`，未知节点、待办、撤回、取消、重复历史或模糊绑定失败关闭。覆盖真实五工作（3 `Done`、2 `OtherDone`）原生来源及新稿/原键恢复，不能靠把状态统一映射为 `Done` 通过。
- 验收至少覆盖真实取消时不传 `FormData`、伪造取消载荷、退回后直接重提被拒绝、取消后新实例重提、自动结束继承 `Agree`，以及普通角色不能修改取证用的流程历史。模拟正确 JSON 不替代原生 HTTP 验收。

直接 SQL 查询常用场景：

```javascript
// 我的待办
var todo = V8.Db.FromSql(
  'SELECT Id, FlowId, NodeId, FlowTitle, WorkState, ReceiverId, TableRowId FROM wf_work WHERE ReceiverId = @p0 AND WorkState = @p1 ORDER BY CreateTime DESC'
).AddInParameter("@p0", V8.CurrentUser.Id)
 .AddInParameter("@p1", 'Todo')
 .ToArray();

// 我发起的
var mine = V8.Db.FromSql(
  'SELECT Id, FlowTitle, FlowState, SenderId, TableRowId FROM wf_flow WHERE SenderId = @p0 ORDER BY CreateTime DESC'
).AddInParameter("@p0", V8.CurrentUser.Id)
 .ToArray();

// 流程历史
var history = V8.Db.FromSql(
  'SELECT * FROM wf_history WHERE FlowId = @p0 ORDER BY CreateTime ASC'
).AddInParameter("@p0", V8.Param.flowId)
 .ToArray();
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-002 sha256=38a77bbee9ea30f036a9d9ef7150e2a738f4533dc9f05c23a3d00ff86aefc60d -->
## 流程 V8 事件执行顺序

工作流合并提交请求的 `_FormSubmitAction` 可使用 `Add/Edit`；表单后端事件中的
`V8.FormSubmitAction` 实际为 `Insert/Update/Delete`，两者不能混淆。删除事件把服务端
读取的待删除行放在 `V8.Form`，`V8.OldForm` 为空；校验删除归属、状态或引用时应以
`V8.Form.Id` 在共享事务中重新读取并锁定原行，不应假定 `OldForm` 与修改事件相同。

节点开始事件成功继续流转时保持 `V8.Result` 为空或设为布尔 `true`；不要用
`V8.Result={Code:1}`，非布尔结果会提前结束当前流转。节点校验失败应抛出异常，
尤其节点结束事件不可依赖 `return {Code:0}` 阻止事务提交。

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
<!-- microi-progressive:chunk id=v8-workflow-003 sha256=2cef523c79040139ffdfba070930ce94db18d5b3486fa35a2a694dafa2c8a186 -->
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
<!-- microi-progressive:chunk id=v8-workflow-004 sha256=99db9f8361d90ce1659922ee2497b7d2f235da009219b8b6a8f22d603b818eff -->
## ApprovalType 审批类型

| 值 | 说明 |
|---|---|
| `Agree` | 同意 |
| `Disagree` | 拒绝 |
| `Recall` | 撤回 |
| `Auto` | 发起流程(开始节点) / 业务节点 / 自动结束节点 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-workflow-005 sha256=28ada7e06b18590b20935fcaaa2006c868532db89838dfe3799ce2ca0f97c918 -->
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
<!-- microi-progressive:chunk id=v8-workflow-006 sha256=d3a984b0e45aed19da942e0fa6c4183751d6057b7360e6eb11068e538d598cf9 -->
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
## “我的工作”与审核界面交付规则

- 模块使用“流程引擎”打开方式时，关联流程只能选择已启用的 `wf_flowdesign`；交付前同时验证流程已启用、模块 `OpenType=WorkFlow`、`FlowDesignId` 正确，且开始节点不存在测试阻断 V8。
- `StartWork` / `DoWork` 必须通过工作流与表单合并提交能力保存。审核态只保留“处理工作”、流转记录/流程图和关闭；不得同时显示普通保存、取消编辑、草稿箱、删除、显示隐藏字段或普通表单更多按钮。
- “我的工作”菜单角标使用“未处理待办 + 未读抄送”。待办 Tab 显示未处理数，抄送 Tab 显示未读数；我发起的、我处理的、我相关的按各自列表查询口径统计，不能用 `wf_work` 的近似口径代替 `wf_flow` 列表口径。
- 新抄送项应显式保存 `IsRead=false`，用户打开后由可信后端按当前身份标记已读。历史 `CopyUsers` 项没有 `IsRead` 时按已读兼容，避免升级后把全部历史抄送误报为未读。
- “查看流程图”验收必须从真实流转记录入口打开，确认流程定义、当前节点高亮、连线和弹窗尺寸正常，并检查浏览器无脚本错误；只验证流程 JSON 拓扑不等于完成 UI 验收。

## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-节点开始-v8-事件.md](references/progressive-01-节点开始-v8-事件.md)：节点开始 V8 事件；节点结束 V8 事件；前端打开流程表单；MCP 创建/检查/测试工作流；发起流程与表单保存；流程相关表；注意事项
<!-- microi-progressive:end -->
