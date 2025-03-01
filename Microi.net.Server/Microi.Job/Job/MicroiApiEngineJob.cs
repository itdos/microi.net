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
        private static ApiEngine _apiEngineLogic = new ApiEngine();
        private static FormEngine _formEngine = new FormEngine();

        public async Task Execute(IJobExecutionContext context)
        {
            try
            {
                JObject param = JObject.FromObject(context.JobDetail.JobDataMap);
                //调用接口引擎
               var result = await _apiEngineLogic.RunAsync(param);
               if (result != null)
               {
                    _formEngine.AddFormData(new
                    {
                        FormEngineKey = MicroiJobConst.logTable,
                        _RowModel = new Dictionary<string, string>()
                        {
                            { "JobName", context.JobDetail.Key.Name},
                            { "Message", JsonConvert.SerializeObject(result)}
                        },
                        OsClient = OsClient.OsClientName
                    });
                }
            }
            catch(Exception ex) 
            {
                try
                {
                    _formEngine.AddFormData(new
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
                catch(Exception e) 
                { 
                    Console.WriteLine(e.ToString());
                }
               
            }          
            await Task.CompletedTask;
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
