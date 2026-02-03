using Microsoft.AspNetCore.Mvc.Routing;
using Dos.Common;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace Microi.net.Api
{
    /// <summary>
    /// 动态路由转换器 - 支持接口引擎动态路由映射
    /// </summary>
    public class DynamicRoute : DynamicRouteValueTransformer
    {
        // 正则表达式静态编译（高并发优化）
        private static readonly Regex OsClientRegex = new Regex(@"--OsClient--(.*?)--$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // 缓存键前缀常量
        private const string CacheKeyPrefix = "Microi";
        private const string ApiEngineCacheKey = "FormData:sys_apiengine";

        // 标准 Controller 路由前缀（提前返回，避免缓存查询 - 性能优化）
        // 包含所有已注册的 Controller 路由（共 34 个）
        private static readonly HashSet<string> StandardControllerPrefixes = new(StringComparer.OrdinalIgnoreCase)
        {
            "/api/ai/",
            "/api/alipay/",
            "/api/apiengine/",
            "/api/cache/",
            "/api/captcha/",
            "/api/datasourceengine/",
            "/api/diychat/",
            "/api/diyfield/",
            "/api/diytable/",
            "/api/formengine/",
            "/api/hdfs/",
            "/api/home/",
            "/api/im/",
            "/api/job/",
            "/api/message/",
            "/api/moduleengine/",
            "/api/mq/",
            "/api/mqtt/",
            "/api/office/",
            "/api/os/",
            "/api/searchengine/",
            "/api/spider/",
            "/api/sysbasedata/",
            "/api/sysdept/",
            "/api/syslog/",
            "/api/sysmenu/",
            "/api/sysrole/",
            "/api/sysuser/",
            "/api/test/",
            "/api/ueditor/",
            "/api/upload/",
            "/api/wechat/",
            "/api/workflow/",
            "/itdos-heart"  // 特殊路由：心跳检测
        };

        // FormEngine 路由映射表（避免多个 if-else）
        private static readonly Dictionary<string, (string controller, string action)> FormEngineRoutes = new(StringComparer.OrdinalIgnoreCase)
        {
            { "/api/formengine/getformdata-", ("FormEngine", "GetFormData") },
            { "/api/formengine/get-formdata-", ("FormEngine", "GetFormData") },
            { "/api/formengine/gettabledata-", ("FormEngine", "GetTableData") },
            { "/api/formengine/get-tabledata-", ("FormEngine", "GetTableData") },
            { "/api/formengine/uptformdata-", ("FormEngine", "UptFormData") },
            { "/api/formengine/upt-formdata-", ("FormEngine", "UptFormData") },
            { "/api/formengine/delformdata-", ("FormEngine", "DelFormData") },
            { "/api/formengine/del-formdata-", ("FormEngine", "DelFormData") },
            { "/api/formengine/addformdata-", ("FormEngine", "AddFormData") },
            { "/api/formengine/add-formdata-", ("FormEngine", "AddFormData") }
        };
        public async Task<DosResult> Init(OsClientSecret clientModel)
        {
            try
            {
                if (clientModel.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(clientModel.OsClient, "ParamError", clientModel.OsClientModel["Lang"].Val<string>()) + "。 DynamicApiEngine.Init()。");
                }
                //取 Sys_ApiEngine 所有 ApiAddress
                var _where = new List<DiyWhere>() {
                        new DiyWhere(){
                            Name = "ApiAddress",
                            Value = null,
                            Type = "<>"
                        }
                    };
                if (clientModel.OsClientModel["DbType"].Val<string>() != "Oracle")
                {
                    _where.Add(new DiyWhere()
                    {
                        Name = "ApiAddress",
                        Value = "",
                        Type = "<>"
                    });
                }
                var sysApiEngineListResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
                {
                    FormEngineKey = "sys_apiengine",
                    _Where = _where,
                    OsClient = clientModel.OsClient
                });
                if (sysApiEngineListResult.Code == 1)
                {
                    var sysApiEngineList = sysApiEngineListResult.Data;
                    var DiyCacheBase = MicroiEngine.CacheTenant.Cache(clientModel.OsClient);
                    if (sysApiEngineList != null && sysApiEngineList.Any())
                    {
                        // 批量缓存写入（高并发优化）
                        var tasks = new List<Task>(sysApiEngineList.Count * 2);
                        foreach (var item in sysApiEngineList)
                        {
                            var apiEngineKey = ((string)item.ApiEngineKey).ToLower();
                            var apiAddress = ((string)item.ApiAddress).ToLower();

                            tasks.Add(DiyCacheBase.SetAsync(BuildCacheKey(clientModel.OsClient, apiEngineKey), item));
                            tasks.Add(DiyCacheBase.SetAsync(BuildCacheKey(clientModel.OsClient, apiAddress), item));
                        }
                        // 等待所有缓存写入完成
                        await Task.WhenAll(tasks);
                    }
                    var count = sysApiEngineList != null ? sysApiEngineList.Count : 0;
                    Console.WriteLine($"Microi：【成功】【{clientModel.OsClient}】接口引擎缓存初始化成功！共缓存 {count} 个接口。");
                    return new DosResult(1);
                }
                else
                {
                    Console.WriteLine($"Microi：【Error异常】【{clientModel.OsClient}】接口引擎缓存初始化失败，这将可能导致接口引擎自定义地址访问404！错误原因：" + sysApiEngineListResult.Msg);
                }
                return new DosResult(0, null, sysApiEngineListResult.Msg);
            }
            catch (System.Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】【{clientModel.OsClient}】接口引擎缓存初始化异常，这将可能导致接口引擎自定义地址访问404！异常原因：" + ex.Message);
                return new DosResult(0, null, $"DynamicApiEngine.Init() {clientModel.OsClient} ERROR：" + ex.Message);
            }
        }
        /// <summary>
        /// 构建缓存键（统一管理，便于维护）
        /// </summary>
        private static string BuildCacheKey(string osClient, string key)
        {
            return $"{CacheKeyPrefix}:{osClient}:{ApiEngineCacheKey}:{key}";
        }

        /// <summary>
        /// 检查是否为 FormEngine 特殊路由
        /// </summary>
        private bool TryMapFormEngineRoute(string apiPath, RouteValueDictionary values)
        {
            foreach (var route in FormEngineRoutes)
            {
                if (apiPath.StartsWith(route.Key, StringComparison.OrdinalIgnoreCase))
                {
                    values["controller"] = route.Value.controller;
                    values["action"] = route.Value.action;
                    return true;
                }
            }
            return false;
        }

        /// <summary>
        /// 根据请求类型和配置决定执行的 Action
        /// </summary>
        private string DetermineApiAction(HttpContext httpContext, dynamic apiModel)
        {
            bool stopHttp = DynamicHelper.GetDynamicBoolValue(apiModel, "StopHttp");
            if (stopHttp)
                return "StopHttp";

            var requestMethod = httpContext.Request.Method?.ToUpperInvariant();
            var contentType = httpContext.Request.ContentType?.ToLowerInvariant();

            // 非 JSON 请求的特殊处理
            if (string.IsNullOrEmpty(contentType) || !contentType.Contains("json"))
            {
                bool responseFile = DynamicHelper.GetDynamicBoolValue(apiModel, "ResponseFile");
                string responseType = DynamicHelper.GetDynamicStringValue(apiModel, "ResponseType", "0");

                if (responseFile || responseType == "File")
                    return "Run_Response_File";

                if (responseType == "HTML")
                    return "Run_Response_Html";

                if (requestMethod == "GET")
                    return "Run_Request_Get";

                return "Run_FormData";
            }

            // JSON 请求处理
            return requestMethod == "GET" ? "Run_Request_Get" : "Run";
        }

        /// <summary>
        /// 动态路由转换核心方法
        /// </summary>
        public override async ValueTask<RouteValueDictionary> TransformAsync(HttpContext httpContext, RouteValueDictionary values)
        {
            try
            {
                var requestMethod = httpContext.Request.Method?.ToUpperInvariant();

                // OPTIONS 请求快速处理
                if (requestMethod == "OPTIONS")
                {
                    values["controller"] = "ApiEngine";
                    values["action"] = "HandleOptions";
                    return values;
                }

                // Header 显式标记为接口引擎，直接路由
                if (httpContext.Request.Headers["apiengine"].ToString() == "1")
                {
                    values["controller"] = "ApiEngine";
                    values["action"] = "Run";
                    return values;
                }

                var apiPath = httpContext.Request.Path.Value ?? string.Empty;

                // 使用静态正则提取 OsClient（性能优化）
                var osClientFromPath = string.Empty;
                var osClientMatch = OsClientRegex.Match(apiPath);
                if (osClientMatch.Success)
                {
                    osClientFromPath = osClientMatch.Groups[1].Value;
                    apiPath = OsClientRegex.Replace(apiPath, string.Empty);
                }
                // 2026-02-03 Anderson：B租户可能会在已登录的情况下去调用A租户的公开接口,
                // 此时会通过Url传入OsClient，因此这个优先级比token高
                if (osClientFromPath.DosIsNullOrWhiteSpace())
                {
                    osClientFromPath = httpContext.Request?.Query["OsClient"].ToString();
                }

                var apiPathLower = apiPath.ToLowerInvariant();

                // FormEngine 特殊路由快速匹配
                if (TryMapFormEngineRoute(apiPathLower, values))
                {
                    return values;
                }

                // 【性能优化】提前识别标准 Controller 路由，直接返回，避免缓存查询
                // 这样可以避免每次请求都查询缓存（本地+Redis），性能提升显著
                foreach (var prefix in StandardControllerPrefixes)
                {
                    if (apiPathLower.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    {
                        // 标准路由，直接返回，交给 ASP.NET Core 路由系统处理
                        return values;
                    }
                }

                // 提取 OsClient（多来源优先级解析）
                var osClient = osClientFromPath;
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = DiyToken.GetCurrentOsClient();
                }

                // 获取租户缓存
                var cacheClient = MicroiEngine.CacheTenant.Cache(osClient);

                // 从缓存查询接口配置
                var cacheKey = BuildCacheKey(osClient, apiPathLower);
                var apiModel = await cacheClient.GetAsync<dynamic>(cacheKey);

                if (apiModel != null)
                {
                    // 设置 OsClient 到 Header（供后续使用）
                    try
                    {
                        httpContext.Request.Headers["osclient"] = osClient;
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Microi：【Warning】设置 osclient Header 失败：{ex.Message}");
                    }

                    // 检查接口是否启用
                    bool isEnable = DynamicHelper.GetDynamicBoolValue(apiModel, "IsEnable");
                    if (!isEnable)
                    {
                        values["controller"] = "ApiEngine";
                        values["action"] = "NotEnable";
                        return values;
                    }

                    // 决定执行的 Action
                    values["controller"] = "ApiEngine";
                    values["action"] = DetermineApiAction(httpContext, apiModel);
                    return values;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】TransformAsync 出现异常：{ex.Message}。PathValue：{httpContext?.Request?.Path.Value}");
            }

            return values;
        }
    }
}
