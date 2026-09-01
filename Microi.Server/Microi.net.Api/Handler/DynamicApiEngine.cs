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
        public const string ResolvedApiEngineKeyItem = "__MicroiResolvedApiEngineKey";
        public const string ResolvedApiRouteValuesItem = "__MicroiResolvedApiRouteValues";
        // 正则表达式静态编译（高并发优化）
        private static readonly Regex OsClientRegex = new Regex(@"--OsClient--(.*?)--$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex CanonicalApiEngineKeyRegex = new Regex(
            @"^/apiengine/([A-Za-z0-9_.:-]+)$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

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
            "/api/formengine/",
            "/api/hdfs/",
            "/api/home/",
            "/api/license/",
            "/api/message/",
            "/api/microapp/",
            "/api/os/",
            "/api/ueditor/",
            "/api/upload/",
            "/api/v8debug/",
            "/api/v8engine/"
        };

        // 保留 Controller 前缀的少量历史地址已经迁入 Managed 接口引擎，必须先让
        // 动态路由按 ApiRoutes 精确命中；同前缀其它内核/协议方法仍走快速通道。
        private static readonly HashSet<string> MigratedControllerRoutePaths = new(StringComparer.OrdinalIgnoreCase)
        {
            "/api/diychat/sendsystemmessage",
            "/api/formengine/getsysconfig", "/api/formengine/getlangbundle",
            "/api/formengine/getloginwallpapers",
            "/api/hdfs/getprivatefileurl", "/api/hdfs/mallfileurl",
            "/api/os/getosclientbydomain", "/api/os/getosversion",
            "/api/os/createqrcode", "/api/os/createqrcodeimage",
            "/api/os/getmicroinetversion", "/api/os/getosclient", "/api/os/gethid",
            "/api/os/getdatetimenow", "/api/os/microiNetinitcheck",
            "/api/ai/updateconversationtitle", "/api/ai/recognizeintent",
            "/api/ai/chat", "/api/ai/nl2sql", "/api/ai/nl2v8enginesync",
            "/api/ai/relaytokensummary", "/api/ai/subgetplans", "/api/ai/subgetinfo",
            "/api/ai/getuseraiapikey", "/api/ai/resetuseraiapikey",
            "/api/ai/getuseraiusage", "/api/ai/subcreateorder",
            "/api/ai/subcreatealipay", "/api/ai/subgetorders",
            "/api/ai/subconsumequota", "/api/ai/subgetorderstatus",
            "/api/ai/subgetapikeylist", "/api/ai/subgetapikeybindusers",
            "/api/ai/subgetapikeycapacity", "/api/ai/generateprofileavatar",
            "/api/ai/createminimaxvideo", "/api/ai/getminimaxvideotask",
            "/api/ai/getminimaxvideofile", "/api/ai/persistminimaxvideofile",
            "/api/ai/proxygetquotastatus", "/api/ai/subgetmodels"
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

        /// <summary>
        /// 规范化接口引擎 HTTP 地址，并移除只用于租户选择的路径后缀。
        /// ApiAddress 是显式路由事实源；即使地址恰好是单段 /apiengine/{value}，
        /// 也不能据此断言 value 就是实际 ApiEngineKey。
        /// </summary>
        internal static string NormalizeApiEngineRouteAddress(string apiPath)
        {
            return OsClientRegex.Replace(
                apiPath ?? string.Empty,
                string.Empty)
                .Trim()
                .ToLowerInvariant();
        }

        /// <summary>
        /// 提取单段 /apiengine/{Key} 的兼容 Key 候选。它只能在完整 ApiAddress
        /// 已经确认未配置时使用，不能覆盖显式自定义地址。
        /// </summary>
        internal static string ResolveCanonicalApiEngineKey(string apiPath)
        {
            var match = CanonicalApiEngineKeyRegex.Match(
                NormalizeApiEngineRouteAddress(apiPath));
            return match.Success
                ? match.Groups[1].Value.Trim().ToLowerInvariant()
                : string.Empty;
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
        /// 从租户主库按完整 HTTP 地址读取权威路由。主 ApiAddress 未命中后继续
        /// 检查 ApiRoutes；只有两者均返回 Code=1/Data=null 才表示地址确实未配置。
        /// </summary>
        private static DosResult<dynamic> GetAuthoritativeRouteByAddress(
            string osClient,
            string apiAddress)
        {
            var client = OsClientExtend.GetClient(osClient);
            var addressParam = new ApiEngineParam
            {
                OsClient = osClient,
                _CurrentUser = null,
                ApiAddress = apiAddress
            };
            var result = ApiEngineAuthoritativeStore.GetEnabledModel(client, addressParam);
            if (result.Code != 1 || result.Data != null) return result;
            return ApiEngineAuthoritativeStore.GetEnabledByMultiRoute(client, apiAddress);
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

            if (string.Equals(normalizedResponseType, "HTTP", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedResponseType, "RawHttp", StringComparison.OrdinalIgnoreCase))
                return "Run_Response_Http";

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
        /// 从 URL 片段中解析唯一租户。模板协议地址把 {OsClient} 放在路径中，
        /// 因而其优先级高于当前登录 Token；若多个片段都命中租户则拒绝猜测。
        /// </summary>
        private static string ResolveUniquePathTenant(string apiPath)
        {
            var tenants = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var segment in (apiPath ?? string.Empty).Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries))
            {
                string candidate;
                try { candidate = Uri.UnescapeDataString(segment); }
                catch { continue; }
                var tenant = OsClientExtend.ClientList.Keys.FirstOrDefault(key =>
                    string.Equals(key, candidate, StringComparison.OrdinalIgnoreCase));
                if (!tenant.DosIsNullOrWhiteSpace()) tenants.Add(tenant);
            }
            return tenants.Count == 1 ? tenants.First() : string.Empty;
        }

        /// <summary>
        /// 匹配由完整路径片段组成的接口引擎模板，例如 /cas/{OsClient}/login。
        /// 占位符不跨越斜杠且名称受限，避免把模板能力扩大成任意正则路由。
        /// </summary>
        private static bool TryMatchApiAddressTemplate(
            string template,
            string actualPath,
            out JObject routeValues)
        {
            routeValues = new JObject();
            var templateSegments = (template ?? string.Empty)
                .Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            var actualSegments = (actualPath ?? string.Empty)
                .Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (templateSegments.Length == 0 || templateSegments.Length != actualSegments.Length) return false;

            for (var index = 0; index < templateSegments.Length; index++)
            {
                var templateSegment = templateSegments[index];
                var placeholder = Regex.Match(
                    templateSegment,
                    @"^\{([A-Za-z][A-Za-z0-9_]{0,63})\}$",
                    RegexOptions.CultureInvariant);
                if (!placeholder.Success)
                {
                    if (!string.Equals(templateSegment, actualSegments[index], StringComparison.OrdinalIgnoreCase))
                        return false;
                    continue;
                }

                string value;
                try { value = Uri.UnescapeDataString(actualSegments[index]); }
                catch { return false; }
                if (value.DosIsNullOrWhiteSpace() || value.Length > 500
                    || value.IndexOf('/') >= 0 || value.IndexOf('\\') >= 0)
                    return false;
                routeValues[placeholder.Groups[1].Value] = value;
            }
            return routeValues.Count > 0;
        }

        private static bool TryMatchConfiguredTemplate(
            object apiModel,
            string actualPath,
            out JObject routeValues)
        {
            routeValues = new JObject();
            foreach (var route in ApiEngineRouteAliases.GetConfiguredRoutes(apiModel))
            {
                if (!ApiEngineRouteAliases.IsTemplateRoute(route)) continue;
                if (TryMatchApiAddressTemplate(route, actualPath, out routeValues)) return true;
            }
            return false;
        }

        private static async Task<(object ApiModel, JObject RouteValues)> ResolveTemplateRouteAsync(
            string osClient,
            string apiPath)
        {
            if (osClient.DosIsNullOrWhiteSpace()) return (null, null);
            var primaryResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
            {
                FormEngineKey = "sys_apiengine",
                OsClient = osClient,
                _Where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "ApiAddress", Type = "Like", Value = "{" },
                    new DiyWhere { Name = "IsEnable", Type = "=", Value = 1 }
                },
                _PageIndex = 1,
                _PageSize = 500
            });
            var multiResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
            {
                FormEngineKey = "sys_apiengine",
                OsClient = osClient,
                _Where = new List<DiyWhere>
                {
                    new DiyWhere { Name = ApiEngineRouteAliases.MultiRouteFieldName, Type = "Like", Value = "{" },
                    new DiyWhere { Name = "IsEnable", Type = "=", Value = 1 }
                },
                _PageIndex = 1,
                _PageSize = 500
            });
            if ((primaryResult.Code != 1 || primaryResult.Data == null)
                && (multiResult.Code != 1 || multiResult.Data == null)) return (null, null);

            var rows = new List<JObject>();
            if (primaryResult.Code == 1 && primaryResult.Data != null)
                rows.AddRange(JArray.FromObject(primaryResult.Data).OfType<JObject>());
            if (multiResult.Code == 1 && multiResult.Data != null)
                rows.AddRange(JArray.FromObject(multiResult.Data).OfType<JObject>());
            var matches = new List<(JObject Model, JObject Values)>();
            foreach (var row in rows
                .GroupBy(item => item["Id"]?.ToString() ?? item["ApiEngineKey"]?.ToString(), StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First()))
            {
                if (!TryMatchConfiguredTemplate(row, apiPath, out var values)) continue;
                var routeTenant = values.GetValue("OsClient", StringComparison.OrdinalIgnoreCase)?.ToString();
                if (!routeTenant.DosIsNullOrWhiteSpace()
                    && !string.Equals(routeTenant, osClient, StringComparison.OrdinalIgnoreCase)) continue;
                matches.Add((row, values));
            }
            if (matches.Count == 1) return (matches[0].Model, matches[0].Values);
            if (matches.Count > 1)
            {
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "ApiEngine",
                    "AmbiguousTemplateRoute",
                    "接口引擎模板路由存在冲突",
                    string.Join(";", matches.Select(item => item.Model["ApiEngineKey"]?.ToString())),
                    3,
                    false,
                    apiPath);
            }
            return (null, null);
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

                // The legacy header is still valid for the generic controller
                // endpoint. A custom URL must continue through route resolution,
                // otherwise the controller can only look up by ApiAddress and a
                // historical duplicate address may execute the wrong policy row.
                var originalPath = httpContext.Request.Path.Value ?? string.Empty;
                if (httpContext.Request.Headers["apiengine"].ToString() == "1"
                    && originalPath.StartsWith(
                        "/api/apiengine/",
                        StringComparison.OrdinalIgnoreCase))
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

                var apiPathLower = NormalizeApiEngineRouteAddress(apiPath);
                var canonicalApiEngineKey = ResolveCanonicalApiEngineKey(apiPathLower);

                // FormEngine 特殊路由快速匹配
                if (TryMapFormEngineRoute(apiPathLower, values))
                {
                    return values;
                }

                // 【性能优化】提前识别标准 Controller 路由，直接返回，避免缓存查询
                // 这样可以避免每次请求都查询缓存（本地+Redis），性能提升显著
                foreach (var prefix in StandardControllerPrefixes)
                {
                    if (!MigratedControllerRoutePaths.Contains(apiPathLower)
                        && apiPathLower.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    {
                        // 标准路由，直接返回，交给 ASP.NET Core 路由系统处理
                        return values;
                    }
                }

                // 提取 OsClient（多来源优先级解析）
                var osClient = osClientFromPath;
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = ResolveUniquePathTenant(apiPath);
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = DiyToken.GetCurrentOsClient();
                }

                // 获取租户缓存
                var cacheClient = MicroiEngine.CacheTenant.Cache(osClient);

                // 完整 ApiAddress 是第一事实源。单段地址可能与实际 ApiEngineKey
                // 不同（例如 /get-microi-store-list -> get-microi-store），因此不能
                // 先用路径片段命中另一个同名 Key。只有地址明确未配置时才退回 Key。
                var addressCacheKey = BuildCacheKey(osClient, apiPathLower);
                var apiModel = await cacheClient.GetAsync<dynamic>(addressCacheKey);
                if (apiModel is string addressCachedText)
                {
                    try
                    {
                        apiModel = JObject.Parse(addressCachedText);
                    }
                    catch
                    {
                        // 兼容曾由应用商城导入脚本写入的 "System..." 对象类型名。
                        // 只删除当前确定损坏的别名，随后从数据库回源并重建全部兼容别名。
                        await cacheClient.RemoveAsync(addressCacheKey);
                        apiModel = null;
                        MicroiEngine.QueueSystemLog(osClient, "ApiEngine", "InvalidRouteCacheRemoved", "已移除非 JSON 接口引擎缓存", "缓存将在数据库回源后重建。", 2, true, addressCacheKey);
                    }
                }

                if (apiModel == null && !osClient.DosIsNullOrWhiteSpace())
                {
                    // 冷缓存回退必须读取主库。保存已提交但 DbRead 尚未同步时，
                    // 普通读取会把真实自定义路由误判为不存在并返回 404。先按完整
                    // ApiAddress 权威读取；仅 Code=1 且 Data=null（明确未配置）时，
                    // 才允许把单段路径作为兼容 ApiEngineKey 再查一次。
                    var fallbackResult = GetAuthoritativeRouteByAddress(
                        osClient,
                        apiPathLower);

                    if (fallbackResult.Code == 1
                        && fallbackResult.Data == null
                        && !canonicalApiEngineKey.DosIsNullOrWhiteSpace())
                    {
                        // “启用地址未命中”不等于“地址从未配置”。显式停用的主地址
                        // 或多路由仍占用该 URL，必须阻断路径尾部 Key 回退，否则可能
                        // 误执行另一个恰好同名的启用接口。
                        var configuredRouteResult = ApiEngineAuthoritativeStore
                            .HasConfiguredRoute(OsClientExtend.GetClient(osClient), apiPathLower);
                        if (configuredRouteResult.Code != 1)
                        {
                            fallbackResult = new DosResult<dynamic>(
                                configuredRouteResult.Code,
                                null,
                                configuredRouteResult.Msg);
                        }
                        else if (!configuredRouteResult.Data)
                        {
                            // 已进入主库冷回源路径后，兼容 Key 也必须读取权威行，不能
                            // 接受可能漏掉删除/停用广播的旧缓存并执行过期脚本。
                            var keyParam = new ApiEngineParam
                            {
                                OsClient = osClient,
                                _CurrentUser = null,
                                ApiEngineKey = canonicalApiEngineKey
                            };
                            fallbackResult = await MicroiEngine.ApiEngine
                                .GetAuthoritativeApiEngineModel(keyParam);
                        }
                    }

                    if (fallbackResult.Code == 1 && fallbackResult.Data != null)
                    {
                        apiModel = JObject.FromObject((object)fallbackResult.Data);
                        var cacheJson = JsonConvert.SerializeObject((object)fallbackResult.Data);
                        // 同步重建 Id、Key、主路由及全部多路由缓存别名。
                        var cacheTasks = ApiEngineRouteAliases.GetCacheAliases((object)apiModel)
                            .Select(alias => cacheClient.SetAsync(BuildCacheKey(osClient, alias), cacheJson))
                            .ToList();
                        if (cacheTasks.Count > 0)
                        {
                            await Task.WhenAll(cacheTasks);
                        }
                    }

                    // Key 兼容回退命中权威行时，为当前完整地址补一个推导别名，避免
                    // ApiAddress 未配置的传统 Key 路由在每次请求都访问主库。未来若
                    // 保存显式 ApiAddress，表事件会用权威行覆盖同一缓存别名。
                    if (apiModel != null
                        && !ApiEngineRouteAliases.ContainsExactRoute((object)apiModel, apiPathLower))
                    {
                        var inferredCacheJson = JsonConvert.SerializeObject((object)apiModel);
                        await cacheClient.SetAsync(addressCacheKey, inferredCacheJson);
                    }
                }

                if (apiModel == null && !osClient.DosIsNullOrWhiteSpace()
                    && apiPath.IndexOf('{') < 0)
                {
                    var templateRoute = await ResolveTemplateRouteAsync(osClient, apiPath);
                    if (templateRoute.ApiModel != null)
                    {
                        apiModel = templateRoute.ApiModel;
                        httpContext.Items[ResolvedApiRouteValuesItem] = templateRoute.RouteValues;
                        var cacheJson = JsonConvert.SerializeObject(templateRoute.ApiModel);
                        await cacheClient.SetAsync(BuildCacheKey(osClient, apiPathLower), cacheJson);
                    }
                }

                if (apiModel != null)
                {
                    JObject cachedRouteValues;
                    if (TryMatchConfiguredTemplate((object)apiModel, apiPath, out cachedRouteValues))
                    {
                        var routeTenant = cachedRouteValues
                            .GetValue("OsClient", StringComparison.OrdinalIgnoreCase)?.ToString();
                        if (!routeTenant.DosIsNullOrWhiteSpace()
                            && !string.Equals(routeTenant, osClient, StringComparison.OrdinalIgnoreCase))
                            return values;
                        httpContext.Items[ResolvedApiRouteValuesItem] = cachedRouteValues;
                    }
                    // 在路由解析阶段即把真实接口引擎 Key 写入轻量观测上下文。
                    // 控制器无需读取请求体，固定自定义地址与通用兼容入口都能按
                    // ApiEngineKey 分开统计，避免聚合成无法定位的 /api/ApiEngine/Run。
                    var (resolvedApiEngineKey, _) = GetRouteCacheAliases((object)apiModel);
                    if (!resolvedApiEngineKey.DosIsNullOrWhiteSpace())
                    {
                        httpContext.Items[ResolvedApiEngineKeyItem] = resolvedApiEngineKey;
                    }
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
