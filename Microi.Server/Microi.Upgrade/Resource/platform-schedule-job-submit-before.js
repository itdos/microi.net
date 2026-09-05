/*
 * V8 Event
 * TableKey: diy_schedule_job
 * EventType: SubmitBeforeServerV8
 * Version: v1.1.4
 * Function:
 * - 校验任务配置并调用当前租户调度原子能力，保留业务接口Key；元数据只由表单事务保存，旧运行时在调度前明确阻止提交。
 */

var submitAction = String(V8.FormSubmitAction || '').toLowerCase();
var isDelete = submitAction === 'delete' || submitAction === 'del';
// 删除已有任务无需重新校验接口配置，允许清理引用已经失效的任务。
if(!isDelete && V8.Form.JobType == '1' && !V8.Form.ApiEngineKey){
  return { Code : 0, Msg : 'ApiEngineKey不能为空！' };
}
var para = {
  Id : V8.Form.Id,
  JobName : V8.Form.JobName,
  JobDesc : V8.Form.JobDesc,
  JobParam : V8.Form.JobParam,
  CronDesc : V8.Form.CronDesc,
  CronExpression : V8.Form.CronExpression,
  TimeZoneId : V8.Form.TimeZoneId,
  JobType : V8.Form.JobType,
  ApiEngineKey : V8.Form.ApiEngineKey
};
para.Action = isDelete ? 'Delete' : 'Save';
para.RuntimeOnly = true;
if (!isDelete) {
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,49}$/.test(String(para.JobName || ''))) {
    return { Code: 0, Msg: '任务Key须以英文字母开头，可包含英文、数字、点、下划线和短横线，最多50个字符。' };
  }
  // 在同一事务内检查重名，避免新增表单把既有 Quartz 任务当成更新。
  var duplicate = V8.FormEngine.GetFormData('diy_schedule_job', {
    _Where: [['JobName', '=', para.JobName]], _SelectFields: ['Id']
  }, V8.DbTrans);
  if (!duplicate || (duplicate.Code != 1 && duplicate.Code != 2)) return duplicate || { Code: 0, Msg: '任务Key检查失败。' };
  if (duplicate.Code == 1 && duplicate.Data && String(duplicate.Data.Id) != String(para.Id)) {
    return { Code: 0, Msg: '任务Key已存在，请使用其它Key。' };
  }
}
// ApiEngineKey 是接口调用的路由参数；直接调用调度原子，避免业务接口Key被管理接口Key覆盖。
var result;
if (isDelete) {
  result = V8.Method.ManageScheduleJob(para);
} else {
  var capability = V8.Method.ManageScheduleJob({ Action: 'Capabilities' });
  if (!capability || capability.Code != 1 || !capability.Data || capability.Data.RuntimeOnly !== true) {
    return { Code: 0, Msg: '当前平台后端不支持任务表单事务保存，请先更新平台后端，再更新任务调度应用。' };
  }
  result = V8.Method.SaveScheduleJob(para);
}
var runtime = result && (result.DataAppend || result.Data);
if(runtime){
  if(runtime.Status) V8.Form.Status = runtime.Status;
  if(runtime.LastTime) V8.Form.LastTime = runtime.LastTime;
  if(runtime.NextTime) V8.Form.NextTime = runtime.NextTime;
}
if(!result || result.Code != 1){
  return result || { Code:0, Msg:'定时任务接口引擎没有返回结果。' };
}
