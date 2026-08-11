/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-scheduler-reconcile
 * Version: v1.0.3
 * Function:
 * - 管理员幂等校准 AI 内容发布的 08:30 与 16:30 Quartz 任务，并在触发器已存在时修复 diy_schedule_job 元数据状态。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以校准调度元数据。' };

function parseHttpResult(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); }
  catch (error) { return { Code: 0, Msg: '任务调度接口返回了无效 JSON。' }; }
}

var tokenInfo = V8.Method.GetCurrentToken() || {};
var apiBase = String((V8.SysConfig && V8.SysConfig.ApiBase) || '').replace(/\/$/, '');
if (!apiBase || !tokenInfo.Token) return { Code: 0, Msg: '无法取得当前租户 API 地址或管理员 Token。' };

var definitions = [
  {
    JobName: 'MciAiContentMorning',
    JobDesc: '每天08:30创建AI内容上午时段',
    CronDesc: '每天08:30 Asia/Shanghai',
    CronExpression: '0 30 8 * * ?',
    TimeZoneId: 'Asia/Shanghai',
    JobParam: JSON.stringify({ PlanKey: 'microi-ai-content-default', Slot: 'am', Timezone: 'Asia/Shanghai' })
  },
  {
    JobName: 'MciAiContentAfternoon',
    JobDesc: '每天16:30创建AI内容下午时段',
    CronDesc: '每天16:30 Asia/Shanghai',
    CronExpression: '0 30 16 * * ?',
    TimeZoneId: 'Asia/Shanghai',
    JobParam: JSON.stringify({ PlanKey: 'microi-ai-content-default', Slot: 'pm', Timezone: 'Asia/Shanghai' })
  }
];
var results = [];
for (var i = 0; i < definitions.length; i++) {
  var item = definitions[i];
  var existing = V8.FormEngine.GetFormData('diy_schedule_job', { _Where: [['JobName', '=', item.JobName]] });
  var existingId = existing && existing.Code === 1 && existing.Data ? existing.Data.Id : '';
  var runtimeResult = parseHttpResult(V8.Http.Post({
    Url: apiBase + '/api/Job/AddJob',
    PostParam: {
      Id: existingId || V8.Method.NewUlid(),
      JobName: item.JobName,
      JobDesc: item.JobDesc,
      CronDesc: item.CronDesc,
      CronExpression: item.CronExpression,
      TimeZoneId: item.TimeZoneId,
      JobType: '1',
      ApiEngineKey: 'mci-ai-content-dispatch',
      JobParam: item.JobParam,
      DllName: '',
      JobPath: ''
    },
    ParamType: 'form',
    Headers: { authorization: 'Bearer ' + tokenInfo.Token }
  }));
  var runtimeMessage = String((runtimeResult && runtimeResult.Msg) || '');
  var runtimeExists = runtimeResult && runtimeResult.Code !== 1
    && (runtimeMessage.indexOf('job已存在') >= 0
      || runtimeMessage.toLowerCase().indexOf('already exists with this identification') >= 0);
  if (!runtimeResult || (runtimeResult.Code !== 1 && !runtimeExists)) {
    return runtimeResult || { Code: 0, Msg: 'Quartz 任务创建失败：' + item.JobName };
  }
  if (existingId) {
    var updateExisting = V8.FormEngine.UptFormData('diy_schedule_job', {
      Id: existingId,
      _InvokeType: 'Server',
      JobDesc: item.JobDesc,
      Description: item.JobDesc,
      CronDesc: item.CronDesc,
      CronExpression: item.CronExpression,
      JobType: '1',
      ApiEngineKey: 'mci-ai-content-dispatch',
      JobParam: item.JobParam,
      DllName: '',
      JobPath: '',
      Status: '正常'
    });
    if (!updateExisting || updateExisting.Code !== 1) {
      return updateExisting || { Code: 0, Msg: '调度元数据修复失败：' + item.JobName };
    }
    results.push({ JobName: item.JobName, Id: existingId, Replayed: true, QuartzCreated: runtimeResult.Code === 1 });
    continue;
  }
  var row = {
    Id: V8.Method.NewUlid(),
    _InvokeType: 'Server',
    JobName: item.JobName,
    JobDesc: item.JobDesc,
    Description: item.JobDesc,
    CronDesc: item.CronDesc,
    CronExpression: item.CronExpression,
    JobType: '1',
    ApiEngineKey: 'mci-ai-content-dispatch',
    JobParam: item.JobParam,
    DllName: '',
    JobPath: '',
    Status: '正常'
  };
  var add = V8.FormEngine.AddFormData('diy_schedule_job', row);
  if (!add || add.Code !== 1) {
    existing = V8.FormEngine.GetFormData('diy_schedule_job', { _Where: [['JobName', '=', item.JobName]] });
    if (!existing || existing.Code !== 1 || !existing.Data) return add || { Code: 0, Msg: '调度元数据写入失败。' };
    results.push({ JobName: item.JobName, Id: existing.Data.Id, Replayed: true, RecoveredAfterRace: true });
    continue;
  }
  existing = V8.FormEngine.GetFormData('diy_schedule_job', { _Where: [['JobName', '=', item.JobName]] });
  if (!existing || existing.Code !== 1 || !existing.Data) return { Code: 0, Msg: '调度元数据写入后回读失败：' + item.JobName };
  results.push({ JobName: item.JobName, Id: existing.Data.Id, Replayed: false, QuartzCreated: runtimeResult.Code === 1 });
}
return { Code: 1, Data: { Jobs: results }, Msg: '08:30 与 16:30 的 Quartz 任务及数据库元数据已完成幂等校准。' };
