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
 * Version: v1.1.1
 * Function:
 * - 管理当前租户任务列表、运行态、保存、暂停、恢复和删除；兼容旧Job路由，表单保存先检查RuntimeOnly能力后只同步Quartz。
 */

// Microi官方接口引擎：platform-schedule-job
// Version: v1.1.0
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

if (action === 'logs' || action === 'historylogs') {
  return V8.Method.ManageScheduleJob({
    Action: action, JobName: String(param.JobName || ''), SearchMonth: String(param.SearchMonth || ''),
    PageSize: Math.max(1, Math.min(100, Number(param.PageSize || 20))),
    BeforeLogTime: param.BeforeLogTime || '', BeforeLogId: param.BeforeLogId || ''
  });
}

// 只读诊断保留调度器原始失败和节点状态，不能用元数据的“正常”掩盖未执行。
if (action === 'diagnostics') {
  var diagnosticNames = param.JobName ? [String(param.JobName)] : [];
  var diagnostic = V8.Method.ManageScheduleJob({ Action: 'GetByNames', Names: diagnosticNames });
  if (!diagnostic || diagnostic.Code !== 1) return diagnostic;
  diagnostic = JSON.parse(JSON.stringify(diagnostic));
  // 只查询运行态已经验证归属的单个 JobKey；不得按客户端传入的 Group 查询其它租户。
  diagnostic.DataAppend = diagnostic.DataAppend || {};
  if (diagnostic.Data && diagnostic.Data.length === 1) {
    try {
      diagnostic.DataAppend.StoreTriggers = V8.Db.FromSql(
        'SELECT SCHED_NAME,TRIGGER_NAME,TRIGGER_STATE,NEXT_FIRE_TIME,PREV_FIRE_TIME,MISFIRE_INSTR '
        + 'FROM microi_job_triggers WHERE JOB_NAME=@jobName AND JOB_GROUP=@jobGroup'
      ).AddInParameter('@jobName', diagnostic.Data[0].JobName)
        .AddInParameter('@jobGroup', diagnostic.Data[0].Group).ToArray();
      diagnostic.DataAppend.StoreTriggerCount = V8.Db.FromSql(
        'SELECT COUNT(*) AS TriggerCount FROM microi_job_triggers WHERE JOB_GROUP=@jobGroup'
      ).AddInParameter('@jobGroup', diagnostic.Data[0].Group).ToArray();
      diagnostic.DataAppend.StoreHeartbeat = V8.Db.FromSql(
        'SELECT SCHED_NAME,MAX(LAST_CHECKIN_TIME) AS LastCheckinTime,COUNT(*) AS Nodes '
        + 'FROM microi_job_scheduler_state GROUP BY SCHED_NAME'
      ).ToArray();
      // MySQL 元数据仅返回体积/估算行数，不对多年日志执行 COUNT(*)。
      try {
        diagnostic.DataAppend.HistoryStorage = V8.Db.FromSql(
          'SELECT ENGINE,TABLE_ROWS,DATA_LENGTH,INDEX_LENGTH FROM INFORMATION_SCHEMA.TABLES '
          + 'WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tableName'
        ).AddInParameter('@tableName', 'diy_schedule_job_log').ToArray();
        diagnostic.DataAppend.HistoryQueryPlan = V8.Db.FromSql(
          'EXPLAIN SELECT Id,JobName,CreateTime FROM diy_schedule_job_log '
          + 'WHERE JobName=@jobName AND (IsDeleted=0 OR IsDeleted IS NULL) ORDER BY LogTime DESC LIMIT 15'
        ).AddInParameter('@jobName', diagnostic.Data[0].JobName).ToArray();
        diagnostic.DataAppend.HistoryIndexes = V8.Db.FromSql(
          'SELECT INDEX_NAME,SEQ_IN_INDEX,COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS '
          + 'WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tableName ORDER BY INDEX_NAME,SEQ_IN_INDEX'
        ).AddInParameter('@tableName', 'diy_schedule_job_log').ToArray();
        diagnostic.DataAppend.DatabaseWaits = V8.Db.FromSql(
          'SELECT TIME,STATE,COMMAND FROM INFORMATION_SCHEMA.PROCESSLIST '
          + 'WHERE DB=DATABASE() AND COMMAND<>@idle AND TIME>@seconds'
        ).AddInParameter('@idle', 'Sleep').AddInParameter('@seconds', 10).ToArray();
      } catch (metadataError) {
        diagnostic.DataAppend.StorageMetadataUnavailable = true;
      }
    } catch (storeError) {
      diagnostic.DataAppend.StoreReadError = String(storeError.message || storeError);
    }
  }
  return diagnostic;
}

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
