using Microsoft.AspNetCore.Mvc.Routing;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

// ASP.NET Core 接口引擎动态路由适配层。
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

        // 标准 Controller 路由前缀（提前返回，避免缓存查询 - 性能优化）。
        // 此清单只包含当前实际保留的宿主协议/内核 Controller；迁入 Managed
        // ApiEngine 的旧入口必须从这里移除，避免不存在的 /api/* 路由吞掉动态地址。
        private static readonly HashSet<string> StandardControllerPrefixes = new(StringComparer.OrdinalIgnoreCase)
        {
            "/api/ai/",
            "/api/apiengine/",
            "/api/captcha/",
            "/api/diagnostics/",
            "/api/diychat/",
            "/api/externallogin/",
            "/api/formengine/",
            "/api/hdfs/",
            "/api/home/",
            "/api/identityverification/",
            "/api/license/",
            "/api/marketplacesource/",
            "/api/message/",
            "/api/microapp/",
            "/api/os/",
            "/api/sso/",
            "/api/sysuser/",
            "/api/sysuseraccesskey/",
            "/api/tenantsystemsettings/",
            "/api/ueditor/",
            "/api/upload/",
            "/api/v8debug/",
            "/api/v8engine/",
            "/api/wechat/",
            "/api/wechatcontentsecurity/",
            "/api/workflow/",
            "/itdos-heart"  // 特殊路由：心跳检测
        };

        public async Task<DosResult> Init(OsClientSecret clientModel)
        {
            return await ApiEngineRouteCacheInitializer.InitializeAsync(clientModel);
        }
        /// <summary>
        /// 构建缓存键（统一管理，便于维护）
        /// </summary>
        private static string BuildCacheKey(string osClient, string key)
        {
            return $"{CacheKeyPrefix}:{osClient}:{ApiEngineCacheKey}:{key}";
        }

        // zhy 2026-08-21：数据库回源结果必须先落成 object 和强类型字符串，
        // zhy 2026-08-21：避免 dynamic 调用链把字符串扩展方法推迟到运行时绑定。
        private static (string ApiEngineKey, string ApiAddress) GetRouteCacheAliases(object apiModel)
        {
            string apiEngineKey = DynamicHelper
                .GetDynamicStringValue(apiModel, "ApiEngineKey", string.Empty)
                .ToLowerInvariant();
            string apiAddress = DynamicHelper
                .GetDynamicStringValue(apiModel, "ApiAddress", string.Empty)
                .ToLowerInvariant();
            return (apiEngineKey, apiAddress);
        }

        /// <summary>
        /// 检查是否为 FormEngine 特殊路由
        /// </summary>
        private bool TryMapFormEngineRoute(string apiPath, RouteValueDictionary values)
        {
            if (UserAccessKeySecurity.TryGetDynamicFormEngineAction(apiPath, out var action))
            {
                values["controller"] = "FormEngine";
                values["action"] = action;
                return true;
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

            bool responseFile = DynamicHelper.GetDynamicBoolValue(apiModel, "ResponseFile");
            string responseType = DynamicHelper.GetDynamicStringValue(apiModel, "ResponseType", "0");
            var normalizedResponseType = responseType?.Trim() ?? "0";

            if (responseFile || string.Equals(normalizedResponseType, "File", StringComparison.OrdinalIgnoreCase))
                return "Run_Response_File";

            if (string.Equals(normalizedResponseType, "Stream", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedResponseType, "SSE", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedResponseType, "2", StringComparison.OrdinalIgnoreCase))
                return "Run_Response_Stream";

            if (string.Equals(normalizedResponseType, "HTML", StringComparison.OrdinalIgnoreCase))
                return "Run_Response_Html";

            // 非 JSON 请求的特殊处理
            if (string.IsNullOrEmpty(contentType) || !contentType.Contains("json"))
            {

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
                if (apiModel is string cachedText)
                {
                    try
                    {
                        apiModel = JObject.Parse(cachedText);
                    }
                    catch
                    {
                        // 兼容曾由应用商城导入脚本写入的 "System..." 对象类型名。
                        // 只删除当前确定损坏的别名，随后从数据库回源并重建全部兼容别名。
                        await cacheClient.RemoveAsync(cacheKey);
                        apiModel = null;
                        MicroiEngine.QueueSystemLog(osClient, "ApiEngine", "InvalidRouteCacheRemoved", "已移除非 JSON 接口引擎缓存", "缓存将在数据库回源后重建。", 2, true, cacheKey);
                    }
                }

                if (apiModel == null && !osClient.DosIsNullOrWhiteSpace())
                {
                    var fallbackResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                    {
                        FormEngineKey = "sys_apiengine",
                        _Where = new List<DiyWhere>
                        {
                            new DiyWhere
                            {
                                Name = "ApiAddress",
                                Value = apiPathLower,
                                Type = "="
                            }
                        },
                        OsClient = osClient
                    });
                    if (fallbackResult.Code == 1 && fallbackResult.Data != null)
                    {
                        apiModel = JObject.FromObject((object)fallbackResult.Data);
                        var cacheJson = JsonConvert.SerializeObject((object)fallbackResult.Data);
                        // zhy 2026-08-21：统一提取并重建 ApiEngineKey、ApiAddress 两个路由缓存别名。
                        var (apiEngineKey, apiAddress) = GetRouteCacheAliases((object)apiModel);
                        var cacheTasks = new List<Task>();
                        if (!string.IsNullOrWhiteSpace(apiEngineKey))
                        {
                            cacheTasks.Add(cacheClient.SetAsync(BuildCacheKey(osClient, apiEngineKey), cacheJson));
                        }
                        if (!string.IsNullOrWhiteSpace(apiAddress))
                        {
                            cacheTasks.Add(cacheClient.SetAsync(BuildCacheKey(osClient, apiAddress), cacheJson));
                        }
                        if (cacheTasks.Count > 0)
                        {
                            await Task.WhenAll(cacheTasks);
                        }
                    }
                }

                if (apiModel != null)
                {
                    // 在路由解析阶段即把真实接口引擎 Key 写入轻量观测上下文。
                    // 控制器无需读取请求体，固定自定义地址与通用兼容入口都能按
                    // ApiEngineKey 分开统计，避免聚合成无法定位的 /api/ApiEngine/Run。
                    var (resolvedApiEngineKey, _) = GetRouteCacheAliases((object)apiModel);
                    SystemObservabilityService.AnnotateApiEngine(
                        httpContext,
                        resolvedApiEngineKey,
                        osClient);

                    // 设置 OsClient 到 Header（供后续使用）
                    try
                    {
                        httpContext.Request.Headers["osclient"] = osClient;
                    }
                    catch (Exception ex)
                    {
                        MicroiEngine.QueueSystemLog(osClient, "ApiEngine", "TenantHeaderWriteFailed", "设置 osclient 请求头失败", ex.ToString(), 2);
                    }

                    // 检查接口是否启用
                    // 兼容旧缓存/导入包半量缓存：缺失 IsEnable 时按启用处理，显式 0/false 仍然停用。
                    bool isEnable = DynamicHelper.GetDynamicBoolValue(apiModel, "IsEnable", true);
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

                if (apiPathLower.StartsWith("/apiengine/", StringComparison.OrdinalIgnoreCase))
                {
                    // 即使应用尚未安装或路由缓存暂时缺失，也把明确的接口引擎地址
                    // 交给核心入口按 ApiAddress 解析并返回结构化 DosResult，避免 404。
                    // 存在的 File/HTML/Stream 类型仍会在上方读取模型后选择专用 Action。
                    values["controller"] = "ApiEngine";
                    values["action"] = requestMethod == "GET" ? "Run_Request_Get" : "Run";
                    return values;
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "ApiEngine", "RouteTransformFailed", "接口引擎动态路由转换异常", ex.ToString(), 2, false, httpContext?.Request?.Path.Value);
            }

            return values;
        }
    }
}
