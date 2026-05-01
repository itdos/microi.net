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
            // SaaS多租户：从JobDataMap读取OsClient，确定租户上下文
            var osClient = context.JobDetail.JobDataMap.ContainsKey(MicroiJobConst.OsClient)
                ? context.JobDetail.JobDataMap.GetString(MicroiJobConst.OsClient)
                : OsClientDefault.OsClient;
            if (string.IsNullOrWhiteSpace(osClient))
            {
                osClient = OsClientDefault.OsClient;
            }

            try
            {
                JObject param = JObject.FromObject(context.JobDetail.JobDataMap);
                // SaaS多租户：确保接口引擎使用正确的租户上下文
                param["OsClient"] = osClient;
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
                        OsClient = osClient
                    });
                    if (addResult.Code != 1)
                    {
                        Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】定时任务执行接口引擎后写入日志出错（{osClient}）：{addResult.Msg}");
                    }
                }
            }
            catch (Exception ex)
            {
                var errorMsg = $"定时任务执行接口引擎出错（{osClient}）: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMsg += $"\n内部异常: {ex.InnerException.Message}";
                }
                errorMsg += $"\n堆栈跟踪: {ex.StackTrace}";
                
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】{errorMsg}");
                
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
                        OsClient = osClient
                    });
                }
                catch (Exception logEx)
                {
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】写入日志失败（{osClient}）: {logEx.Message}");
                }
                // 2026-05-01 健壮性加固：以 JobExecutionException 包装并向 Quartz 抛出，
                // 让调度器感知失败状态、生成 misfire 记录，并支持 @DisallowConcurrentExecution 的串行控制。
                // refireImmediately=false：不立即重试，等待下一次正常调度，避免错误风暴。
                throw new JobExecutionException(errorMsg, ex, refireImmediately: false);
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
