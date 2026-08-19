#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8EngineController.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-01-13
* 文件描述：V8引擎本地调试同步API（路由层）
*           路由同时兼容 api/V8Engine/* 和 api/V8Debug/*
*******************************************************/
#endregion
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Dos.Common;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// V8引擎MCP API（路由层，核心逻辑在 V8McpLogic）
    /// 同时兼容 api/V8Engine/* 和 api/V8Debug/* 两种路由
    /// </summary>
    [Route("api/V8Engine/[action]")]
    [Route("api/V8Debug/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [V8McpAuthorization]
    public class V8EngineController : Controller
    {
        private static string DecodeCodeBase64(string codeBase64)
        {
            if (string.IsNullOrWhiteSpace(codeBase64)) return "";
            return Encoding.UTF8.GetString(Convert.FromBase64String(codeBase64));
        }

        private static int? ResolveRequestedV8Limit(JObject param)
        {
            var v8Limit = param?["V8Limit"] ?? param?["v8Limit"];
            if (v8Limit != null)
            {
                return v8Limit.Val<int>() == 1 ? 1 : 0;
            }
            // Backward-compatible transport alias. Legacy V8Unlimited=true means
            // the new positive V8Limit switch is off.
            var v8Unlimited = param?["V8Unlimited"] ?? param?["v8Unlimited"];
            if (v8Unlimited != null)
            {
                return v8Unlimited.Val<int>() == 1 ? 0 : 1;
            }
            return null;
        }

        private static int IntOrDefault(JObject param, string name, int defaultValue)
        {
            var token = param?[name];
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return defaultValue;
            var raw = token.ToString();
            if (string.IsNullOrWhiteSpace(raw)) return defaultValue;
            if (int.TryParse(raw, out var value)) return value;
            if (token.Type == JTokenType.Boolean) return token.Val<bool>() ? 1 : 0;
            return defaultValue;
        }

        private static string StringOrCompactJson(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return null;
            return token.Type == JTokenType.String
                ? token.Val<string>()
                : token.ToString(Newtonsoft.Json.Formatting.None);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetStatus()
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            return Ok(new DosResult(1, V8McpLogic.BuildStatusData(token)));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApiEngineList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetApiEngineList(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApiEngine(string osClient, string apiEngineKey, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            apiEngineKey = apiEngineKey ?? param?["ApiEngineKey"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8McpLogic.GetApiEngine(osClient, apiEngineKey);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApiEngineCode(string osClient, string apiEngineKey, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            apiEngineKey = apiEngineKey ?? param?["ApiEngineKey"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8McpLogic.GetApiEngineCode(osClient, apiEngineKey);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetUpdatedApiEngines(string osClient, string lastSyncTime, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            lastSyncTime = lastSyncTime ?? param?["LastSyncTime"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.GetUpdatedApiEngines(osClient, lastSyncTime);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateApiEngineCode([FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "请求参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param.Value<string>("OsClient"), (object)token);
            var apiEngineKey = param.Value<string>("ApiEngineKey");
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var hasCodePayload = param["ApiV8CodeBase64"] != null
                || param["CodeBase64"] != null
                || param["ApiV8Code"] != null
                || param["Code"] != null;
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 ApiV8Code
            var codeBase64 = param.Value<string>("ApiV8CodeBase64") ?? param.Value<string>("CodeBase64");
            string code;
            try
            {
                code = DecodeCodeBase64(codeBase64);
                if (string.IsNullOrWhiteSpace(code)) code = param.Value<string>("ApiV8Code");
                if (string.IsNullOrWhiteSpace(code)) code = param.Value<string>("Code");
            }
            catch
            {
                return Ok(new DosResult(0, null, "ApiV8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.UpdateApiEngineCode(
                osClient, apiEngineKey, code,
                param.Value<string>("Version"),
                param.Value<string>("ChangeHistory") ?? param.Value<string>("ChangeSummary"),
                ResolveRequestedV8Limit(param),
                hasCodePayload);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var apiName = param["ApiName"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(apiName)) return Ok(new DosResult(0, null, "ApiName 不能为空"));
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 ApiV8Code
            string code;
            try
            {
                code = DecodeCodeBase64(param.Value<string>("ApiV8CodeBase64") ?? param.Value<string>("CodeBase64"));
                if (string.IsNullOrWhiteSpace(code)) code = param["ApiV8Code"].Val<string>();
                if (string.IsNullOrWhiteSpace(code)) code = param["Code"].Val<string>();
            }
            catch
            {
                return Ok(new DosResult(0, null, "ApiV8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.CreateApiEngine(
                osClient, apiName, apiEngineKey,
                param["ApiAddress"].Val<string>(), param["ApiRemark"].Val<string>(),
                param["Lock"].Val<int>(), param["AllowAnonymous"].Val<int>(),
                param["IsEnable"]?.Val<int>() ?? 1, param["Category"].Val<string>(), code,
                param.Value<string>("Version"),
                param.Value<string>("ChangeHistory") ?? param.Value<string>("ChangeSummary"),
                ResolveRequestedV8Limit(param));
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UploadFileBase64([FromBody] JObject param)
        {
            if (param == null && Request?.Body != null)
            {
                try
                {
                    Request.EnableBuffering();
                    Request.Body.Position = 0;
                    using var reader = new StreamReader(Request.Body, Encoding.UTF8, true, 1024, true);
                    var rawBody = await reader.ReadToEndAsync();
                    if (!rawBody.DosIsNullOrWhiteSpace())
                    {
                        param = JObject.Parse(rawBody);
                    }
                    Request.Body.Position = 0;
                }
                catch
                {
                    return Ok(new DosResult(0, null, "请求体不是有效的 JSON"));
                }
            }
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.UploadFileBase64(
                osClient,
                param["FileName"]?.Val<string>(),
                param["FileByteBase64"]?.Val<string>(),
                param["Path"]?.Val<string>(),
                param["FilePathName"]?.Val<string>(),
                param["Limit"]?.Val<bool>(),
                param["Preview"]?.Val<bool>(),
                param["TargetTable"]?.Val<string>(),
                param["TargetId"]?.Val<string>(),
                param["TargetField"]?.Val<string>(),
                token);
            return Ok(result);
        }

        /// <summary>
        /// 将一个已编译应用资产以 multipart 二进制流直接写入 HDFS 历史版本目录。
        /// 文件体不会进入 JSON、Base64 或 Jint；RequestId 用于跨节点稳定重试，
        /// 稳定入口由完整清单确认接口统一切换。
        /// </summary>
        [HttpPost]
        [Consumes("multipart/form-data")]
        // The publisher performs strict byte[] readback, so one asset is bounded
        // to 128MiB. The 130MiB HTTP envelope leaves room for multipart metadata.
        [RequestSizeLimit(136314880L)]
        [RequestFormLimits(MultipartBodyLengthLimit = 136314880L)]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UploadApplicationAssetStream()
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (!Request.HasFormContentType) return Ok(new DosResult(0, null, "请求必须是 multipart/form-data"));

            try
            {
                var form = await Request.ReadFormAsync(HttpContext.RequestAborted);
                if (form.Files.Count != 1) return Ok(new DosResult(0, null, "每次必须且只能上传一个应用资产文件"));
                var file = form.Files[0];
                var osClient = V8McpLogic.ResolveOsClient(form["OsClient"].ToString(), (object)token);
                if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
                var relativePath = form["RelativePath"].ToString();
                var normalizedFileName = (relativePath ?? string.Empty).Replace('\\', '/');
                var lastSlash = normalizedFileName.LastIndexOf('/');
                if (lastSlash >= 0) normalizedFileName = normalizedFileName.Substring(lastSlash + 1);

                await using var transportStream = file.OpenReadStream();
                Stream stream = transportStream;
                FileStream decodedStream = null;
                var contentEncoding = form["ContentEncoding"].ToString().Trim();
                if (!string.IsNullOrEmpty(contentEncoding)
                    && !string.Equals(contentEncoding, "gzip", StringComparison.OrdinalIgnoreCase))
                {
                    return Ok(new DosResult(0, null, "ContentEncoding 仅支持 gzip"));
                }
                if (string.Equals(contentEncoding, "gzip", StringComparison.OrdinalIgnoreCase))
                {
                    var temporaryPath = Path.Combine(
                        Path.GetTempPath(),
                        "microi-application-asset-" + Guid.NewGuid().ToString("N") + ".tmp");
                    decodedStream = new FileStream(
                        temporaryPath,
                        FileMode.CreateNew,
                        FileAccess.ReadWrite,
                        FileShare.None,
                        81920,
                        FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.DeleteOnClose);
                    try
                    {
                        using var gzip = new GZipStream(transportStream, CompressionMode.Decompress, true);
                        var buffer = new byte[81920];
                        long decodedLength = 0;
                        while (true)
                        {
                            var read = await gzip.ReadAsync(buffer, 0, buffer.Length, HttpContext.RequestAborted);
                            if (read <= 0) break;
                            decodedLength += read;
                            if (decodedLength > V8McpLogic.ApplicationAssetStreamMaxFileBytes)
                            {
                                await decodedStream.DisposeAsync();
                                decodedStream = null;
                                return Ok(new DosResult(0, null,
                                    $"gzip 解压后的应用资产不能超过 {V8McpLogic.ApplicationAssetStreamMaxFileBytes} bytes"));
                            }
                            await decodedStream.WriteAsync(buffer, 0, read, HttpContext.RequestAborted);
                        }
                        await decodedStream.FlushAsync(HttpContext.RequestAborted);
                        decodedStream.Position = 0;
                        stream = decodedStream;
                    }
                    catch
                    {
                        await decodedStream.DisposeAsync();
                        decodedStream = null;
                        throw;
                    }
                }
                var protocolVersion = form["ProtocolVersion"].ToString().Trim();
                DosResult<object> result;
                try
                {
                    if (protocolVersion == "3")
                    {
                        var protocolParam = new JObject();
                        var nullableFields = new HashSet<string>(StringComparer.Ordinal)
                        {
                            "ExpectedAppVersion",
                            "ExpectedVersionRowVersion",
                            "ExpectedActivePublishVersionId",
                            "ExpectedCommittedPublishVersionId"
                        };
                        foreach (var fieldName in new[]
                        {
                            "ProtocolVersion",
                            "PublishMode",
                            "ExpectedGateEpoch",
                            "ExpectedPublishRowVersion",
                            "ExpectedVersionRowVersion",
                            "ExpectedPublishFence",
                            "ExpectedActivePublishVersionId",
                            "ExpectedCommittedPublishVersionId",
                            "ExpectedCurrentVersion",
                            "ExpectedAppVersion",
                            "RequestId",
                            "RequestFingerprint",
                            "DeliveryBatchId",
                            "SourceManifestHash",
                            "RuntimeManifestHash",
                            "RouteSnapshotJson",
                            "RouteSnapshotHash"
                        })
                        {
                            if (!form.ContainsKey(fieldName)) continue;
                            var rawValue = form[fieldName].ToString();
                            if (string.Equals(fieldName, "ExpectedCurrentVersion", StringComparison.Ordinal))
                            {
                                // multipart/form-data has no scalar type information. Keep
                                // the Core v3 contract strict and restore this JSON integer at
                                // the HTTP boundary; all Int64 fencing fields deliberately stay
                                // canonical decimal strings so JavaScript never loses precision.
                                if (!int.TryParse(
                                        rawValue,
                                        NumberStyles.None,
                                        CultureInfo.InvariantCulture,
                                        out var expectedCurrentVersion)
                                    || expectedCurrentVersion < 0)
                                {
                                    return Ok(new DosResult(0, null,
                                        "ExpectedCurrentVersion 必须是规范非负 int 整数"));
                                }
                                protocolParam[fieldName] = expectedCurrentVersion;
                            }
                            else
                            {
                                protocolParam[fieldName] = nullableFields.Contains(fieldName)
                                                           && string.Equals(rawValue, "null", StringComparison.Ordinal)
                                    ? JValue.CreateNull()
                                    : rawValue;
                            }
                        }
                        result = await V8McpLogic.UploadApplicationAssetStreamV3(
                            osClient,
                            form["AppIdOrKey"].ToString(),
                            form["VersionNo"].ToString(),
                            relativePath,
                            form["ExpectedSha256"].ToString(),
                            normalizedFileName,
                            stream,
                            stream.Length,
                            protocolParam,
                            (object)token,
                            HttpContext.RequestAborted);
                    }
                    else
                    {
                        if (!string.IsNullOrEmpty(protocolVersion) && protocolVersion != "2")
                        {
                            return Ok(new DosResult(0, null, "ProtocolVersion 只允许 2 或 3"));
                        }
                        result = await V8McpLogic.UploadApplicationAssetStream(
                            osClient,
                            form["AppIdOrKey"].ToString(),
                            form["VersionNo"].ToString(),
                            relativePath,
                            form["ExpectedSha256"].ToString(),
                            normalizedFileName,
                            stream,
                            stream.Length,
                            form["RequestId"].ToString(),
                            (object)token,
                            HttpContext.RequestAborted);
                    }
                }
                finally
                {
                    if (decodedStream != null) await decodedStream.DisposeAsync();
                }
                return Ok(result);
            }
            catch (OperationCanceledException)
            {
                return Ok(new DosResult(0, null, "应用资产流式上传已取消"));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "应用资产流式上传请求失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 为单个不可变应用资产创建跨节点可恢复的 HDFS 分片上传会话。
        /// 会话、操作者、进度、心跳和错误检查点持久化到 mci_ai_app_file，
        /// 管理员可在 AI 应用文件/大文件上传记录中审计。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> InitiateApplicationAssetMultipart([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            try
            {
                var osClient = V8McpLogic.ResolveOsClient(
                    param["OsClient"]?.Val<string>(),
                    (object)token);
                if (string.IsNullOrWhiteSpace(osClient))
                    return Ok(new DosResult(0, null, "OsClient 不能为空"));
                return Ok(await V8McpLogic.InitiateApplicationAssetMultipart(
                    osClient,
                    param,
                    (object)token,
                    HttpContext.RequestAborted));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "创建断点上传会话失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 回读已持久化的分片、字节进度、心跳、阶段和恢复提示。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApplicationAssetMultipartStatus([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            try
            {
                var osClient = V8McpLogic.ResolveOsClient(
                    param["OsClient"]?.Val<string>(),
                    (object)token);
                if (string.IsNullOrWhiteSpace(osClient))
                    return Ok(new DosResult(0, null, "OsClient 不能为空"));
                return Ok(await V8McpLogic.GetApplicationAssetMultipartStatus(
                    osClient,
                    param,
                    (object)token,
                    HttpContext.RequestAborted));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "读取断点上传会话失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 上传一个原始二进制分片。请求体不会进入 multipart/form-data、JSON、
        /// Base64 或 Jint；服务端按会话协商长度和 SHA-256 流式写入并回读复核。
        /// HTTP 层不设置总文件上限，单块大小由会话协商并受对象存储能力约束。
        /// </summary>
        [HttpPost]
        [Consumes("application/octet-stream")]
        [DisableRequestSizeLimit]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UploadApplicationAssetMultipartPart(
            [FromQuery] string osClient,
            [FromQuery] string sessionId,
            [FromQuery] int partNumber,
            [FromQuery] string expectedPartSha256)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            try
            {
                osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
                if (string.IsNullOrWhiteSpace(osClient))
                    return Ok(new DosResult(0, null, "OsClient 不能为空"));
                if (!Request.ContentLength.HasValue || Request.ContentLength.Value < 0)
                    return Ok(new DosResult(
                        0,
                        null,
                        "断点分片必须提供精确 Content-Length，不能使用未知长度请求体"));
                return Ok(await V8McpLogic.UploadApplicationAssetMultipartPart(
                    osClient,
                    sessionId,
                    partNumber,
                    expectedPartSha256,
                    Request.Body,
                    Request.ContentLength.Value,
                    (object)token,
                    HttpContext.RequestAborted));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "断点分片上传请求失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 以有界内存将临时 HDFS 分片顺序合并到可删除临时文件，再流式写入
        /// 不可变最终对象，并再次
        /// 对最终对象执行全量 SHA-256 回读；可在节点重启后幂等重试。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CompleteApplicationAssetMultipart([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            try
            {
                var osClient = V8McpLogic.ResolveOsClient(
                    param["OsClient"]?.Val<string>(),
                    (object)token);
                if (string.IsNullOrWhiteSpace(osClient))
                    return Ok(new DosResult(0, null, "OsClient 不能为空"));
                return Ok(await V8McpLogic.CompleteApplicationAssetMultipart(
                    osClient,
                    param,
                    (object)token,
                    // Completion is a durable, resumable server-side compose.
                    // A CLI, browser, reverse proxy or MCP transport disconnect
                    // must not cancel verified parts or the final OSS write.
                    // Progress and terminal failure remain persisted in
                    // mci_ai_app_file for polling and administrator audit.
                    System.Threading.CancellationToken.None));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "完成断点上传请求失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 取消未完成会话并清理临时块；审计记录保留，已完成的不可变最终对象
        /// 不允许通过此接口删除。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> AbortApplicationAssetMultipart([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            try
            {
                var osClient = V8McpLogic.ResolveOsClient(
                    param["OsClient"]?.Val<string>(),
                    (object)token);
                if (string.IsNullOrWhiteSpace(osClient))
                    return Ok(new DosResult(0, null, "OsClient 不能为空"));
                return Ok(await V8McpLogic.AbortApplicationAssetMultipart(
                    osClient,
                    param,
                    (object)token,
                    HttpContext.RequestAborted));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "取消断点上传请求失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 校验完整版本清单，并通过 HDFS 服务端复制切换 root/latest 稳定入口。
        /// 请求只包含路径、大小、SHA-256、RequestId 与路由元数据，不包含文件体。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> FinalizeApplicationStreamPublish([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            try
            {
                var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
                if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
                var result = await V8McpLogic.FinalizeApplicationStreamPublish(
                    osClient,
                    param,
                    (object)token,
                    HttpContext.RequestAborted);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "确认应用流式发布失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 以 ExpectedMode/MinProtocol/GateEpoch CAS 原子转换应用流式发布门禁。
        /// 服务端会重算 MCP 规范载荷 SHA-256；只有 literal true 的
        /// ConfirmExecution 与完全一致的 ConfirmationSha256 才允许写入。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> TransitionApplicationStreamGate([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            try
            {
                var osClient = V8McpLogic.ResolveOsClient(
                    param["OsClient"]?.Val<string>(),
                    (object)token);
                return Ok(V8McpLogic.TransitionApplicationStreamGate(
                    osClient,
                    param,
                    (object)token));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "应用流式发布门禁转换请求失败：" + ex.Message));
            }
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetMicroService(string osClient, string msKey, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            msKey = msKey ?? param?["MsKey"].Val<string>() ?? param?["MicroServiceKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            if (string.IsNullOrWhiteSpace(msKey)) return Ok(new DosResult(0, null, "MsKey 不能为空"));
            var result = await V8McpLogic.GetMicroService(osClient, msKey);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListApplications([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            param ??= new JObject();
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.ListApplications(
                osClient,
                param["AppType"]?.Val<string>(),
                param["Keyword"]?.Val<string>() ?? param["_SearchKey"]?.Val<string>(),
                param["IncludeFiles"]?.Val<bool?>() ?? true);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApplicationContext([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.GetApplicationContext(
                osClient,
                param["AppIdOrKey"]?.Val<string>() ?? param["AppId"]?.Val<string>() ?? param["AppKey"]?.Val<string>(),
                param["IncludeContents"]?.Val<bool?>() ?? false,
                param["MaxFileBytes"]?.Val<long?>() ?? 2 * 1024 * 1024,
                param["MaxTotalBytes"]?.Val<long?>() ?? 50 * 1024 * 1024);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApplicationFile([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.GetApplicationFile(
                osClient,
                param["AppIdOrKey"]?.Val<string>() ?? param["AppId"]?.Val<string>() ?? param["AppKey"]?.Val<string>(),
                param["FilePath"]?.Val<string>() ?? param["Path"]?.Val<string>(),
                param["IncludeContents"]?.Val<bool?>() ?? true,
                param["MaxFileBytes"]?.Val<long?>() ?? 10 * 1024 * 1024);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateMicroService([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.CreateMicroService(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SyncMicroServiceSource([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.SyncMicroServiceSource(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> PublishMicroService([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var result = await V8McpLogic.PublishMicroService(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> CheckVersions([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var items = param["Items"]?.ToObject<List<V8McpLogic.VersionCheckItem>>();
            if (items == null || items.Count == 0) return Ok(new DosResult(0, null, "Items 不能为空"));
            var result = await V8McpLogic.CheckVersions(osClient, items);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ExecuteApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            string v8Code;
            try
            {
                v8Code = DecodeCodeBase64(param.Value<string>("V8CodeBase64") ?? param.Value<string>("CodeBase64"));
                if (string.IsNullOrWhiteSpace(v8Code)) v8Code = param["V8Code"].Val<string>();
            }
            catch
            {
                return Ok(new DosResult(0, null, "V8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.ExecuteApiEngine(
                osClient, param["ApiEngineKey"].Val<string>(), v8Code,
                param["Param"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetV8EventList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetV8EventList(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetV8EventCode(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var formEngineKey = param?["FormEngineKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(formEngineKey)) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            var eventType = param?["EventType"].Val<string>();
            if (string.IsNullOrWhiteSpace(eventType)) return Ok(new DosResult(0, null, "EventType 不能为空"));
            var result = await V8McpLogic.GetV8EventCode(osClient, formEngineKey, eventType);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var formEngineKey = param["FormEngineKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(formEngineKey)) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 V8Code
            var code = param["V8Code"].Val<string>() ?? param["Code"].Val<string>();
            var result = await V8McpLogic.UpdateV8EventCode(
                osClient, formEngineKey, param["EventType"].Val<string>(), code);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetWorkflowV8EventList(string? osClient, string? flowDesignId, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>() ?? param?["Id"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetWorkflowV8EventList(osClient, flowDesignId);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetWorkflowV8EventCode(string? osClient, string? flowDesignId, string? nodeId, string? eventType, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>() ?? param?["Id"].Val<string>();
            nodeId = nodeId ?? param?["NodeId"].Val<string>();
            eventType = eventType ?? param?["EventType"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            if (string.IsNullOrWhiteSpace(nodeId)) return Ok(new DosResult(0, null, "NodeId 不能为空"));
            if (string.IsNullOrWhiteSpace(eventType)) return Ok(new DosResult(0, null, "EventType 不能为空"));
            var result = await V8McpLogic.GetWorkflowV8EventCode(osClient, nodeId, eventType, flowDesignId);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateWorkflowV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var flowDesignId = param["FlowDesignId"].Val<string>() ?? param["Id"].Val<string>();
            var nodeId = param["NodeId"].Val<string>();
            var eventType = param["EventType"].Val<string>();
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            if (string.IsNullOrWhiteSpace(nodeId)) return Ok(new DosResult(0, null, "NodeId 不能为空"));
            if (string.IsNullOrWhiteSpace(eventType)) return Ok(new DosResult(0, null, "EventType 不能为空"));
            string code;
            try
            {
                code = DecodeCodeBase64(param.Value<string>("V8CodeBase64") ?? param.Value<string>("CodeBase64"));
                if (string.IsNullOrWhiteSpace(code)) code = param["V8Code"].Val<string>();
                if (string.IsNullOrWhiteSpace(code)) code = param["Code"].Val<string>();
            }
            catch
            {
                return Ok(new DosResult(0, null, "V8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.UpdateWorkflowV8EventCode(osClient, nodeId, eventType, code ?? "", flowDesignId);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> QueryMongodbLogs(string? osClient, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.QueryMongodbLogs(osClient, param ?? new JObject());
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> WriteMongodbLog([FromBody] JObject? param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.WriteMongodbLog(osClient, param ?? new JObject(), token);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ExecuteV8Event([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var v8Code = param["V8Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(v8Code)) return Ok(new DosResult(0, null, "V8Code 不能为空"));
            var result = await V8McpLogic.ExecuteV8Event(
                osClient, param["EventType"].Val<string>(), v8Code,
                param["Form"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetDbSchema(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetDbSchema(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetTableIndexes(
            string osClient,
            string tableName,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(
                osClient ?? param?["OsClient"].Val<string>(), (object)token);
            tableName = tableName ?? param?["TableName"].Val<string>();
            return Ok(V8McpLogic.GetTableIndexes(osClient, tableName));
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> CreateTableIndex([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "请求参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var columns = param["Columns"] is JArray columnArray
                ? columnArray.Values<string>()
                : (param["IndexColumns"].Val<string>() ?? "")
                    .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            return Ok(V8McpLogic.CreateTableIndex(
                osClient,
                param["TableName"].Val<string>(),
                param["IndexName"].Val<string>(),
                columns,
                param["Unique"].Val<bool?>() ?? param["IndexUnique"].Val<bool?>() ?? false));
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> DropTableIndex([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "请求参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            return Ok(V8McpLogic.DropTableIndex(
                osClient,
                param["TableName"].Val<string>(),
                param["IndexName"].Val<string>()));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetSupportedDatabaseTypes()
        {
            var (ok, msg, _) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            return Ok(V8McpLogic.GetSupportedDatabaseTypes());
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> InspectExternalDatabase([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.InspectExternalDatabase(
                osClient,
                param?["DatabaseType"].Val<string>() ?? param?["DbType"].Val<string>(),
                param?["ConnectionString"].Val<string>() ?? param?["DbConn"].Val<string>(),
                param?["DbKey"].Val<string>(),
                param?["TableName"].Val<string>(),
                Math.Max(1, Math.Min(param?["MaxTables"]?.Val<int>() ?? 500, 5000)),
                param?["IncludeColumns"]?.Val<bool?>() ?? true,
                Math.Max(1, Math.Min(param?["CommandTimeoutSeconds"]?.Val<int>() ?? 60, 600)));
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> QueryExternalDatabase([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.QueryExternalDatabase(
                osClient,
                param?["DatabaseType"].Val<string>() ?? param?["DbType"].Val<string>(),
                param?["ConnectionString"].Val<string>() ?? param?["DbConn"].Val<string>(),
                param?["DbKey"].Val<string>(),
                param?["Sql"].Val<string>(),
                param?["Parameters"] as JObject,
                Math.Max(1, Math.Min(param?["MaxRows"]?.Val<int>() ?? 200, 5000)),
                Math.Max(1, Math.Min(param?["CommandTimeoutSeconds"]?.Val<int>() ?? 60, 600)));
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> ExecuteExternalDatabaseSql([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var sql = param["Sql"].Val<string>();
            if (string.IsNullOrWhiteSpace(sql)) return Ok(new DosResult(0, null, "Sql 不能为空"));
            var confirmation = param["ConfirmExecution"].Val<string>();
            var sqlHash = V8McpLogic.GetAdministrativeSqlConfirmation(sql);
            if (confirmation != "EXECUTE" && !string.Equals(confirmation, sqlHash, StringComparison.OrdinalIgnoreCase))
                return Ok(new DosResult(0, new { SqlSha256 = sqlHash }, "ConfirmExecution 必须等于 EXECUTE 或当前 SQL 的 SHA-256"));

            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            return Ok(await V8McpLogic.ExecuteExternalDatabaseSql(
                osClient,
                param["DatabaseType"].Val<string>() ?? param["DbType"].Val<string>(),
                param["ConnectionString"].Val<string>() ?? param["DbConn"].Val<string>(),
                param["DbKey"].Val<string>(),
                sql,
                param["Mode"].Val<string>(),
                param["Parameters"] as JObject,
                Math.Max(1, Math.Min(param["MaxRows"]?.Val<int>() ?? 1000, 100000)),
                Math.Max(1, Math.Min(param["CommandTimeoutSeconds"]?.Val<int>() ?? 600, 86400)),
                token));
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveDatabaseConnection([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var dbKey = param?["DbKey"].Val<string>();
            var confirmation = param?["ConfirmExecution"].Val<string>();
            if (confirmation != dbKey && confirmation != "EXECUTE")
                return Ok(new DosResult(0, null, "ConfirmExecution 必须等于 DbKey 或 EXECUTE"));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            return Ok(await V8McpLogic.SaveDatabaseConnection(osClient, param, token));
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> ImportExternalAttachment([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var sourceUrl = param?["SourceUrl"].Val<string>();
            var sourcePath = param?["SourcePath"].Val<string>();
            var source = string.IsNullOrWhiteSpace(sourceUrl) ? sourcePath : sourceUrl;
            var confirmation = param?["ConfirmExecution"].Val<string>();
            var sourceHash = V8McpLogic.GetAdministrativeSqlConfirmation(source ?? string.Empty);
            if (confirmation != source && confirmation != "EXECUTE"
                && !string.Equals(confirmation, sourceHash, StringComparison.OrdinalIgnoreCase))
                return Ok(new DosResult(0, new { SourceSha256 = sourceHash },
                    "ConfirmExecution 必须等于源地址、EXECUTE 或当前源地址的 SHA-256"));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            return Ok(await V8McpLogic.ImportExternalAttachmentAdministrative(osClient, param, token));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> GetPlaywrightContext(string osClient, string keyword, int? pageSize, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            keyword = keyword ?? param?["Keyword"].Val<string>();
            var resolvedPageSize = pageSize ?? 5000;
            var pageSizeToken = param?["PageSize"];
            if (pageSizeToken != null && int.TryParse(pageSizeToken.ToString(), out var bodyPageSize)) resolvedPageSize = bodyPageSize;
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var apiBaseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}".TrimEnd('/');
            var result = await V8McpLogic.GetPlaywrightContext(osClient, keyword, apiBaseUrl, resolvedPageSize);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateTable([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var name = param["Name"].Val<string>();
            if (string.IsNullOrWhiteSpace(name)) return Ok(new DosResult(0, null, "Name 不能为空"));
            var result = await V8McpLogic.CreateTable(osClient, name, param["Description"].Val<string>(),
                param["Tabs"].Val<string>(), param["IsTree"]?.Val<int>() ?? 0,
                param["Column"]?.Val<int>() ?? 1, param["FormOpenType"].Val<string>(),
                param["FormOpenWidth"].Val<string>(), param["V8Unlimited"]?.Val<int?>());
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> AddField([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var tableId = param["TableId"].Val<string>();
            var name = param["Name"].Val<string>();
            var label = param["Label"].Val<string>();
            if (string.IsNullOrWhiteSpace(tableId)) return Ok(new DosResult(0, null, "TableId 不能为空"));
            if (string.IsNullOrWhiteSpace(name)) return Ok(new DosResult(0, null, "Name 不能为空"));
            if (string.IsNullOrWhiteSpace(label)) return Ok(new DosResult(0, null, "Label 不能为空"));
            var result = await V8McpLogic.AddField(
                osClient, tableId, name, label,
                param["Type"].Val<string>(), param["Component"].Val<string>(),
                IntOrDefault(param, "Visible", 1), IntOrDefault(param, "AppVisible", 1),
                param["Tab"].Val<string>(), param["TableWidth"]?.Val<int>() ?? 0,
                param["Sort"]?.Val<int>() ?? 100, param["NameConfirm"]?.Val<int>() ?? 0,
                param["Readonly"]?.Val<int>() ?? 0,
                param["NotEmpty"]?.Val<int>() ?? 0, param["Unique"]?.Val<int>() ?? 0,
                param["DefaultValue"].Val<string>(), param["Placeholder"].Val<string>(),
                param["FormWidth"]?.Val<int?>(), param["Data"].Val<string>(),
                param["Config"].Val<string>(), param["Description"].Val<string>(),
                param["Encrypt"]?.Val<int>() ?? 0, param["InTableEdit"]?.Val<int>() ?? 0);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var name = param["Name"].Val<string>();
            if (string.IsNullOrWhiteSpace(name)) return Ok(new DosResult(0, null, "Name 不能为空"));
            if (param["DiyConfig"] != null)
            {
                return Ok(new DosResult(0, null,
                    "DiyConfig 已废弃；请新增专用物理字段，并通过 diy_field 元数据暴露配置控件。跨端视图请使用 sys_menu.ViewSchema。"));
            }
            var result = await V8McpLogic.CreateModule(
                osClient, name,
                param["DiyTableId"].Val<string>(),
                param["ComponentName"].Val<string>(), param["ComponentPath"].Val<string>(),
                IntOrDefault(param, "Display", 1), IntOrDefault(param, "AppDisplay", 1),
                IntOrDefault(param, "HasChild", 0),
                param["OpenType"].Val<string>(), param["Url"].Val<string>(),
                param["ParentId"].Val<string>(), param["Sort"]?.Val<int>() ?? 100,
                param["Icon"].Val<string>(), param["SearchFieldIds"].Val<string>(),
                param["TableDiyFieldIds"].Val<string>(), param["DefaultOrderBy"].Val<string>(),
                param["SqlWhere"].Val<string>(),
                param["MoreBtns"].Val<string>(), param["FormBtns"].Val<string>(),
                param["BatchSelectMoreBtns"].Val<string>(), param["PageTabs"].Val<string>(),
                param["ExportMoreBtns"].Val<string>(), param["PageBtns"].Val<string>(),
                param["SortFieldIds"].Val<string>(), param["NotShowFields"].Val<string>(),
                param["SqlJoin"].Val<string>(), param["JoinTables"].Val<string>(),
                param["SelectFields"].Val<string>(), param["StatisticsFields"].Val<string>(),
                param["InTableEdit"]?.Val<int>() ?? 0, param["InTableEditFields"].Val<string>(),
                param["MobileListFields"].Val<string>(),
                param["CardTitleTagFields"].Val<string>(), param["CardBottomTagFields"].Val<string>(),
                param["MenuBadgeEnabled"]?.Val<int>() ?? 0,
                param["MenuBadgeApiEngineKey"].Val<string>(),
                param["EnableViewSchema"]?.Val<int>() ?? 0,
                param["ViewSchemaVersion"].Val<string>() ?? "1.0",
                param["ViewConfigVersion"]?.Val<int>() ?? 1,
                StringOrCompactJson(param["ViewSchema"]),
                param["IsMicroiService"]?.Val<int>() ?? 0,
                param["MicroServiceId"].Val<string>(),
                param["MicroServicePageId"].Val<string>(),
                param["MicroServiceRoutePath"].Val<string>(),
                param["MicroServiceKey"].Val<string>());
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> DebugSession(string action, string sessionId, [FromBody] JObject param = null)
        {
            var (ok, msg, _) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            action = action ?? param?["Action"].Val<string>();
            sessionId = sessionId ?? param?["SessionId"].Val<string>();

            switch (action?.ToLower())
            {
                case "create":
                    return Ok(new DosResult(1, new
                    {
                        SessionId = Guid.NewGuid().ToString("N"),
                        WebSocketUrl = "/diy-websocket",
                        Message = "调试会话已创建，请通过 SignalR 连接 /diy-websocket 进行调试"
                    }));
                case "status":
                    if (string.IsNullOrWhiteSpace(sessionId)) return Ok(new DosResult(0, null, "SessionId 不能为空"));
                    return Ok(new DosResult(1, new
                    {
                        SessionId = sessionId,
                        Status = "active",
                        ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }));
                default:
                    return Ok(new DosResult(0, null, "无效的 action 参数，支持: create, status"));
            }
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SetRolePermission([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var roleId = param["RoleId"].Val<string>();
            var menuIds = param["MenuIds"]?.ToObject<List<string>>();
            if (string.IsNullOrWhiteSpace(roleId)) return Ok(new DosResult(0, null, "RoleId 不能为空"));
            if (menuIds == null || menuIds.Count == 0) return Ok(new DosResult(0, null, "MenuIds 不能为空"));
            var result = await V8McpLogic.SetRolePermission(osClient, roleId, menuIds);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListRoles(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListRoles(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveRole([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveRole(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListModules(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListModules(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetModule(string osClient, string moduleId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            moduleId = moduleId ?? param?["ModuleId"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(moduleId)) return Ok(new DosResult(0, null, "ModuleId 不能为空"));
            var result = await V8McpLogic.GetModule(osClient, moduleId);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var moduleId = param["ModuleId"].Val<string>() ?? param["Id"].Val<string>();
            if (string.IsNullOrWhiteSpace(moduleId)) return Ok(new DosResult(0, null, "ModuleId 不能为空"));
            var result = await V8McpLogic.UpdateModule(osClient, moduleId, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListDataSources(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListDataSources(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveDataSource([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveDataSource(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListPrintTemplates(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListPrintTemplates(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SavePrintTemplate([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SavePrintTemplate(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveWorkflowPackage([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveWorkflowPackage(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveJob([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveJob(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> ListDatabaseBackupTenants(
            string osClient,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(
                osClient ?? param?["OsClient"]?.Val<string>(),
                (object)token);
            var currentUser = JObject.FromObject((object)token.CurrentUser);
            return Ok(V8McpLogic.ListDatabaseBackupTenants(osClient, currentUser));
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> RunDatabaseBackup([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            if (!string.Equals(param["ConfirmExecution"]?.ToString(), "DATABASE_BACKUP",
                    StringComparison.Ordinal))
            {
                return Ok(new DosResult(0, null,
                    "执行已拦截：ConfirmExecution 必须为 DATABASE_BACKUP。"));
            }
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var currentUser = JObject.FromObject((object)token.CurrentUser);
            return Ok(V8McpLogic.RunDatabaseBackup(osClient, currentUser, param));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> GetDatabaseBackupSettings(
            string osClient,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(
                osClient ?? param?["OsClient"]?.Val<string>(),
                (object)token);
            var currentUser = JObject.FromObject((object)token.CurrentUser);
            try
            {
                return Ok(await V8McpLogic.GetDatabaseBackupSettings(osClient, currentUser));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "读取数据库备份设置失败：" + ex.Message));
            }
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveDatabaseBackupSettings([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"]?.Val<string>(), (object)token);
            var currentUser = JObject.FromObject((object)token.CurrentUser);
            try
            {
                return Ok(await V8McpLogic.SaveDatabaseBackupSettings(osClient, currentUser, param));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "保存数据库备份设置失败：" + ex.Message));
            }
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ValidateLowCodeSystem([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.ValidateLowCodeSystem(osClient, param["Manifest"] as JObject ?? param);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> WriteMcpAuditLog([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.WriteMcpAuditLog(osClient,
                param["Action"].Val<string>(), param["Target"].Val<string>(), param["Content"].Val<string>(), token);
            return Ok(result);
        }

        #region 界面引擎（Page Engine）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetPageEngineList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var keyword = param?["Keyword"].Val<string>();
            var result = await V8McpLogic.GetPageEngineList(osClient, keyword);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetPageEngineDetail(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var pageId = param?["PageId"].Val<string>();
            if (string.IsNullOrWhiteSpace(pageId)) return Ok(new DosResult(0, null, "PageId 不能为空"));
            var result = await V8McpLogic.GetPageEngineDetail(osClient, pageId);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SavePageEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var title = param["Title"].Val<string>();
            if (string.IsNullOrWhiteSpace(title)) return Ok(new DosResult(0, null, "Title 不能为空"));
            var jsonStr = param["JsonStr"].Val<string>();
            if (string.IsNullOrWhiteSpace(jsonStr)) return Ok(new DosResult(0, null, "JsonStr 不能为空"));
            var result = await V8McpLogic.SavePageEngineVersioned(
                osClient, param["PageId"].Val<string>(), title,
                param["Number"].Val<string>(), param["Desc"].Val<string>(), jsonStr,
                param["RoutePath"].Val<string>(), param["ComponentPath"].Val<string>(),
                param["ExpectedCurrentHash"].Val<string>(), param["ChangeSummary"].Val<string>(),
                (object)token);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListPageEngineHistory(
            string osClient, string pageId, int pageIndex = 1, int pageSize = 50,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            pageId = pageId ?? param?["PageId"].Val<string>();
            pageIndex = param?["PageIndex"].Val<int?>() ?? pageIndex;
            pageSize = param?["PageSize"].Val<int?>() ?? pageSize;
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            return Ok(await V8McpLogic.ListPageEngineHistory(osClient, pageId, pageIndex, pageSize));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetPageEngineHistory(
            string osClient, string pageId, string historyId,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            pageId = pageId ?? param?["PageId"].Val<string>();
            historyId = historyId ?? param?["HistoryId"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            return Ok(await V8McpLogic.GetPageEngineHistory(osClient, pageId, historyId));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ComparePageEngineVersions(
            string osClient, string pageId, string leftHistoryId, string rightHistoryId,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            pageId = pageId ?? param?["PageId"].Val<string>();
            leftHistoryId = leftHistoryId ?? param?["LeftHistoryId"].Val<string>();
            rightHistoryId = rightHistoryId ?? param?["RightHistoryId"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            return Ok(await V8McpLogic.ComparePageEngineVersions(osClient, pageId, leftHistoryId, rightHistoryId));
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ExportPageEngine(
            string osClient, string pageId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            pageId = pageId ?? param?["PageId"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            return Ok(await V8McpLogic.ExportPageEngine(osClient, pageId));
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> RollbackPageEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            return Ok(await V8McpLogic.RollbackPageEngine(osClient, param, (object)token));
        }

        #endregion

        #region MCP 扩展（字段/表/缓存/匿名）

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateField([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateField(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateFieldList([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateFieldList(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFieldList(string? osClient, string? tableId, string? tableName = null, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            tableId = tableId ?? param?["TableId"].Val<string>();
            tableName = tableName ?? param?["TableName"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetFieldList(osClient, tableId, tableName);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateTable([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateTable(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> RefreshSchemaCache([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var arr = (param["Tables"] as JArray) ?? (param["TableNames"] as JArray);
            var list = arr?.ToObject<List<string>>() ?? new List<string>();
            var result = await V8McpLogic.RefreshSchemaCache(osClient, list);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SetEngineAnonymous([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var arr = (param["ApiEngineKeys"] as JArray);
            var list = arr?.ToObject<List<string>>() ?? new List<string>();
            var allow = param["AllowAnonymous"]?.Val<int>() ?? 1;
            var result = await V8McpLogic.SetEngineAnonymous(osClient, list, allow);
            return Ok(result);
        }

        #endregion

        #region 业务架构蓝图（System Blueprint）

        /// <summary>
        /// 列出当前 OsClient 的所有业务蓝图（不含 BlueprintData）
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListBlueprints(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var keyword = param?["Keyword"].Val<string>();
            var result = await V8McpLogic.ListBlueprints(osClient, keyword);
            return Ok(result);
        }

        /// <summary>
        /// 获取单个蓝图详情（含 BlueprintData JSON 全文）
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetBlueprint(string osClient, string blueprintId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            var result = await V8McpLogic.GetBlueprint(osClient, blueprintId);
            return Ok(result);
        }

        /// <summary>
        /// 分页读取蓝图历史元数据。列表不返回 BlueprintData 全文，只返回内容长度和稳定 Hash。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListBlueprintHistory(
            string osClient,
            string blueprintId,
            int pageIndex = 1,
            int pageSize = 50,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            pageIndex = param?["PageIndex"]?.Val<int>() ?? pageIndex;
            pageSize = param?["PageSize"]?.Val<int>() ?? pageSize;
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            return Ok(await V8McpLogic.ListBlueprintHistory(osClient, blueprintId, pageIndex, pageSize));
        }

        /// <summary>
        /// 读取一条蓝图历史快照全文。HistoryId 必须属于指定蓝图和当前租户。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetBlueprintHistory(
            string osClient,
            string blueprintId,
            string historyId,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            historyId = historyId ?? param?["HistoryId"].Val<string>();
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            if (string.IsNullOrWhiteSpace(historyId)) return Ok(new DosResult(0, null, "HistoryId 不能为空"));
            return Ok(await V8McpLogic.GetBlueprintHistory(osClient, blueprintId, historyId));
        }

        /// <summary>
        /// 对蓝图历史做语义 JSON 差异比较。RightHistoryId 为空时与当前草稿比较；
        /// LeftHistoryId 为空时自动使用最近一条历史。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> CompareBlueprintVersions(
            string osClient,
            string blueprintId,
            string leftHistoryId,
            string rightHistoryId,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            leftHistoryId = leftHistoryId ?? param?["LeftHistoryId"].Val<string>();
            rightHistoryId = rightHistoryId ?? param?["RightHistoryId"].Val<string>();
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            return Ok(await V8McpLogic.CompareBlueprintVersions(osClient, blueprintId, leftHistoryId, rightHistoryId));
        }

        /// <summary>
        /// 导出当前蓝图为带 Schema 与稳定内容哈希的可移植 JSON 设计包。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ExportBlueprint(
            string osClient,
            string blueprintId,
            [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            return Ok(await V8McpLogic.ExportBlueprint(osClient, blueprintId));
        }

        /// <summary>
        /// 创建或更新蓝图。规则：
        ///   - 传 Id 命中 → Update；否则按 Name 命中 → Update；否则 Create
        ///   - 自动写入历史快照（sys_blueprint_history）
        ///   - 自动重建反向引用索引（sys_blueprint_relation）
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveBlueprint([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.SaveBlueprint(osClient, param, token);
            return Ok(result);
        }

        /// <summary>
        /// 删除蓝图（软删除主表 + 同步删反向索引；保留历史快照用于回溯）
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> DeleteBlueprint([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var blueprintId = param["BlueprintId"].Val<string>() ?? param["Id"].Val<string>();
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            var result = await V8McpLogic.DeleteBlueprint(osClient, blueprintId);
            return Ok(result);
        }

        /// <summary>
        /// 按历史快照回滚蓝图。历史本身不可修改；回滚前自动保存当前快照。
        /// ExpectedCurrentHash 用于阻止多节点或多人并发覆盖。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> RollbackBlueprint([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            return Ok(await V8McpLogic.RollbackBlueprint(osClient, param, token));
        }

        /// <summary>
        /// 验证蓝图引用的所有平台资源是否存在（漂移检测）。
        /// 返回 errors/warnings/CheckedRefs 统计，AI 据此决定是否需先修复蓝图再生成代码。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ValidateBlueprint(string osClient, string blueprintId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            var result = await V8McpLogic.ValidateBlueprint(osClient, blueprintId);
            return Ok(result);
        }

        #endregion

        #region 状态机（State Machine）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListStateMachines(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var keyword = param?["Keyword"].Val<string>();
            var result = await V8McpLogic.ListStateMachines(osClient, keyword);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetStateMachine(string osClient, string id, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            id = id ?? param?["Id"].Val<string>() ?? param?["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.GetStateMachine(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveStateMachine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.SaveStateMachine(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> DeleteStateMachine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var id = param["Id"].Val<string>() ?? param["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.DeleteStateMachine(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> TransitionState([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.TransitionState(osClient, param, token);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetStateHistory(string osClient, string tableName, string rowId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            tableName = tableName ?? param?["TableName"].Val<string>();
            rowId = rowId ?? param?["RowId"].Val<string>();
            var result = await V8McpLogic.GetStateHistory(osClient, tableName, rowId);
            return Ok(result);
        }

        #endregion

        #region 自动化流（Flow Engine）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListFlows(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.ListFlows(osClient, param?["Keyword"].Val<string>(), param?["TriggerType"].Val<string>());
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFlow(string osClient, string id, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            id = id ?? param?["Id"].Val<string>() ?? param?["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.GetFlow(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveFlow([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.SaveFlow(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> DeleteFlow([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var id = param["Id"].Val<string>() ?? param["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.DeleteFlow(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> RunFlow([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var id = param["Id"].Val<string>() ?? param["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var input = param["Input"] as JObject ?? new JObject();
            var result = await V8McpLogic.RunFlow(osClient, id, input, token);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFlowRuns(string osClient, string flowId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowId = flowId ?? param?["FlowId"].Val<string>() ?? param?["Code"].Val<string>();
            var pageSize = param?["PageSize"].Val<int>() ?? 50;
            var result = await V8McpLogic.GetFlowRuns(osClient, flowId, pageSize);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFlowRunDetail(string osClient, string runId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            runId = runId ?? param?["RunId"].Val<string>();
            if (string.IsNullOrWhiteSpace(runId)) return Ok(new DosResult(0, null, "RunId 不能为空"));
            var result = await V8McpLogic.GetFlowRunDetail(osClient, runId);
            return Ok(result);
        }

        #endregion

        #region 流程挖掘（Process Mining）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> AnalyzeWorkflow(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var fromDate = param?["FromDate"].Val<string>();
            var toDate = param?["ToDate"].Val<string>();
            var result = await V8McpLogic.AnalyzeWorkflow(osClient, flowDesignId, fromDate, toDate);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetHotPaths(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var topN = param?["TopN"].Val<int>() ?? 20;
            var result = await V8McpLogic.GetHotPaths(osClient, flowDesignId, topN);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetSlaViolations(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var slaMinutes = param?["SlaMinutes"].Val<int>() ?? 60;
            var topN = param?["TopN"].Val<int>() ?? 100;
            var result = await V8McpLogic.GetSlaViolations(osClient, flowDesignId, slaMinutes, topN);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetBottlenecks(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var topN = param?["TopN"].Val<int>() ?? 5;
            var result = await V8McpLogic.GetBottlenecks(osClient, flowDesignId, topN);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetWorkflowOverview(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var result = await V8McpLogic.GetWorkflowOverview(osClient, flowDesignId);
            return Ok(result);
        }

        #endregion
    }
}
