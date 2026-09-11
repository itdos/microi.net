using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json;
using Dos.ORM;
using System.Text.RegularExpressions;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;
using System.Linq;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net.Api
{
    /// <summary>
    /// 接口引擎
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class ApiEngineController : Controller
    {
        /// <summary>
        /// 系统消息的持久化由接口引擎事务完成；只有精确的官方 Managed 引擎在
        /// 成功提交并声明 DeliveryPending 后，宿主才执行 best-effort SignalR 投递。
        /// </summary>
        private async Task PublishChatSystemMessageAfterCommitAsync(object result, JObject param)
        {
            if (!string.Equals(
                    param?["ApiEngineKey"]?.ToString(),
                    "platform-chat-system-message",
                    StringComparison.OrdinalIgnoreCase))
                return;
            JObject model;
            try { model = result as JObject ?? JObject.FromObject(result); }
            catch { return; }
            if (model?["Code"].Val<int>() != 1
                || model["Data"] is not JObject
                || model["DataAppend"]?["DeliveryPending"].Val<bool>() != true)
                return;

            var osClient = param?["OsClient"]?.ToString();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = DiyToken.GetCurrentOsClient();
            var hubContext = HttpContext.RequestServices.GetRequiredService<IHubContext<DiyWebSocket>>();
            await new DiyWebSocket(null)
                .DeliverPreparedMessageAsync(model, osClient, hubContext)
                .ConfigureAwait(false);
        }

        private static async Task<JObject> DefaultParam(JObject param)
        {
            param = param ?? new JObject();
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            var currentUser = currentTokenDynamic?.CurrentUser;
            string rawRequestBody = null;
            //2024-04-18 往V8.Param中添加Url参数
            try
            {
                foreach (var item in DiyHttpContext.Current?.Request.Query)
                {
                    param[item.Key] = item.Value.ToString();
                }
            }
            catch (Exception ex) { }
            //2024-10-25 往V8.Param中添加 form-data 参数
            try
            {
                if (DiyHttpContext.Current.Request.HasFormContentType)
                {
                    foreach (var item in DiyHttpContext.Current.Request.Form)
                    {
                        param[item.Key] = item.Value.ToString();
                    }
                }
            }
            catch (Exception ex) { }
            // 动态接口路由下，[FromBody] JObject 在部分客户端/路由组合中可能没有
            // 获得 JSON Body。统一从已启用缓冲的请求体补偿恢复缺失参数；Query/Form
            // 仍保持较高优先级，避免改变既有调用语义。同时继续兼容 XML 请求。
            try
            {
                var request = DiyHttpContext.Current?.Request;
                if (request?.Body != null && !HdfsUploadRequestContext.HasCurrentRequest)
                {
                    request.EnableBuffering();
                    if (request.Body.CanSeek)
                    {
                        request.Body.Position = 0;
                    }

                    string body;
                    using (var reader = new StreamReader(
                               request.Body,
                               Encoding.UTF8,
                               detectEncodingFromByteOrderMarks: true,
                               bufferSize: 1024,
                               leaveOpen: true))
                    {
                        body = await reader.ReadToEndAsync();
                    }
                    // 原始正文只由宿主写入受保护元数据，供签名/AES/XML 等协议原子使用；
                    // 普通 JSON/XML 参数仍按下方兼容规则投影到 V8.Param。
                    rawRequestBody = body;

                    if (request.Body.CanSeek)
                    {
                        request.Body.Position = 0;
                    }

                    if (!body.DosIsNullOrWhiteSpace())
                    {
                        var trimmedBody = body.TrimStart();
                        var isJson = request.ContentType?.Contains(
                                         "json",
                                         StringComparison.OrdinalIgnoreCase) == true
                                     || trimmedBody.StartsWith("{", StringComparison.Ordinal);
                        if (isJson)
                        {
                            var bodyParam = JObject.Parse(body);
                            foreach (var property in bodyParam.Properties())
                            {
                                if (param.Property(property.Name) == null)
                                {
                                    param[property.Name] = property.Value.DeepClone();
                                }
                            }
                        }
                        else if (trimmedBody.StartsWith("<", StringComparison.Ordinal))
                        {
                            var xmlDoc = XDocument.Parse(body);
                            if (xmlDoc.Root != null)
                            {
                                XmlToJObject(xmlDoc.Root, param);
                            }
                        }
                    }
                }
            }
            catch (Exception ex) { }
            // Request body/query/form/xml are untrusted business parameters. Restore
            // the server-derived security context after merging them so callers cannot
            // impersonate another user or turn a client request into an internal
            // invocation. OsClient remains a supported public-engine routing parameter;
            // the core engine strips identity when it differs from the token tenant.
            if (currentUser != null)
            {
                param["_CurrentUser"] = JTokenEx.FromObject(currentUser);
                if (param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    param["OsClient"] = currentTokenDynamic.OsClient;
                }
            }
            else
            {
                param.Remove("_CurrentUser");
            }
            // AI 应用允许匿名展示界面，但匿名身份不能由业务参数伪造。
            // 这里只保留真实 HTTP Header 中的设备标识，核心 ApiEngine 会将其
            // 单向散列为匿名只读空间；登录后则统一改用服务端 CurrentUser.Id。
            param.Remove("_DeviceId");
            try
            {
                var deviceId = DiyHttpContext.Current?.Request.Headers["did"].FirstOrDefault()?.Trim();
                if (!deviceId.DosIsNullOrWhiteSpace())
                {
                    param["_DeviceId"] = deviceId.Length > 256 ? deviceId.Substring(0, 256) : deviceId;
                }
            }
            catch (Exception ex) { }
            // HTTP 调用者不得伪造表单引擎内部可信调用标记。
            param.Remove("_TrustedServerInvocation");
            // DynamicRoute resolved the concrete row before controller execution.
            // It is authoritative for this URL and must override any body value;
            // this also prevents duplicate historical ApiAddress rows from making
            // permission checks and execution select different engines.
            var requestPath = DiyHttpContext.Current?.Request.Path.Value ?? string.Empty;
            var normalizedApiAddress = DynamicRoute.NormalizeApiEngineRouteAddress(requestPath);
            // DynamicRoute 已按“完整 ApiAddress 优先、未配置才退 Key”解析真实 Key。
            // 只有它明确写入 Items 时才能覆盖为 ApiEngineKey；若路由层未解析到行，
            // 控制器必须保留完整 ApiAddress 语义，不能再次把自定义地址猜成 Key。
            var resolvedApiEngineKey = DiyHttpContext.Current?.Items[
                DynamicRoute.ResolvedApiEngineKeyItem]?.ToString();
            if (!resolvedApiEngineKey.DosIsNullOrWhiteSpace())
            {
                // DynamicRoute 对所有自定义地址都是权威来源，不仅限于
                // /apiengine/*。请求体不得把已解析的自定义路由切换到另一个 Key。
                param.Remove("ApiEngineKey");
                param.Remove("ApiAddress");
                param["ApiEngineKey"] = resolvedApiEngineKey;
            }
            else if (normalizedApiAddress.StartsWith(
                         "/apiengine/",
                         StringComparison.OrdinalIgnoreCase))
            {
                // 动态 URL 下请求体中的 ApiEngineKey/ApiAddress 都不可信。
                param.Remove("ApiEngineKey");
                param.Remove("ApiAddress");
                param["ApiAddress"] = normalizedApiAddress;
            }
            // 模板路由参数与 HTTP 元数据必须由宿主在合并不可信输入后覆盖，避免调用者
            // 伪造 {OsClient}/{ConnectionKey} 或请求方法。接口引擎据此可以实现标准
            // OIDC、SAML2、CAS 等需要原始路径语义的协议端点。
            param.Remove("_RouteValues");
            param.Remove("_HttpMethod");
            param.Remove("_RequestPath");
            param.Remove("_RequestScheme");
            param.Remove("_RequestHost");
            param.Remove("_RequestPathBase");
            param.Remove("_RawBody");
            param.Remove("_ContentType");
            var routeValues = DiyHttpContext.Current?.Items[
                DynamicRoute.ResolvedApiRouteValuesItem] as JObject;
            if (routeValues != null)
            {
                param["_RouteValues"] = routeValues.DeepClone();
                foreach (var property in routeValues.Properties())
                    param[property.Name] = property.Value.DeepClone();
            }
            var trustedHttpRequest = DiyHttpContext.Current?.Request;
            if (trustedHttpRequest != null)
            {
                param["_HttpMethod"] = trustedHttpRequest.Method;
                param["_RequestPath"] = trustedHttpRequest.Path.Value ?? string.Empty;
                param["_RequestScheme"] = trustedHttpRequest.Scheme;
                param["_RequestHost"] = trustedHttpRequest.Host.Value;
                param["_RequestPathBase"] = trustedHttpRequest.PathBase.Value ?? string.Empty;
                param["_ContentType"] = trustedHttpRequest.ContentType ?? string.Empty;
                if (rawRequestBody != null)
                {
                    param["_RawBody"] = rawRequestBody;
                }
            }
            //调用方式 Server、Client
            param["_InvokeType"] = InvokeType.Client.ToString();
            return param;
        }

        private static void ApplyRouteOsClient(JObject param, string routeOsClient)
        {
            if (routeOsClient.DosIsNullOrWhiteSpace()) return;
            // ApiEngine's core boundary clears the authenticated identity when this
            // target differs from the token tenant, so only AllowAnonymous engines
            // can be called across tenants.
            param["OsClient"] = routeOsClient;
        }

        private void AttachFormFilesAndAnnotateTransfer(JObject param)
        {
            // HDFS 协议桥已验证文件流并建立请求作用域，禁止再复制原图/展示图为 Base64。
            if (HdfsUploadRequestContext.HasCurrentRequest) return;
            if (!HttpContext.Request.HasFormContentType
                || HttpContext.Request.Form?.Files == null
                || HttpContext.Request.Form.Files.Count == 0) return;

            var formFiles = HttpContext.Request.Form.Files.Where(file => file != null).ToList();
            NetworkTrafficObservabilityService.AnnotateTransfer(
                HttpContext,
                "Upload",
                formFiles.Count,
                formFiles.Sum(file => Math.Max(0L, file.Length)),
                formFiles.Select(file => file.FileName),
                formFiles.Select(file => System.IO.Path.GetExtension(file.FileName)));

            // V8.FilesByteBase64 是历史兼容契约。这里只在接口确实上传文件时转换；
            // 流量观测仅记录净化元数据，不复制正文或文件内容到日志。
            var files = new Dictionary<string, string>();
            foreach (var file in formFiles)
            {
                files[file.FileName] = Convert.ToBase64String(
                    StreamHelper.StreamToBytes(file.OpenReadStream()));
            }
            param["_FilesByteBase64"] = JsonHelper.Serialize(files);
        }

        /// <summary>
        /// 只在 ApiEngine.RunAsync 已返回（其自有事务已经提交或回滚）后处理通用实时通知。
        /// 广播失败不能把已提交的业务伪装成失败，客户端必须用 Version + Snapshot 收敛。
        /// </summary>
        private static async Task PublishApiEngineRealtimeAfterCommitAsync(
            object result,
            JObject param)
        {
            try
            {
                var osClient = param?["OsClient"]?.ToString();
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = DiyToken.GetCurrentOsClient();
                }
                if (!ApiEngineRealtimeRuntime.TryReadEvent(
                        result,
                        osClient,
                        out var realtimeEvent,
                        out var contractError))
                {
                    if (!contractError.DosIsNullOrWhiteSpace())
                    {
                        MicroiEngine.QueueSystemLog(
                            osClient,
                            "ApiEngineRealtime",
                            "EventContractRejected",
                            "接口引擎实时通知契约不合法",
                            contractError,
                            2);
                    }
                    return;
                }

                var publishResult = await ApiEngineRealtimeRuntime
                    .PublishAfterCommitWithinBudgetAsync(osClient, realtimeEvent)
                    .ConfigureAwait(false);
                if (publishResult.Conflict)
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "ApiEngineRealtime",
                        "EventIdConflictRejected",
                        "接口引擎实时 EventId 重放内容不一致，已拒绝广播",
                        $"EventId={realtimeEvent.EventId}; ChannelKey={realtimeEvent.ChannelKey}; SubjectId={realtimeEvent.SubjectId}",
                        3,
                        false,
                        realtimeEvent.EventId);
                }
                else if (publishResult.VersionConflict)
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "ApiEngineRealtime",
                        "VersionConflictRejected",
                        "接口引擎实时 Version 与已保存事件冲突，已拒绝广播",
                        $"EventId={realtimeEvent.EventId}; ChannelKey={realtimeEvent.ChannelKey}; SubjectId={realtimeEvent.SubjectId}; Version={realtimeEvent.Version}",
                        3,
                        false,
                        realtimeEvent.EventId);
                }
                else if (publishResult.Stale)
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "ApiEngineRealtime",
                        "StaleVersionRejected",
                        "接口引擎实时低版本事件已拒绝广播",
                        $"EventId={realtimeEvent.EventId}; ChannelKey={realtimeEvent.ChannelKey}; SubjectId={realtimeEvent.SubjectId}; Version={realtimeEvent.Version}",
                        2,
                        false,
                        realtimeEvent.EventId);
                }
                else if (!publishResult.RedisError.DosIsNullOrWhiteSpace()
                         || !publishResult.BroadcastError.DosIsNullOrWhiteSpace())
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "ApiEngineRealtime",
                        "EventBroadcastDegraded",
                        "接口引擎实时通知已降级为 Snapshot 轮询",
                        $"Redis={publishResult.RedisError}; SignalR={publishResult.BroadcastError}",
                        2,
                        false,
                        realtimeEvent.EventId);
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    param?["OsClient"]?.ToString(),
                    "ApiEngineRealtime",
                    "EventBroadcastFailed",
                    "接口引擎实时通知处理异常，已降级为 Snapshot 轮询",
                    ex.ToString(),
                    2);
            }
        }

        /// <summary>
        /// 旧游戏协议的向后兼容旁路。新业务应使用 DataAppend.RealtimeEvent。
        /// </summary>
        private static async Task PublishRealtimeInvalidationAfterCommitAsync(
            object result,
            JObject param)
        {
            try
            {
                var osClient = param?["OsClient"]?.ToString();
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = DiyToken.GetCurrentOsClient();
                }
                if (!GameRealtimeRuntime.TryReadInvalidation(
                        result,
                        osClient,
                        out var invalidation,
                        out var contractError))
                {
                    if (!contractError.DosIsNullOrWhiteSpace())
                    {
                        MicroiEngine.QueueSystemLog(
                            osClient,
                            "GameRealtime",
                            "InvalidationContractRejected",
                            "游戏实时失效通知契约不合法",
                            contractError,
                            2);
                    }
                    return;
                }

                var publishResult = await GameRealtimeRuntime.PublishAfterCommitWithinBudgetAsync(
                        osClient,
                        invalidation)
                    .ConfigureAwait(false);
                if (publishResult.Conflict)
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "GameRealtime",
                        "EventIdConflictRejected",
                        "游戏实时 EventId 重放内容不一致，已拒绝广播",
                        $"EventId={invalidation.EventId}; AppKey={invalidation.AppKey}; RoomId={invalidation.RoomId}",
                        3,
                        false,
                        invalidation.EventId);
                }
                else if (!publishResult.RedisError.DosIsNullOrWhiteSpace()
                         || !publishResult.BroadcastError.DosIsNullOrWhiteSpace())
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "GameRealtime",
                        "InvalidationBroadcastDegraded",
                        "游戏实时通知已降级为 Snapshot 轮询",
                        $"Redis={publishResult.RedisError}; SignalR={publishResult.BroadcastError}",
                        2,
                        false,
                        invalidation.EventId);
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    param?["OsClient"]?.ToString(),
                    "GameRealtime",
                    "InvalidationBroadcastFailed",
                    "游戏实时通知处理异常，已降级为 Snapshot 轮询",
                    ex.ToString(),
                    2);
            }
        }

        private static async Task<DosResult> AuthorizeAccessKeyApiEngineAsync(JObject param)
        {
            var currentUser = param?["_CurrentUser"] as JObject;
            if (!UserAccessKeySecurity.IsSession(currentUser))
            {
                return new DosResult(1);
            }

            var currentToken = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            var targetOsClient = param?["OsClient"]?.ToString();
            if (currentToken == null
                || currentToken.OsClient.DosIsNullOrWhiteSpace()
                || targetOsClient.DosIsNullOrWhiteSpace()
                || !string.Equals(
                    currentToken.OsClient,
                    targetOsClient,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "访问密钥不能跨租户运行接口引擎。");
            }

            // Permission policy must come from the authoritative sys_apiengine
            // row. Route/model caches are intentionally optimized for dispatch
            // and may still contain the policy that existed before an MCP role
            // update, which would make a newly granted $authenticated endpoint
            // look read-only until the process cache happened to expire.
            var modelResult = await MicroiEngine.ApiEngine.GetAuthoritativeApiEngineModel(
                    new ApiEngineParam
                    {
                        ApiEngineKey = param["ApiEngineKey"]?.ToString(),
                        ApiKey = param["ApiKey"]?.ToString(),
                        ApiAddress = param["ApiAddress"]?.ToString(),
                        OsClient = targetOsClient,
                        _CurrentUser = currentUser
                    })
                .ConfigureAwait(false);
            if (modelResult.Code != 1 || modelResult.Data == null)
            {
                return new DosResult(0, null, "当前访问密钥未授权运行此接口引擎。");
            }

            var model = modelResult.Data as JObject
                        ?? JObject.FromObject((object)modelResult.Data);
            var resolvedKey = model["ApiEngineKey"]?.ToString();
            return UserAccessKeySecurity.IsApiEngineAllowed(currentUser, resolvedKey)
                ? new DosResult(1)
                : new DosResult(0, null, "当前访问密钥未授权运行此接口引擎。");
        }

        /// <summary>
        /// Resolve the portable $authenticated ApiRole marker against the
        /// authoritative engine model. The cloned virtual role is scoped to this
        /// invocation and never enters DiyToken/login caches.
        /// </summary>
        private static async Task ExpandAuthenticatedApiRoleAsync(JObject param)
        {
            var currentUser = param?["_CurrentUser"] as JObject;
            if (currentUser == null) return;

            // Read the permission allow-list from the database-backed model so
            // an MCP role update takes effect immediately for this request.
            var modelResult = await MicroiEngine.ApiEngine.GetAuthoritativeApiEngineModel(
                    new ApiEngineParam
                    {
                        ApiEngineKey = param["ApiEngineKey"]?.ToString(),
                        ApiKey = param["ApiKey"]?.ToString(),
                        ApiAddress = param["ApiAddress"]?.ToString(),
                        OsClient = param["OsClient"]?.ToString(),
                        _CurrentUser = currentUser
                    })
                .ConfigureAwait(false);
            if (modelResult.Code != 1 || modelResult.Data == null)
            {
                return;
            }

            var model = modelResult.Data as JObject
                        ?? JObject.FromObject((object)modelResult.Data);
            var configuredRoles = model["ApiRole"]?.ToString();
            var invocationUser = ApiEngineRoleAuthorization.PrepareInvocationUser(
                currentUser,
                configuredRoles);
            if (!ReferenceEquals(invocationUser, currentUser))
            {
                param["_CurrentUser"] = invocationUser;
            }
        }

        private static void XmlToJObject(XElement element, JObject param)
        {
            foreach (var node in element.Nodes())
            {
                if (node is XElement e)
                {
                    if (e.HasElements)
                    {
                        XmlToJObject(e, param);
                    }
                    else
                    {
                        param[e.Name.LocalName] = e.Value;
                    }
                }
                else if (node is XText text)
                {
                    param[element.Name.LocalName] = text.Value;
                }
            }
        }

        private static ContentResult ResponseFileError(string msg, object? data = null)
        {
            return new ContentResult()
            {
                Content = JsonHelper.Serialize(new { Code = 0, Msg = msg, Data = data }),
                ContentType = "application/json; charset=utf-8"
            };
        }

        private static ApiEngineHttpStreamFormat ResolveStreamFormat(HttpRequest request)
        {
            var requested = request?.Query["streamFormat"].FirstOrDefault()
                            ?? request?.Headers.Accept.FirstOrDefault()
                            ?? string.Empty;
            return requested.Contains("ndjson", StringComparison.OrdinalIgnoreCase)
                ? ApiEngineHttpStreamFormat.Ndjson
                : ApiEngineHttpStreamFormat.ServerSentEvents;
        }

        private static bool IsCommittedApiEngineResult(object result)
        {
            try
            {
                if (result == null) return true;
                if (result is DosResult dosResult) return dosResult.Code == 1;
                var token = result as JToken ?? JToken.FromObject(result);
                if (token is JObject obj && obj.Property("Code") != null)
                {
                    return obj["Code"].Val<int>() == 1;
                }
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static async Task RunStreamHeartbeatAsync(
            ApiEngineHttpStreamSink sink,
            int heartbeatSeconds,
            CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested && sink.IsConnected)
                {
                    await Task.Delay(
                            TimeSpan.FromSeconds(heartbeatSeconds),
                            cancellationToken)
                        .ConfigureAwait(false);
                    if (!cancellationToken.IsCancellationRequested)
                    {
                        await sink.WriteHeartbeatAsync().ConfigureAwait(false);
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        private static bool StartsWithBytes(byte[] bytes, params byte[] prefix)
        {
            if (bytes.Length < prefix.Length)
            {
                return false;
            }
            for (var i = 0; i < prefix.Length; i++)
            {
                if (bytes[i] != prefix[i])
                {
                    return false;
                }
            }
            return true;
        }

        private static string BytesToHexPrefix(byte[] bytes, int maxLength = 16)
        {
            var length = Math.Min(bytes.Length, maxLength);
            var result = new string[length];
            for (var i = 0; i < length; i++)
            {
                result[i] = bytes[i].ToString("X2");
            }
            return string.Join(" ", result);
        }

        private static string BytesToAsciiPrefix(byte[] bytes, int maxLength = 16)
        {
            var length = Math.Min(bytes.Length, maxLength);
            var result = new char[length];
            for (var i = 0; i < length; i++)
            {
                result[i] = bytes[i] >= 32 && bytes[i] <= 126 ? (char)bytes[i] : '.';
            }
            return new string(result);
        }

        private static bool IsWebp(byte[] bytes)
        {
            return bytes.Length >= 12
                && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
                && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
        }

        private static bool IsAvif(byte[] bytes)
        {
            return bytes.Length >= 12
                && bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70
                && bytes[8] == 0x61 && bytes[9] == 0x76 && bytes[10] == 0x69
                && (bytes[11] == 0x66 || bytes[11] == 0x73);
        }

        private static bool IsSvg(byte[] bytes)
        {
            var text = BytesToAsciiPrefix(bytes, Math.Min(bytes.Length, 256)).TrimStart('.', ' ', '\t', '\r', '\n');
            return text.StartsWith("<svg", StringComparison.OrdinalIgnoreCase)
                || text.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase);
        }

        private static int IndexOfBytes(byte[] bytes, params byte[] marker)
        {
            if (bytes.Length < marker.Length)
            {
                return -1;
            }
            for (var i = 0; i <= bytes.Length - marker.Length; i++)
            {
                var matched = true;
                for (var j = 0; j < marker.Length; j++)
                {
                    if (bytes[i + j] != marker[j])
                    {
                        matched = false;
                        break;
                    }
                }
                if (matched)
                {
                    return i;
                }
            }
            return -1;
        }

        private static byte[] NormalizeResponseFileBytes(string contentType, byte[] fileBytes)
        {
            var normalizedContentType = contentType.Split(';')[0].Trim().ToLowerInvariant();
            if (normalizedContentType != "application/pdf" || StartsWithBytes(fileBytes, 0x25, 0x50, 0x44, 0x46, 0x2D))
            {
                return fileBytes;
            }

            var pdfOffset = IndexOfBytes(fileBytes, 0x25, 0x50, 0x44, 0x46, 0x2D);
            if (pdfOffset <= 0)
            {
                return fileBytes;
            }

            var pdfBytes = new byte[fileBytes.Length - pdfOffset];
            Buffer.BlockCopy(fileBytes, pdfOffset, pdfBytes, 0, pdfBytes.Length);
            return pdfBytes;
        }

        private static ContentResult? ValidateResponseFileBytes(string contentType, byte[] fileBytes)
        {
            if (fileBytes.Length == 0)
            {
                return ResponseFileError("FileByteBase64不能为空文件！");
            }

            var normalizedContentType = contentType.Split(';')[0].Trim().ToLowerInvariant();
            string? expectedFirstAscii = null;
            var isValid = true;

            switch (normalizedContentType)
            {
                case "application/pdf":
                    expectedFirstAscii = "%PDF-";
                    isValid = StartsWithBytes(fileBytes, 0x25, 0x50, 0x44, 0x46, 0x2D);
                    break;
                case "image/png":
                    expectedFirstAscii = "PNG";
                    isValid = StartsWithBytes(fileBytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
                    break;
                case "image/jpeg":
                case "image/jpg":
                    expectedFirstAscii = "JPEG";
                    isValid = StartsWithBytes(fileBytes, 0xFF, 0xD8, 0xFF);
                    break;
                case "image/gif":
                    expectedFirstAscii = "GIF8";
                    isValid = StartsWithBytes(fileBytes, 0x47, 0x49, 0x46, 0x38);
                    break;
                case "image/webp":
                    expectedFirstAscii = "RIFF....WEBP";
                    isValid = IsWebp(fileBytes);
                    break;
                case "image/avif":
                    expectedFirstAscii = "....ftypavif/avis";
                    isValid = IsAvif(fileBytes);
                    break;
                case "image/bmp":
                    expectedFirstAscii = "BM";
                    isValid = StartsWithBytes(fileBytes, 0x42, 0x4D);
                    break;
                case "image/tiff":
                    expectedFirstAscii = "II* or MM*";
                    isValid = StartsWithBytes(fileBytes, 0x49, 0x49, 0x2A, 0x00)
                        || StartsWithBytes(fileBytes, 0x4D, 0x4D, 0x00, 0x2A);
                    break;
                case "image/x-icon":
                case "image/vnd.microsoft.icon":
                    expectedFirstAscii = "ICO";
                    isValid = StartsWithBytes(fileBytes, 0x00, 0x00, 0x01, 0x00);
                    break;
                case "image/svg+xml":
                    expectedFirstAscii = "<svg or <?xml";
                    isValid = IsSvg(fileBytes);
                    break;
            }

            if (!isValid)
            {
                var errorMsg = "响应文件内容与ContentType不匹配，浏览器无法正常预览或下载。";
                if (normalizedContentType == "application/pdf"
                    && StartsWithBytes(fileBytes, 0x4B, 0x44, 0x5F, 0x43, 0x5F, 0x50, 0x4C, 0x4D))
                {
                    errorMsg = "金蝶PLM电子仓返回的是KD_C_PLM封装流，不是真实PDF字节；请返回以%PDF-开头的PDF文件或先完成金蝶预览文件转换。";
                }
                return ResponseFileError(errorMsg, new
                {
                    ContentType = contentType,
                    ExpectedFirstAscii = expectedFirstAscii,
                    ActualFirstAscii = BytesToAsciiPrefix(fileBytes),
                    ActualFirstHex = BytesToHexPrefix(fileBytes),
                    fileBytes.Length
                });
            }
            return null;
        }

        private static bool ShouldOpenResponseFileInline(string contentType)
        {
            var normalizedContentType = contentType.Split(';')[0].Trim();
            return normalizedContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedContentType, "application/pdf", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        ///
        /// </summary>
        /// <returns></returns>
        [HttpOptions]
        [AllowAnonymous]
        public IActionResult HandleOptions()
        {
            // //设置CORS响应头
            // Response.Headers.Add("Access-Control-Allow-Origin", "*");
            // Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            // Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            // 返回空响应或204状态码
            return NoContent();
        }

        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public IActionResult StopHttp()
        {
            // //设置CORS响应头
            // Response.Headers.Add("Access-Control-Allow-Origin", "*");
            // Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            // Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            // 返回空响应或204状态码
            return Json(new DosResult(0, "此接口已禁止http调用！"));
        }
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public IActionResult NotEnable()
        {
            // //设置CORS响应头
            // Response.Headers.Add("Access-Control-Allow-Origin", "*");
            // Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            // Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            // 返回空响应或204状态码
            return Json(new DosResult(0, "此接口已停用！"));
        }

        /// <summary>
        /// Content-Type:application/json
        /// </summary>
        /// <param name="param"></param>
        ///// <returns></returns>
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        [Consumes("application/json", "multipart/form-data")]
        [AllowAnonymous]
        public async Task<IActionResult> Run([FromBody] JObject param)
        {
            param = await DefaultParam(param);
            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            ApplyRouteOsClient(param, osClient);
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");
            param["ApiAddress"] = apiPath;
            SystemObservabilityService.AnnotateApiEngine(HttpContext, param["ApiEngineKey"].Val<string>(), param["OsClient"].Val<string>());
            try { AttachFormFilesAndAnnotateTransfer(param); } catch { }
            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);
            dynamic? result = await MicroiEngine.ApiEngine.RunAsync(param);
            await PublishRealtimeInvalidationAfterCommitAsync(result, param);
            await PublishApiEngineRealtimeAfterCommitAsync(result, param);
            await PublishChatSystemMessageAfterCommitAsync(result, param);
            if (result != null && result?.GetType() == typeof(string))
            {
                return Content(result, "text/plain; charset=utf-8");
            }
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="apiEngineParam"></param>
        /// <returns></returns>
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        // [Consumes("application/json", "multipart/form-data")]//加上这个会导致415错误
        [AllowAnonymous]
        public async Task<IActionResult> Run_FormData(ApiEngineParam apiEngineParam)
        {
            var param = JObject.FromObject(apiEngineParam);
            param = await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            ApplyRouteOsClient(param, osClient);
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;
            SystemObservabilityService.AnnotateApiEngine(HttpContext, param["ApiEngineKey"].Val<string>(), param["OsClient"].Val<string>());
            //param.ApiAddress = HttpContext.Request.Path.Value;

            AttachFormFilesAndAnnotateTransfer(param);

            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);
            var result = await MicroiEngine.ApiEngine.RunAsync(param);
            await PublishRealtimeInvalidationAfterCommitAsync(result, param);
            await PublishApiEngineRealtimeAfterCommitAsync(result, param);
            await PublishChatSystemMessageAfterCommitAsync(result, param);

            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/plain; charset=utf-8");
            }
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        //[Consumes("application/json", "multipart/form-data")]//get请求无法增加这个
        [AllowAnonymous]
        public async Task<IActionResult> Run_Request_Get()
        {
            JObject param = new JObject();
            param = await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            ApplyRouteOsClient(param, osClient);
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;

            SystemObservabilityService.AnnotateApiEngine(HttpContext, param["ApiEngineKey"].Val<string>(), param["OsClient"].Val<string>());
            #region 接口引擎接收文件，将文件流转为byte[]，再转为string

            //get请求无法访问到 HttpContext.Request.Form
            //if (HttpContext.Request.HasFormContentType && HttpContext.Request.Form != null && HttpContext.Request.Form.Files != null && HttpContext.Request.Form.Files.Count > 0)
            //{
            //    var files = new Dictionary<string, string>();
            //    foreach (var file in HttpContext.Request.Form.Files)
            //    {
            //        if (file != null)
            //        {
            //            files.Add(file.FileName, Convert.ToBase64String(StreamHelper.StreamToBytes(file.OpenReadStream())));
            //        }
            //    }
            //    param["_FilesByteBase64"] = JsonHelper.Serialize(files);
            //}

            #endregion 接口引擎接收文件，将文件流转为byte[]，再转为string

            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);
            var result = await MicroiEngine.ApiEngine.RunAsync(param);
            await PublishRealtimeInvalidationAfterCommitAsync(result, param);
            await PublishApiEngineRealtimeAfterCommitAsync(result, param);
            await PublishChatSystemMessageAfterCommitAsync(result, param);
            try
            {
                var redirectUrl = (string)result.RedirectUrl;
                if (!redirectUrl.DosIsNullOrWhiteSpace()
                    && redirectUrl.ToLower() != "null"
                    && redirectUrl.ToLower() != "undefined"
                    )
                {
                    if (!CommonHelper.IsUrlSafe(redirectUrl))
                    {
                        return BadRequest(new { Code = 0, Msg = "URL验证失败：不允许的URL格式" });
                    }
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
            }

            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/plain; charset=utf-8");
            }
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet, HttpHead, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public async Task<ActionResult> Run_Response_File()
        {
            JObject param = new JObject();
            param = await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            ApplyRouteOsClient(param, osClient);
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;

            SystemObservabilityService.AnnotateApiEngine(HttpContext, param["ApiEngineKey"].Val<string>(), param["OsClient"].Val<string>());
            #region 接口引擎接收文件，将文件流转为byte[]，再转为string

            //get请求无法访问到 HttpContext.Request.Form
            //if (HttpContext.Request.HasFormContentType && HttpContext.Request.Form != null && HttpContext.Request.Form.Files != null && HttpContext.Request.Form.Files.Count > 0)
            //{
            //    var files = new Dictionary<string, string>();
            //    foreach (var file in HttpContext.Request.Form.Files)
            //    {
            //        if (file != null)
            //        {
            //            files.Add(file.FileName, Convert.ToBase64String(StreamHelper.StreamToBytes(file.OpenReadStream())));
            //        }
            //    }
            //    param["_FilesByteBase64"] = JsonHelper.Serialize(files);
            //}

            #endregion 接口引擎接收文件，将文件流转为byte[]，再转为string

            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);
            var result = await MicroiEngine.ApiEngine.RunAsync(param);
            await PublishRealtimeInvalidationAfterCommitAsync(result, param);
            await PublishApiEngineRealtimeAfterCommitAsync(result, param);
            await PublishChatSystemMessageAfterCommitAsync(result, param);
            try
            {
                var redirectUrl = (string)result.RedirectUrl;
                if (!redirectUrl.DosIsNullOrWhiteSpace()
                    && redirectUrl.ToLower() != "null"
                    && redirectUrl.ToLower() != "undefined"
                    )
                {
                    if (!CommonHelper.IsUrlSafe(redirectUrl))
                    {
                        return BadRequest(new { Code = 0, Msg = "URL验证失败：不允许的URL格式" });
                    }
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
            }
            //dynamic 转 DosResult
            JObject resultObj = JObject.FromObject(result);
            if (resultObj["Code"].Val<int>() != 1)
            {
                return new ContentResult() { Content = resultObj.ToString(), ContentType = "application/json; charset=utf-8" };
            }
            var resultDataObj = resultObj["Data"] as JObject;
            if (resultDataObj == null)
            {
                return new ContentResult() { Content = resultObj.ToString(), ContentType = "application/json; charset=utf-8" };
            }
            //返回文件：Data是一个对象：{ FileName: '(包含后缀格式)', ContentType: '(如：application/vnd.ms-excel)', FileByteBase64: '(byte[])' }
            var fileName = resultDataObj["FileName"].Val<string>();
            var contentType = resultDataObj["ContentType"].Val<string>();
            var fileByteBase64 = resultDataObj["FileByteBase64"].Val<string>();
            if (fileName.DosIsNullOrWhiteSpace() && contentType.DosIsNullOrWhiteSpace() && fileByteBase64.DosIsNullOrWhiteSpace())
            {
                return new ContentResult() { Content = resultObj.ToString(), ContentType = "application/json; charset=utf-8" };
            }
            if (fileName.DosIsNullOrWhiteSpace() || contentType.DosIsNullOrWhiteSpace() || fileByteBase64.DosIsNullOrWhiteSpace())
            {
                return new ContentResult()
                {
                    Content = JsonHelper.Serialize(new
                    {
                        Code = 0,
                        Msg = "FileName、ContentType、FileByteBase64均不能为空！"
                    }),
                    ContentType = "application/json; charset=utf-8"
                };
            }
            byte[] fileBytes;
            try
            {
                fileBytes = Convert.FromBase64String(fileByteBase64);
            }
            catch
            {
                return ResponseFileError("FileByteBase64不是合法的Base64字符串！");
            }
            fileBytes = NormalizeResponseFileBytes(contentType, fileBytes);
            var validateResult = ValidateResponseFileBytes(contentType, fileBytes);
            if (validateResult != null)
            {
                return validateResult;
            }
            var isInline = ShouldOpenResponseFileInline(contentType);
            if (isInline)
            {
                Response.Headers["Content-Disposition"] = $"inline; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
                return File(fileBytes, contentType);
            }
            return File(fileBytes, contentType, fileName);
        }

        [HttpPost, HttpGet, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public async Task<ActionResult> Run_Response_Html()
        {
            JObject param = new JObject();
            param = await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            ApplyRouteOsClient(param, osClient);
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;

            SystemObservabilityService.AnnotateApiEngine(HttpContext, param["ApiEngineKey"].Val<string>(), param["OsClient"].Val<string>());
            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);
            var result = await MicroiEngine.ApiEngine.RunAsync(param);
            await PublishRealtimeInvalidationAfterCommitAsync(result, param);
            await PublishApiEngineRealtimeAfterCommitAsync(result, param);
            await PublishChatSystemMessageAfterCommitAsync(result, param);
            try
            {
                var redirectUrl = (string)result.RedirectUrl;
                if (!redirectUrl.DosIsNullOrWhiteSpace()
                    && redirectUrl.ToLower() != "null"
                    && redirectUrl.ToLower() != "undefined"
                    )
                {
                    if (!CommonHelper.IsUrlSafe(redirectUrl))
                    {
                        return BadRequest(new { Code = 0, Msg = "URL验证失败：不允许的URL格式" });
                    }
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
            }
            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/html; charset=utf-8");
            }
            return Json(result);
        }

        /// <summary>
        /// 执行 ResponseType=HTTP 的接口引擎。V8 返回 DataAppend.HttpResponse，宿主
        /// 在事务完成后统一校验并写出状态码、正文、Content-Type、重定向和响应头。
        /// </summary>
        [HttpPost, HttpGet, HttpHead, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public async Task<IActionResult> Run_Response_Http()
        {
            var param = await DefaultParam(new JObject());
            var apiPath = HttpContext.Request.Path.Value ?? string.Empty;
            const string osClientPattern = @"--OsClient--(.*?)--$";
            var osClientMatch = Regex.Match(apiPath, osClientPattern);
            ApplyRouteOsClient(
                param,
                osClientMatch.Success ? osClientMatch.Groups[1].Value : string.Empty);
            apiPath = Regex.Replace(apiPath, osClientPattern, string.Empty);
            param["ApiAddress"] = apiPath;

            try
            {
                AttachFormFilesAndAnnotateTransfer(param);
            }
            catch (Exception ex)
            {
                return BadRequest(new DosResult(0, null, "读取 HTTP 接口上传文件失败：" + ex.Message));
            }

            SystemObservabilityService.AnnotateApiEngine(
                HttpContext,
                param["ApiEngineKey"].Val<string>(),
                param["OsClient"].Val<string>());
            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);

            var result = await MicroiEngine.ApiEngine.RunAsync(param);
            await PublishRealtimeInvalidationAfterCommitAsync(result, param);
            await PublishApiEngineRealtimeAfterCommitAsync(result, param);
            await PublishChatSystemMessageAfterCommitAsync(result, param);
            var osClient = param["OsClient"].Val<string>();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = DiyToken.GetCurrentOsClient();
            ApiEngineHttpResponse httpResponse;
            string error;
            if (!ApiEngineHttpResponseContract.TryRead(
                    (object)result,
                    osClient,
                    param["ApiEngineKey"].Val<string>(),
                    out httpResponse,
                    out error))
            {
                return StatusCode(500, new DosResult(0, null, error));
            }

            foreach (var header in httpResponse.Headers)
            {
                foreach (var value in header.Value)
                    Response.Headers.Append(header.Key, value);
            }
            Response.StatusCode = httpResponse.StatusCode;
            Response.ContentType = httpResponse.ContentType;
            if (HttpMethods.IsHead(HttpContext.Request.Method)
                || httpResponse.StatusCode == StatusCodes.Status204NoContent
                || httpResponse.StatusCode == StatusCodes.Status304NotModified)
                return new EmptyResult();
            if (httpResponse.BodyBytes != null)
            {
                Response.ContentLength = httpResponse.BodyBytes.Length;
                await Response.Body.WriteAsync(
                    httpResponse.BodyBytes,
                    HttpContext.RequestAborted).ConfigureAwait(false);
                return new EmptyResult();
            }
            return new ContentResult
            {
                StatusCode = httpResponse.StatusCode,
                ContentType = httpResponse.ContentType,
                Content = httpResponse.Body
            };
        }

        /// <summary>
        /// ApiEngine streaming response.  V8 writes provisional frames through
        /// V8.Stream.Write/WriteAsync; done is emitted only after transaction commit.
        /// Supports SSE by default and NDJSON when Accept/query requests ndjson.
        /// </summary>
        [HttpPost, HttpGet, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public async Task<IActionResult> Run_Response_Stream()
        {
            var param = await DefaultParam(new JObject());
            var apiPath = HttpContext.Request.Path.Value ?? string.Empty;
            const string osClientPattern = @"--OsClient--(.*?)--$";
            var osClientMatch = Regex.Match(apiPath, osClientPattern);
            ApplyRouteOsClient(
                param,
                osClientMatch.Success ? osClientMatch.Groups[1].Value : string.Empty);
            apiPath = Regex.Replace(apiPath, osClientPattern, string.Empty);
            param["ApiAddress"] = apiPath;

            try
            {
                AttachFormFilesAndAnnotateTransfer(param);
            }
            catch (Exception ex)
            {
                return BadRequest(new DosResult(0, null, "读取流式接口上传文件失败：" + ex.Message));
            }

            SystemObservabilityService.AnnotateApiEngine(
                HttpContext,
                param["ApiEngineKey"].Val<string>(),
                param["OsClient"].Val<string>());
            var accessKeyAuthorization = await AuthorizeAccessKeyApiEngineAsync(param);
            if (accessKeyAuthorization.Code != 1) return Json(accessKeyAuthorization);
            await ExpandAuthenticatedApiRoleAsync(param);

            var osClient = param["OsClient"].Val<string>();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = DiyToken.GetCurrentOsClient();
            var options = ApiEngineHttpStreamOptions.FromTenant(osClient);
            using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                HttpContext.RequestAborted);
            using var sink = new ApiEngineHttpStreamSink(
                HttpContext.Response,
                ResolveStreamFormat(HttpContext.Request),
                linkedCancellation.Token,
                options.MaxChunkBytes);
            V8ApiEngineStream writer = null;
            Task heartbeatTask = Task.CompletedTask;

            try
            {
                await sink.StartAsync(HttpContext.TraceIdentifier).ConfigureAwait(false);
                heartbeatTask = RunStreamHeartbeatAsync(
                    sink,
                    options.HeartbeatSeconds,
                    linkedCancellation.Token);
                using (ApiEngineStreamContext.Enter(
                           sink,
                           options.MaxChunkBytes,
                           options.MaxTotalBytes))
                {
                    writer = ApiEngineStreamContext.Current;
                    var result = await MicroiEngine.ApiEngine.RunAsync(param).ConfigureAwait(false);
                    await PublishRealtimeInvalidationAfterCommitAsync(result, param).ConfigureAwait(false);
                    await PublishApiEngineRealtimeAfterCommitAsync(result, param).ConfigureAwait(false);
                    await PublishChatSystemMessageAfterCommitAsync(result, param).ConfigureAwait(false);
                    await sink.CompleteAsync(
                            IsCommittedApiEngineResult(result),
                            result,
                            writer.WrittenChunks,
                            HttpContext.TraceIdentifier)
                        .ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
            {
                // Client disconnect is expected; V8 observes RequestAborted and stops.
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "ApiEngineStream",
                    "ExecutionFailed",
                    "接口引擎流式执行失败",
                    ex.ToString(),
                    3,
                    false,
                    HttpContext.TraceIdentifier);
                if (!HttpContext.RequestAborted.IsCancellationRequested)
                {
                    await sink.FailAsync(
                            "接口引擎流式执行失败，请使用 TraceId 查询系统日志。",
                            HttpContext.TraceIdentifier,
                            writer?.WrittenChunks ?? 0)
                        .ConfigureAwait(false);
                }
            }
            finally
            {
                linkedCancellation.Cancel();
                try
                {
                    await heartbeatTask.ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                }
            }

            return new EmptyResult();
        }
    }
}
