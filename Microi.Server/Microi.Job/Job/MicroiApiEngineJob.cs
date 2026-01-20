using Dos.Common;
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
                            { "Message", JsonHelper.Serialize(result)}
                        },
                        OsClient = OsClientDefault.OsClient
                    });
                    if (addResult.Code != 1)
                    {
                        Console.WriteLine($"Microi：【Error异常】定时任务执行接口引擎后写入日志出错：" + addResult.Msg);
                    }
                }
            }
            catch (Exception ex)
            {
                var errorMsg = $"\u5b9a\u65f6\u4efb\u52a1\u6267\u884c\u63a5\u53e3\u5f15\u64ce\u51fa\u9519: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMsg += $"\n\u5185\u90e8\u5f02\u5e38: {ex.InnerException.Message}";
                }
                errorMsg += $"\n\u5806\u6808\u8ddf\u8e2a: {ex.StackTrace}";
                
                Console.WriteLine($"Microi\uff1a\u3010Error\u5f02\u5e38\u3011{errorMsg}");
                
                try
                {
                    await MicroiEngine.FormEngine.AddFormDataAsync(new
                    {
                        FormEngineKey = MicroiJobConst.logTable,
                        _RowModel = new Dictionary<string, string>()
                        {
                            { "JobName", context.JobDetail.Key.Name},
                            { "Message", errorMsg}
                        },
                        OsClient = OsClientDefault.OsClient
                    });
                }
                catch (Exception logEx)
                {
                    Console.WriteLine($"Microi\uff1a\u3010Error\u5f02\u5e38\u3011\u5199\u5165\u65e5\u5fd7\u5931\u8d25: {logEx.Message}");
                }
            }
            //2025-12-12 注释 by anderson
            // await Task.CompletedTask;
        }

        private static async Task<JObject> DefaultParam(JObject param)
        {
            //var currentTokenDynamic = await DiyToken.GetCurrentToken();
            //if (currentToken != null)
            //{

            //    param["_CurrentSysUser"] = JTokenEx.FromObject(currentToken.CurrentUser);
            //    param["OsClient"] = currentToken.OsClient;
            //}
            //if (currentTokenDynamic != null)
            //{
            //    param["_CurrentUser"] = JTokenEx.FromObject(currentTokenDynamic.CurrentUser);
            //    param["OsClient"] = currentTokenDynamic.OsClient;
            //}
            //if (currentTokenDynamic == null
            //    && param["authorization"] != null
            //    && !(param["authorization"].ToString().DosIsNullOrWhiteSpace()))
            //{
            //    var tokenModel = await DiyToken.GetCurrentToken<SysUser>(param["authorization"].ToString());
            //    var tokenModelJobj = await DiyToken.GetCurrentToken(param["authorization"].ToString());
            //    param["_CurrentSysUser"] = JTokenEx.FromObject(tokenModel.CurrentUser);
            //    param["OsClient"] = tokenModel.OsClient;
            //    param["_CurrentUser"] = JTokenEx.FromObject(tokenModelJobj.CurrentUser);
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
