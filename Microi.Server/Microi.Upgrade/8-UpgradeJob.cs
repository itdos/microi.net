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
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("Diy_Table", new
            {
                OsClient = OsClient,
                _Where = new List<List<string>>() {
                    new List<string> { "Name", "=", "diy_schedule_job" }
                },
                OutFormV8 = @"//已迁移至【服务器端表单提交前V8事件】--2025-12-15 --by anderson
// 前端离开表单后事件
// var para = {
//   Id : V8.Form.Id,
//   JobName : V8.Form.JobName,
//   DllName : V8.Form.DllName,
//   JobPath : V8.Form.JobPath,
//   JobDesc : V8.Form.JobDesc,
//   JobParam : V8.Form.JobParam,
//   CronDesc : V8.Form.CronDesc,
//   CronExpression : V8.Form.CronExpression,
//   JobType : V8.Form.JobType,
//   ApiEngineKey : V8.Form.ApiEngineKey
// }
// if(V8.FormOutAction == 'Insert'){
//     var result = await V8.Post('/api/Job/AddJob', para, null, { DataType : 'form' });
//     if(result.Code != 1){ 
//       V8.Tips('新增job失败', false);         
//     }
//     V8.RefreshTable({ _PageIndex : 1 })
// }
// else if(V8.FormOutAction == 'Update'){
//     var result = await V8.Post('/api/Job/UpdateJob', para, null, { DataType : 'form' });
//     if(result.Code != 1){ 
//       V8.Tips('修改失败', false);         
//     }
//     V8.RefreshTable({ _PageIndex : 1 })
// }
// else if(V8.FormOutAction == 'Delete'){
//  V8.Post('/api/Job/DeleteJob', para, function(result){
//     if(result.Code != 1){ 
//       V8.Tips('删除失败', result.Msg);
//       V8.Result = false;
//       return;
//     }
//   }, {
//     DataType : 'form'
//   })
// }
",
                SubmitBeforeServerV8 = @"if(V8.Form.JobType == '1' && !V8.Form.ApiEngineKey){
  return { Code : 0, Msg : 'ApiEngineKey不能为空！' };
}
var currentTokenObj = V8.Method.GetCurrentToken() || {};
var apiBase = V8.SysConfig.ApiBase;//'https://localhost:7266';//
var para = {
  Id : V8.Form.Id,
  JobName : V8.Form.JobName,
  DllName : V8.Form.DllName,
  JobPath : V8.Form.JobPath,
  JobDesc : V8.Form.JobDesc,
  JobParam : V8.Form.JobParam,
  CronDesc : V8.Form.CronDesc,
  CronExpression : V8.Form.CronExpression,
  JobType : V8.Form.JobType,
  ApiEngineKey : V8.Form.ApiEngineKey
}
if(V8.FormSubmitAction == 'Insert'){
    var result = V8.Http.Post({ 
      Url : apiBase + '/api/Job/AddJob',
      PostParam : para, 
      ParamType : 'form',
      Headers:{
        authorization : 'Bearer ' + currentTokenObj.Token
      }
    });
    result = JSON.parse(result);
    if(result.DataAppend){
      if(result.DataAppend.Status){
        V8.Form.Status = result.DataAppend.Status;
      }
      if(result.DataAppend.LastTime){
        V8.Form.LastTime = result.DataAppend.LastTime;
      }
      if(result.DataAppend.NextTime){
        V8.Form.NextTime = result.DataAppend.NextTime;
      }
    }
    if(result.Code != 1){ 
      return result;
    }
}
 
else if(V8.FormSubmitAction == 'Update'){
  var result = V8.Http.Post({ 
    Url : apiBase + '/api/Job/UpdateJob',
    PostParam, para, 
    ParamType : 'form',
    Headers:{
      authorization : 'Bearer ' + currentTokenObj.Token
    }
  });
  result = JSON.parse(result);
  if(result.Code != 1){ 
    return result;
  }
}
else if(V8.FormSubmitAction == 'Delete'){
  var result = V8.Http.Post({
    Url : apiBase + '/api/Job/DeleteJob',
    PostParam : para, 
    ParamType : 'form',
    Headers:{
      authorization : 'Bearer ' + currentTokenObj.Token
    }
  });
  result = JSON.parse(result);
  if(result.Code != 1){ 
    return result;
  }
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

