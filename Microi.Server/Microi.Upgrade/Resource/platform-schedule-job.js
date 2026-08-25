// Microi官方接口引擎：platform-schedule-job
// Version: v1.0.0
// 表数据、状态合并与动作编排在接口引擎；Quartz 仅通过最小 V8 原子能力访问。

var action = String((V8.Param && V8.Param.Action) || '').trim();
var tableName = 'diy_schedule_job';

if (action === 'List') {
  var pageIndex = Math.max(1, Number(V8.Param._PageIndex || V8.Param.PageIndex || 1));
  var pageSize = Math.max(1, Math.min(100, Number(V8.Param._PageSize || V8.Param.PageSize || 15)));
  var list = V8.FormEngine.GetTableData(tableName, {
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC'
  });
  if (!list || list.Code !== 1 || !list.Data) return list;
  var names = [];
  for (var i = 0; i < list.Data.length; i++) {
    if (list.Data[i].JobName) names.push(String(list.Data[i].JobName));
  }
  var runtime = V8.Method.ManageScheduleJob({ Action: 'GetByNames', Names: names });
  var runtimeRows = runtime && runtime.Code === 1 && runtime.Data ? runtime.Data : [];
  for (var rowIndex = 0; rowIndex < list.Data.length; rowIndex++) {
    for (var runtimeIndex = 0; runtimeIndex < runtimeRows.length; runtimeIndex++) {
      if (String(runtimeRows[runtimeIndex].JobName || '').toLowerCase()
          === String(list.Data[rowIndex].JobName || '').toLowerCase()) {
        list.Data[rowIndex].Status = runtimeRows[runtimeIndex].Status;
        list.Data[rowIndex].LastTime = runtimeRows[runtimeIndex].LastTime;
        list.Data[rowIndex].NextTime = runtimeRows[runtimeIndex].NextTime;
        list.Data[rowIndex].CronExpression = runtimeRows[runtimeIndex].CronExpression;
        break;
      }
    }
  }
  return list;
}

if (action === 'Detail') {
  var detail = V8.FormEngine.GetFormData(tableName, { Id: String(V8.Param.Id || '') });
  if (!detail || detail.Code !== 1 || !detail.Data) return detail;
  var detailRuntime = V8.Method.ManageScheduleJob({
    Action: 'GetDetail',
    JobName: detail.Data.JobName
  });
  if (detailRuntime && detailRuntime.Code === 1 && detailRuntime.Data) {
    detail.Data.Status = detailRuntime.Data.Status;
    detail.Data.LastTime = detailRuntime.Data.LastTime;
    detail.Data.NextTime = detailRuntime.Data.NextTime;
    detail.Data.CronExpression = detailRuntime.Data.CronExpression;
  }
  return detail;
}

if (action === 'Save') {
  return V8.Method.SaveScheduleJob(V8.Param);
}

if (action === 'Pause' || action === 'Resume' || action === 'Delete') {
  var runtimeResult = V8.Method.ManageScheduleJob({
    Action: action,
    Id: String(V8.Param.Id || ''),
    JobName: String(V8.Param.JobName || V8.Param.Name || '')
  });
  if (!runtimeResult || runtimeResult.Code !== 1) return runtimeResult;
  if ((action === 'Pause' || action === 'Resume') && V8.Param.Id) {
    var updateResult = V8.FormEngine.UptFormData(tableName, {
      Id: String(V8.Param.Id),
      Status: action === 'Pause' ? '暂停' : '正常'
    });
    if (!updateResult || updateResult.Code !== 1) return updateResult;
  }
  return runtimeResult;
}

return { Code: 0, Msg: '不支持的任务调度动作。' };
