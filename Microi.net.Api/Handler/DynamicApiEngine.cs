using Microsoft.AspNetCore.Mvc.Routing;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class DynamicRoute : DynamicRouteValueTransformer
    {
        private static FormEngine _formEngine = new FormEngine();
        /// <summary>
        /// 
        /// </summary>
        public override async ValueTask<RouteValueDictionary> TransformAsync(HttpContext httpContext, RouteValueDictionary values)
        {
            try
            {
                if (httpContext.Request.Method?.ToUpper() == "OPTIONS")
                {
                    values["controller"] = "ApiEngine";
                    values["action"] = "HandleOptions";
                    return values;
                }
                //如果Header标记了是接口引擎，直接走接口引擎
                if (httpContext.Request.Headers["apiengine"].ToString() == "1")
                {
                    values["controller"] = "ApiEngine";
                    values["action"] = "Run";
                    return values;
                }
                var apiPath = httpContext.Request.Path.Value.ToLower();

                if (apiPath.StartsWith("/api/formengine/getformdata-") || apiPath.StartsWith("/api/formengine/get-formdata-"))
                {
                    values["controller"] = "FormEngine";
                    values["action"] = "GetFormData";
                    return values;
                }
                else if (apiPath.StartsWith("/api/formengine/gettabledata-") || apiPath.StartsWith("/api/formengine/get-tabledata-"))
                {
                    values["controller"] = "FormEngine";
                    values["action"] = "GetTableData";
                    return values;
                }
                else if (apiPath.StartsWith("/api/formengine/uptformdata-") || apiPath.StartsWith("/api/formengine/upt-formdata-"))
                {
                    values["controller"] = "FormEngine";
                    values["action"] = "UptFormData";
                    return values;
                }
                else if (apiPath.StartsWith("/api/formengine/delformdata-") || apiPath.StartsWith("/api/formengine/del-formdata-"))
                {
                    values["controller"] = "FormEngine";
                    values["action"] = "UptFormData";
                    return values;
                }
                else if (apiPath.StartsWith("/api/formengine/addformdata-") || apiPath.StartsWith("/api/formengine/add-formdata-"))
                {
                    values["controller"] = "FormEngine";
                    values["action"] = "AddFormData";
                    return values;
                }
                //osClient可能是在header，也可能是参数(未实现，因为是json参数)，也可能是读配置
                var osClient = DiyToken.GetCurrentOsClient(httpContext);
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    var token = httpContext.Request.Headers["authorization"];
                    if (!token.ToString().DosIsNullOrWhiteSpace())
                    {
                        var tokenResult = await DiyToken.GetCurrentToken<SysUser>(token);
                        if (tokenResult != null && !tokenResult.OsClient.DosIsNullOrWhiteSpace())
                        {
                            osClient = tokenResult.OsClient;
                        }
                    }
                }
                //2024-10-03：可能传入的token是上一个saas引擎的token，以header为准
                if (!httpContext.Request.Headers["osclient"].ToString().DosIsNullOrWhiteSpace())
                {
                    osClient = httpContext.Request.Headers["osclient"].ToString();
                }
                MicroiCacheRedis DiyCacheBase = null;
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    var defaultOsClient = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
                    DiyCacheBase = new MicroiCacheRedis(defaultOsClient);
                    osClient = defaultOsClient;
                }
                else
                {
                    DiyCacheBase = new MicroiCacheRedis(osClient);
                }
                var apiModel = await DiyCacheBase.GetAsync<dynamic>($"FormData:{osClient}:sys_apiengine:{apiPath.ToLower()}");
                if (apiModel != null)
                {
                    try
                    {
                        httpContext.Request.Headers.Add("osclient", osClient);
                    }
                    catch (Exception ex)
                    {

                    }
                    values["controller"] = "ApiEngine";
                    if (httpContext.Request.ContentType == null || !httpContext.Request.ContentType.ToLower().Contains("json"))
                    {
                        if (apiModel.ResponseFile == 1)
                        {
                            values["action"] = "Run_Response_File";//2024-07-15新增支持响应文件
                        }
                        else if (httpContext.Request.Method.ToUpper() == "GET")
                        {
                            values["action"] = "Run_Request_Get";
                        }
                        else
                        {
                            values["action"] = "Run_FormData";//2024-07-14新增支持Payload FormData请求
                        }
                    }
                    else
                    {
                        if (httpContext.Request.Method.ToUpper() == "GET")
                        {
                            values["action"] = "Run_Request_Get";
                        }
                        else
                        {
                            values["action"] = "Run";
                        }
                    }
                    return values;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：TransformAsync出现异常："
                    + ex.Message
                    + " --> InnerException.Message： --> " + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? ""))
                    + " --> StackTrace： --> " + (ex.StackTrace ?? "")
                    + $" --> PathValue：--> {httpContext.Request.Path.Value.ToLower()}");
            }
            return values;
        }
        public static async Task<DosResult> Init(OsClientSecret clientModel)
        {
            try
            {
                if (clientModel.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.Msg["ParamError"][clientModel._Lang] + "。 DynamicApiEngine.Init()。");
                }
                //DbSession dbSession = OsClient.GetClient(osClient).Db;
                //DbSession dbSessionRead = OsClient.GetClient(osClient).DbRead;
                //取 Sys_ApiEngine 所有 ApiAddress
                var _where = new List<DiyWhere>() {
                        new DiyWhere(){
                            Name = "ApiAddress",
                            Value = null,
                            Type = "<>"
                        }
                    };
                if (clientModel.DbType != "Oracle")
                {
                    _where.Add(new DiyWhere()
                    {
                        Name = "ApiAddress",
                        Value = "",
                        Type = "<>"
                    });
                }
                var sysApiEngineListResult = await _formEngine.GetTableDataAsync(new
                {
                    FormEngineKey = "Sys_ApiEngine",
                    _Where = _where,
                    OsClient = clientModel.OsClient
                });
                if (sysApiEngineListResult.Code == 1)
                {
                    var sysApiEngineList = sysApiEngineListResult.Data;//.Select(d => d.ApiAddress.ToLower()).ToList();
                    var DiyCacheBase = new MicroiCacheRedis(clientModel.OsClient);
                    if (sysApiEngineList.Any())
                    {
                        foreach (var item in sysApiEngineList)
                        {
                            // JObject itemObj =JObject.FromObject(item);
                            DiyCacheBase.SetAsync($"FormData:{clientModel.OsClient}:sys_apiengine:{((string)item.ApiEngineKey).ToLower()}", item);
                            DiyCacheBase.SetAsync($"FormData:{clientModel.OsClient}:sys_apiengine:{((string)item.ApiAddress).ToLower()}", item);
                        }
                    }
                    return new DosResult(1);
                }
                return new DosResult(0, null, sysApiEngineListResult.Msg);
            }
            catch (System.Exception ex)
            {
                return new DosResult(0, null, $"DynamicApiEngine.Init() {clientModel.OsClient} ERROR：" + ex.Message);
            }

        }
    }
}