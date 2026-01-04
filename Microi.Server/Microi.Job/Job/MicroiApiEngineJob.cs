using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Quartz;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiApiEngineJob : IJob
    {
        public async Task Execute(IJobExecutionContext context)
        {
            try
            {
                JObject param = JObject.FromObject(context.JobDetail.JobDataMap);
                //调用接口引擎
               var result = await MicroiEngine.ApiEngine.RunAsync(param);
               if (result != null)
               {
                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(new
                    {
                        FormEngineKey = MicroiJobConst.logTable,
                        _RowModel = new Dictionary<string, string>()
                        {
                            { "JobName", context.JobDetail.Key.Name},
                            { "Message", JsonConvert.SerializeObject(result)}
                        },
                        OsClient = OsClient.OsClientName
                    });
                    if(addResult.Code != 1)
                    {
                        Console.WriteLine($"Microi：【Error异常】定时任务执行接口引擎后写入日志出错：" + addResult.Msg);
                    }
                }
            }
            catch(Exception ex) 
            {
                Console.WriteLine($"Microi：【Error异常】定时任务执行接口引擎出错：" + ex.Message);
                MicroiEngine.FormEngine.AddFormDataAsync(new
                {
                    FormEngineKey = MicroiJobConst.logTable,
                    _RowModel = new Dictionary<string, string>()
                {
                    { "JobName", context.JobDetail.Key.Name},
                    { "Message", ex.Message}
                },
                    OsClient = OsClient.OsClientName
                });
            }          
            //2025-12-12 注释 by anderson
            // await Task.CompletedTask;
        }

        private static async Task<JObject> DefaultParam(JObject param)
        {
            //var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            //var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            //if (currentToken != null)
            //{

            //    param["_CurrentSysUser"] = JToken.FromObject(currentToken.CurrentUser);
            //    param["OsClient"] = currentToken.OsClient;
            //}
            //if (currentTokenDynamic != null)
            //{
            //    param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
            //    param["OsClient"] = currentTokenDynamic.OsClient;
            //}
            //if (currentTokenDynamic == null
            //    && param["authorization"] != null
            //    && !(param["authorization"].ToString().DosIsNullOrWhiteSpace()))
            //{
            //    var tokenModel = await DiyToken.GetCurrentToken<SysUser>(param["authorization"].ToString());
            //    var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param["authorization"].ToString());
            //    param["_CurrentSysUser"] = JToken.FromObject(tokenModel.CurrentUser);
            //    param["OsClient"] = tokenModel.OsClient;
            //    param["_CurrentUser"] = JToken.FromObject(tokenModelJobj.CurrentUser);
            //}
            ////2023-07-13：匿名调用接口引擎，需要通过header传入osclient，否则系统无法知道是调用哪个OsClient
            //try
            //{
            //    if (param["OsClient"] == null || param["OsClient"].ToString().DosIsNullOrWhiteSpace())
            //    {
            //        var osClient = DiyHttpContext.Current.Request.Headers["osclient"].ToString();
            //        param["OsClient"] = osClient;
            //    }
            //}
            //catch (Exception ex)
            //{

            //}
            return param;
        }
    }
}
