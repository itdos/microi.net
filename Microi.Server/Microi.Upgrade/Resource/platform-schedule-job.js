/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-schedule-job
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-schedule-job
 * Version: v1.0.2
 * Function:
 * - 管理当前租户任务列表、运行态、保存、暂停、恢复和删除；兼容旧Job路由，表单保存先检查RuntimeOnly能力后只同步Quartz。
 */

// Microi官方接口引擎：platform-schedule-job
// Version: v1.0.2
// 表数据、状态合并与动作编排在接口引擎；七条旧 /api/Job/* 路由按可信请求路径兼容。

var param = V8.Param || {};
var action = String(param.Action || '').trim().toLowerCase();
var requestPath = String(param._RequestPath || '')
  .trim()
  .replace(/--osclient--.*--$/i, '')
  .replace(/\/+$/, '')
  .toLowerCase();
var legacyRouteActions = {
  '/api/job/getalljob': 'list',
  '/api/job/getjobdetail': 'detail',
  '/api/job/addjob': 'save',
  '/api/job/updatejob': 'save',
  '/api/job/pausejob': 'pause',
  '/api/job/resumejob': 'resume',
  '/api/job/deletejob': 'delete'
};
var legacyAction = legacyRouteActions[requestPath];
if (legacyAction) {
  if (String(param._HttpMethod || '').toUpperCase() !== 'POST') {
    return { Code: 0, Msg: '任务调度旧接口仅支持 POST。' };
  }
  // 旧路由本身是动作的权威事实源，禁止请求体 Action 把 Pause 等地址切换成其它动作。
  action = legacyAction;
}
var tableName = 'diy_schedule_job';

if (action === 'list') {
  var pageIndex = Math.max(1, Number(param._PageIndex || param.PageIndex || 1));
  var pageSize = Math.max(1, Math.min(100, Number(param._PageSize || param.PageSize || 15)));
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

if (action === 'detail') {
  var detail = V8.FormEngine.GetFormData(tableName, { Id: String(param.Id || '') });
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

if (action === 'save') {
  // 旧节点可能忽略新增参数；先确认能力，禁止回退到会重复写当前表的旧保存路径。
  if (param.RuntimeOnly === true) {
    var capability = V8.Method.ManageScheduleJob({ Action: 'Capabilities' });
    if (!capability || capability.Code !== 1 || !capability.Data || capability.Data.RuntimeOnly !== true) {
      return { Code: 0, Msg: '当前平台后端不支持任务表单事务保存，请先更新平台后端，再更新SaaS引擎应用。' };
    }
  }
  var saveResult = V8.Method.SaveScheduleJob(param);
  if (!saveResult || saveResult.Code !== 1 || !saveResult.Data) return saveResult;
  return {
    Code: saveResult.Code,
    Data: saveResult.Data,
    DataCount: saveResult.DataCount || 0,
    Msg: saveResult.Msg || '',
    DataAppend: {
      LastTime: saveResult.Data.LastTime || '',
      NextTime: saveResult.Data.NextTime || '',
      Status: saveResult.Data.Status || '正常'
    }
  };
}

if (action === 'pause' || action === 'resume' || action === 'delete') {
  var runtimeAction = action === 'pause' ? 'Pause' : (action === 'resume' ? 'Resume' : 'Delete');
  var runtimeResult = V8.Method.ManageScheduleJob({
    Action: runtimeAction,
    Id: String(param.Id || ''),
    JobName: String(param.JobName || param.Name || '')
  });
  if (!runtimeResult || runtimeResult.Code !== 1) return runtimeResult;
  if ((action === 'pause' || action === 'resume') && param.Id) {
    var updateResult = V8.FormEngine.UptFormData(tableName, {
      Id: String(param.Id),
      Status: action === 'pause' ? '暂停' : '正常'
    });
    if (!updateResult || updateResult.Code !== 1) return updateResult;
  }
  return runtimeResult;
}

return { Code: 0, Msg: '不支持的任务调度动作。' };
