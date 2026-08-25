// Microi官方 diy_schedule_job 服务器端表单提交前事件
// Version: v1.1.0 - 定时任务业务改由官方接口引擎编排
if(V8.Form.JobType == '1' && !V8.Form.ApiEngineKey){
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
var submitAction = String(V8.FormSubmitAction || '');
para.Action = submitAction == 'Delete' || submitAction == 'Del' ? 'Delete' : 'Save';
var result = V8.ApiEngine.Run('platform-schedule-job', para, V8.DbTrans);
if(result && result.DataAppend){
  if(result.DataAppend.Status) V8.Form.Status = result.DataAppend.Status;
  if(result.DataAppend.LastTime) V8.Form.LastTime = result.DataAppend.LastTime;
  if(result.DataAppend.NextTime) V8.Form.NextTime = result.DataAppend.NextTime;
}
if(!result || result.Code != 1){
  return result || { Code:0, Msg:'定时任务接口引擎没有返回结果。' };
}
