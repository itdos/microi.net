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
