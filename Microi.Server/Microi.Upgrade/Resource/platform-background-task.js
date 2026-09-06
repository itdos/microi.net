/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：platform-background-task
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-background-task
// Version: v1.1.1
// 说明：后台任务的动作白名单与参数编排位于接口引擎；V8.Method 只提供无法由
// FormEngine/Db 安全实现的持久任务运行时原子能力。

var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowedActions = {
  List: true,
  Detail: true,
  Status: true,
  WorkerStatus: true,
  ClearCompleted: true,
  Remove: true,
  Cancel: true,
  RunApiEngine: true
};

if (!allowedActions[action]) {
  return { Code: 0, Msg: '不支持的后台任务动作。' };
}

var result = V8.Method.ManageBackgroundTask(V8.Param);
if (action != 'RunApiEngine' || !result || result.Code != 1 || !result.Data) {
  return result;
}

// 兼容旧运行时返回持久记录的情况。提交接口只公开摘要，详情仍由 Detail 按所有者授权读取。
// 后台执行的数据库幂等键、分布式并发租约与接口引擎锁保持原有保护。
var item = result.Data;
var summary = {};
var fields = ['Id', 'Title', 'Type', 'ApiEngineKey', 'Status', 'StatusText', 'Progress',
  'ProgressMode', 'Current', 'Total', 'CreateTime', 'StartTime', 'EndTime', 'HeartbeatTime',
  'EstimatedEndTime', 'RemainingSeconds', 'RemainingText', 'EstimateConfidence',
  'ElapsedSeconds', 'ElapsedText', 'CancelRequested', 'AttemptCount', 'MaxAttempts',
  'ExecutionCount', 'BusinessTable', 'BusinessId'];
for (var index = 0; index < fields.length; index++) {
  var value = item[fields[index]];
  if (value !== undefined) summary[fields[index]] = value;
}
summary.Msg = String(item.Msg || '').substring(0, 2000);
summary.HasLog = item.HasLog === true || !!item.Log;
summary.HasResult = item.HasResult === true || !!item.Result;
return { Code: 1, Data: summary, Msg: String(result.Msg || '') };
