/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：platform-background-task
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-background-task
// Version: v1.1.0
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

return V8.Method.ManageBackgroundTask(V8.Param);
