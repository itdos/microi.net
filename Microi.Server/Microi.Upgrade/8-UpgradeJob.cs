using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// 任务调度引擎的必要升级 --2025-12-17
    /// </summary>
    public class Upgrade8
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "3.3.0.0";//对应Microi.net.dll v3.3.0
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("diy_table", new
            {
                OsClient = OsClient,
                _Where = new List<List<string>>() {
                    new List<string> { "Name", "=", "diy_schedule_job" }
                },
                OutFormV8 = @"// 定时任务运行时同步已迁移至服务器端表单事件与 platform-schedule-job 接口引擎。",
                SubmitBeforeServerV8 = @"// Version: v1.1.0 - 定时任务业务改由官方接口引擎编排
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
}
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
"
            });
            if (result.Code != 1)
            {
                msgs.Add(result.Msg);
            }
            return msgs;
        }
    }
}

