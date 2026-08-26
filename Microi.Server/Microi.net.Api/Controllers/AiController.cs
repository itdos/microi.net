using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// ASP.NET Core 原生流式、支付回调、媒体密钥与 OpenAI 协议适配器；普通 JSON 业务兼容路由已统一并入 LegacyMobileCompatibilityController。
namespace Microi.net.Api
{
    /// <summary>
    /// AI 原生协议网关。这里只保留 SSE、支付验签、供应商密钥隔离与
    /// OpenAI/MiniMax 原始协议；可由 V8 编排的 JSON 动作不得在此新增。
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class AiController : Controller
    {
        private readonly IMicroiAI _microiAi;
        private readonly SubscriptionService _subService;
        private readonly AiProxyService _proxyService;
        private const string AiPlatformAccountEngineKey = "platform-ai-account";

        public AiController(
            IMicroiAI microiAi,
            SubscriptionService subService,
            AiProxyService proxyService)
        {
            _microiAi = microiAi;
            _subService = subService;
            _proxyService = proxyService;
        }

        /// <summary>
        /// 从 CurrentToken 获取当前用户信息
        /// </summary>
        private async Task<(string UserId, string UserName)> GetCurrentUserAsync()
        {
            var context = await GetCurrentUserContextAsync();
            return (context.UserId, context.UserName);
        }

        private async Task<(string UserId, string UserName, string OsClient)> GetCurrentUserContextAsync()
        {
            var token = await DiyToken.GetCurrentToken();
            // Tenant identity is an authenticated server-side claim.  Never let
            // an OsClient header, query string or request body override it.
            var osClient = token?.OsClient ?? "";
            if (token?.CurrentUser == null) return (null, null, osClient);
            var userId = token.CurrentUser["Id"]?.ToString();
            var userName = token.CurrentUser["Name"]?.ToString() ?? token.CurrentUser["Account"]?.ToString() ?? "";
            return (userId, userName, osClient);
        }

        private async Task EnrichCurrentUserAsync(AiParam param)
        {
            if (param == null)
            {
                return;
            }
            var (userId, userName, osClient) = await GetCurrentUserContextAsync();
            param.CurrentUserId = userId;
            param.CurrentUserName = userName;
            param.OsClient = osClient;
            // Runtime credentials and endpoints are resolved inside the
            // AI domain module, never from untrusted client input.
            param.ApiKey = null;
            param.Endpoint = null;
            param.ServerInternalCall = false;
            param.Source = "http-ai";
        }

        /// <summary>
        /// Returns the current tenant's ordinary business tables for the role-policy
        /// editor. The AI domain service remains the authority for tenant and
        /// protected-table filtering.
        /// </summary>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> GetNl2SqlPolicyTableOptions()
        {
            var context = await GetCurrentUserContextAsync();
            var result =
                await _microiAi.GetNl2SqlPolicyTableOptionsAsync(
                    context.OsClient);
            return Json(result);
        }

        // ============================================================
        // region: AI 对话 / NL2SQL / NL2V8Engine（原有功能）
        // ============================================================

        /// <summary>
        /// AI对话（SSE流式输出）
        /// </summary>
        [HttpPost, HttpGet]
        public async Task ChatStream(
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] AiParam bodyParam,
            [FromQuery] string UserChatMsg = null,
            [FromQuery] string SystemChatMsg = null,
            [FromQuery] string AiModel = null,
            [FromQuery] string AiModelId = null,
            [FromQuery] string ReasoningEffort = null,
            [FromQuery] string OsClient = null)
        {
            var param = bodyParam ?? new AiParam();
            if (!string.IsNullOrWhiteSpace(UserChatMsg)) param.UserChatMsg = UserChatMsg;
            if (!string.IsNullOrWhiteSpace(SystemChatMsg)) param.SystemChatMsg = SystemChatMsg;
            if (!string.IsNullOrWhiteSpace(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrWhiteSpace(AiModelId)) param.AiModelId = AiModelId;
            if (!string.IsNullOrWhiteSpace(ReasoningEffort)) param.ReasoningEffort = ReasoningEffort;
            if (!string.IsNullOrWhiteSpace(OsClient)) param.OsClient = OsClient;
            await EnrichCurrentUserAsync(param);

            Response.ContentType = "text/event-stream; charset=utf-8";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no";

            try
            {
                var result =
                    await _microiAi.ChatStreamWithContextAsync(
                        param,
                        chunk => WriteSseEventAsync(
                            "message",
                            chunk));

                if (result.Code == 1 && result.Data != null)
                {
                    await WriteSseEventAsync("result", JsonConvert.SerializeObject(result.Data));
                }
                else if (result.Code != 1)
                {
                    await WriteSseEventAsync("error", result.Msg ?? "AI 对话失败");
                }
                await WriteSseEventAsync("done", "[DONE]");
            }
            catch (Exception ex)
            {
                try
                {
                    await WriteSseEventAsync("error", $"服务异常：{ex.Message}");
                    await WriteSseEventAsync("done", "[DONE]");
                }
                catch { }
            }
        }

        /// <summary>
        /// 自然语言转V8引擎代码（SSE流式输出）
        /// </summary>
        [HttpPost, HttpGet]
        [PlatformAdminOnly]
        public async Task NL2V8Engine([FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] NL2V8Param bodyParam, [FromQuery] string Question = null, [FromQuery] string AiModel = null, [FromQuery] string ReasoningEffort = null, [FromQuery] string OsClient = null)
        {
            var param = bodyParam ?? new NL2V8Param();
            if (!string.IsNullOrEmpty(Question)) param.Question = Question;
            if (!string.IsNullOrEmpty(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrEmpty(ReasoningEffort)) param.ReasoningEffort = ReasoningEffort;
            var currentContext = await GetCurrentUserContextAsync();
            param.OsClient = currentContext.OsClient;

            Response.ContentType = "text/event-stream; charset=utf-8";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no";

            try
            {
                if (string.IsNullOrWhiteSpace(param.Question))
                {
                    await WriteSseEventAsync("error", "请输入您的需求描述！");
                    await WriteSseEventAsync("done", "[DONE]");
                    return;
                }
                if (string.IsNullOrWhiteSpace(param.AiModel))
                {
                    await WriteSseEventAsync("error", "AiModel不能为空！");
                    await WriteSseEventAsync("done", "[DONE]");
                    return;
                }

                Func<string, Task> onChunkReceived = async (chunk) =>
                {
                    await WriteSseEventAsync("message", chunk);
                };

                var result = await _microiAi.NL2V8Engine(param, onChunkReceived);

                if (result.Code == 1 && result.Data != null)
                {
                    var resultJson = JsonConvert.SerializeObject(result.Data);
                    await WriteSseEventAsync("result", resultJson);
                }
                else if (result.Code != 1 || (result.Data == null && !string.IsNullOrEmpty(result.Msg)))
                {
                    // Code!=1 明确失败，或 Code=1 但无数据且有提示信息（如License限制）
                    await WriteSseEventAsync("error", result.Msg ?? "生成失败");
                }

                await WriteSseEventAsync("done", "[DONE]");
            }
            catch (Exception ex)
            {
                try
                {
                    await WriteSseEventAsync("error", $"服务异常：{ex.Message}");
                    await WriteSseEventAsync("done", "[DONE]");
                }
                catch { }
            }
        }

        // ============================================================
        // region: AI 订阅管理
        // ============================================================

        /// <summary>
        /// 支付宝异步回调通知
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/Ai/SubAlipayNotify--OsClient--{routeOsClient}--")]
        [AllowAnonymous]
        public async Task<ContentResult> SubAlipayNotify(
            string routeOsClient = null,
            [FromQuery(Name = "OsClient")] string queryOsClient = null)
        {
            string trustedOsClient = null;
            try
            {
                if (!TryResolveAlipayCallbackTenant(
                        routeOsClient,
                        queryOsClient,
                        out trustedOsClient))
                {
                    return Content("fail");
                }

                var form = await Request.ReadFormAsync();
                var signParams = new Dictionary<string, string>();
                foreach (var key in form.Keys)
                {
                    signParams[key] = form[key];
                }

                var verified = await _subService.VerifyAlipayNotifyForTenant(
                    signParams,
                    trustedOsClient);
                if (verified.Code != 1 || verified.Data == null)
                {
                    return Content("fail");
                }

                var trustedRequest = JObject.FromObject(verified.Data);
                trustedRequest["Action"] = "CompletePayment";
                var result = await ManagedApiEngineCompatibility.RunTrustedProtocolAsync(
                    AiPlatformAccountEngineKey,
                    trustedOsClient,
                    trustedRequest);
                return Content(
                    IsSuccessfulDosResult(result)
                        ? "success"
                        : "fail");
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    trustedOsClient ?? OsClientDefault.OsClient,
                    "AI",
                    "SubscriptionPaymentCallbackFailed",
                    "AI 订阅支付回调处理异常",
                    ex.GetType().Name,
                    2);
                return Content("fail");
            }
        }

        internal static bool TryResolveAlipayCallbackTenant(
            string routeOsClient,
            string queryOsClient,
            out string trustedOsClient)
        {
            trustedOsClient = null;
            try
            {
                var routeTenant = string.IsNullOrWhiteSpace(routeOsClient)
                    ? null
                    : TenantConfigurationSecurity.NormalizeTenantId(routeOsClient);
                var queryTenant = string.IsNullOrWhiteSpace(queryOsClient)
                    ? null
                    : TenantConfigurationSecurity.NormalizeTenantId(queryOsClient);
                if (!string.IsNullOrWhiteSpace(routeTenant)
                    && !string.IsNullOrWhiteSpace(queryTenant)
                    && !string.Equals(
                        routeTenant,
                        queryTenant,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                var selected = routeTenant ?? queryTenant;
                if (string.IsNullOrWhiteSpace(selected))
                {
                    // 兼容历史单租户 NotifyUrl；回退值来自节点可信配置，绝不读取
                    // 支付宝表单或可伪造 Header 中的租户。
                    selected = TenantConfigurationSecurity.NormalizeTenantId(
                        OsClient.GetConfigOsClient());
                }
                trustedOsClient = selected;
                return !string.IsNullOrWhiteSpace(trustedOsClient);
            }
            catch
            {
                trustedOsClient = null;
                return false;
            }
        }

        private static bool IsSuccessfulDosResult(object value)
        {
            if (value == null) return false;
            try
            {
                return JObject.FromObject(value).Value<int?>("Code") == 1;
            }
            catch
            {
                return false;
            }
        }

        // ============================================================
        // region: AI 代理转发（需要登录Token鉴权）
        // ============================================================

        /// <summary>
        /// SSE 流式代理对话 —— 前端 OpenClaw 客户端使用
        /// POST /api/Ai/ProxyChatStream
        /// Body: { "model": "MiniMax-M2.7-highspeed", "messages": [...], "stream": true }
        /// </summary>
        [HttpPost]
        public async Task ProxyChatStream()
        {
            var (userId, _) = await GetCurrentUserAsync();
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }
            Response.ContentType = "text/event-stream; charset=utf-8";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no";

            var result =
                await _proxyService.ExecuteAuthenticatedStreamAsync(
                    userId,
                    rawBody,
                    Response.Body,
                    HttpContext.RequestAborted);
            if (!result.ResponseWritten
                && !string.IsNullOrWhiteSpace(
                    result.ErrorMessage))
            {
                await WriteSseDataAsync(
                    AiProxyService.MakeOpenAIError(
                        result.ErrorMessage,
                        result.ErrorType,
                        result.ErrorCode));
                await WriteSseDoneAsync();
            }
        }

        /// <summary>
        /// 非流式代理对话
        /// POST /api/Ai/ProxyChat
        /// Body: { "model": "MiniMax-M2.7-highspeed", "messages": [...] }
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> ProxyChat()
        {
            var (userId, _) = await GetCurrentUserAsync();
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }
            return Json(
                await _proxyService.ExecuteAuthenticatedAsync(
                    userId,
                    rawBody));
        }

        /// <summary>
        /// 对话图片生成。MiniMax-M3 负责语义路由，image-01 负责图片输出；
        /// 供应商 Key 与 Base64 不离开后端，结果先持久化到当前租户 HDFS。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GenerateMiniMaxImage([FromBody] MiniMaxImageGenerateParam param)
        {
            var token = await DiyToken.GetCurrentToken();
            var currentUser = token?.CurrentUser == null ? null : JObject.FromObject(token.CurrentUser);
            return Json(await _proxyService.GenerateAuthenticatedImageAsync(
                currentUser?["Id"]?.ToString(),
                token?.OsClient ?? string.Empty,
                currentUser,
                param,
                HttpContext.RequestAborted));
        }

        /// <summary>
        /// 从 MiniMax 官方接口实时读取当前服务端订阅 Key 的脱敏 Token Plan 用量。
        /// </summary>
        [HttpGet]
        [PlatformAdminOnly]
        public async Task<JsonResult> GetMiniMaxTokenPlanRemains()
        {
            var token = await DiyToken.GetCurrentToken();
            var currentUser = token?.CurrentUser == null
                ? null
                : JObject.FromObject(token.CurrentUser);
            return Json(await _proxyService.GetMiniMaxTokenPlanRemainsAsync(
                currentUser?["Id"]?.ToString(),
                token?.OsClient ?? string.Empty,
                currentUser,
                HttpContext.RequestAborted));
        }

        /// <summary>
        /// 生成 MiniMax 无人声纯音乐并直接写入当前租户 HDFS。供应商 Key、
        /// 临时响应和音频十六进制数据不会返回浏览器。
        /// </summary>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> GenerateMiniMaxMusic([FromBody] MiniMaxMusicGenerateParam param)
        {
            var token = await DiyToken.GetCurrentToken();
            var currentUser = token?.CurrentUser == null ? null : JObject.FromObject(token.CurrentUser);
            return Json(await _proxyService.GenerateAuthenticatedMusicAsync(
                currentUser?["Id"]?.ToString(),
                token?.OsClient ?? string.Empty,
                currentUser,
                param,
                HttpContext.RequestAborted));
        }

        /// <summary>
        /// 生成 MiniMax 固定男女系统音色的短对白并直接写入当前租户 HDFS。
        /// 文本、音色和音频规格均由白名单约束，供应商 Key 不返回浏览器。
        /// </summary>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> GenerateMiniMaxSpeech([FromBody] MiniMaxSpeechGenerateParam param)
        {
            var token = await DiyToken.GetCurrentToken();
            var currentUser = token?.CurrentUser == null ? null : JObject.FromObject(token.CurrentUser);
            return Json(await _proxyService.GenerateAuthenticatedSpeechAsync(
                currentUser?["Id"]?.ToString(),
                token?.OsClient ?? string.Empty,
                currentUser,
                param,
                HttpContext.RequestAborted));
        }

        // ============================================================
        // region: OpenAI 兼容端点（平台 APIKey 鉴权，无需登录）
        // 用户在 Claude Code / Cursor / Continue 等工具中配置：
        //   API Base URL: https://api.microi.net/v1
        //   API Key:      sk-microi-xxx
        //   Model:        MiniMax-M2.7-highspeed（或平台上其它已上线模型）
        // ============================================================

        /// <summary>
        /// POST /v1/music_generation —— Microi.AI 中转站的 MiniMax 音乐兼容入口。
        /// 必须同时传 Bearer 平台 APIKey 与稳定 Idempotency-Key。
        /// </summary>
        [HttpPost("/v1/music_generation")]
        [AllowAnonymous]
        public async Task<ContentResult> MiniMaxRelayGenerateMusic()
        {
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }
            var result = await _proxyService.ExecuteMiniMaxMusicRelayAsync(
                Request.Headers["Authorization"].ToString(),
                rawBody,
                Request.Headers["Idempotency-Key"].ToString(),
                HttpContext.RequestAborted);
            return MiniMaxRelayContent(result);
        }

        /// <summary>
        /// POST /v1/video_generation —— Microi.AI 中转站的 MiniMax 视频兼容入口。
        /// 必须同时传 Bearer 平台 APIKey 与稳定 Idempotency-Key。
        /// </summary>
        [HttpPost("/v1/video_generation")]
        [AllowAnonymous]
        public async Task<ContentResult> MiniMaxRelayCreateVideo()
        {
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }
            var result = await _proxyService.ExecuteMiniMaxVideoRelayCreateAsync(
                Request.Headers["Authorization"].ToString(),
                rawBody,
                Request.Headers["Idempotency-Key"].ToString(),
                HttpContext.RequestAborted);
            return MiniMaxRelayContent(result);
        }

        /// <summary>
        /// GET /v1/query/video_generation —— 查询属于当前平台 APIKey 的视频任务。
        /// </summary>
        [HttpGet("/v1/query/video_generation")]
        [AllowAnonymous]
        public async Task<ContentResult> MiniMaxRelayQueryVideo([FromQuery(Name = "task_id")] string taskId)
        {
            var result = await _proxyService.ExecuteMiniMaxVideoRelayTaskAsync(
                Request.Headers["Authorization"].ToString(),
                taskId,
                HttpContext.RequestAborted);
            return MiniMaxRelayContent(result);
        }

        /// <summary>
        /// GET /v1/files/retrieve —— 获取属于当前平台 APIKey 的 MiniMax 文件信息。
        /// </summary>
        [HttpGet("/v1/files/retrieve")]
        [AllowAnonymous]
        public async Task<ContentResult> MiniMaxRelayRetrieveVideo([FromQuery(Name = "file_id")] string fileId)
        {
            var result = await _proxyService.ExecuteMiniMaxVideoRelayFileAsync(
                Request.Headers["Authorization"].ToString(),
                fileId,
                HttpContext.RequestAborted);
            return MiniMaxRelayContent(result);
        }

        private ContentResult MiniMaxRelayContent(AiProxyExecutionResult result)
        {
            Response.StatusCode = result?.StatusCode > 0 ? result.StatusCode : 502;
            return Content(
                result?.ResponseBody ?? "{\"base_resp\":{\"status_code\":502,\"status_msg\":\"MiniMax relay error.\"}}",
                "application/json",
                Encoding.UTF8);
        }

        /// <summary>
        /// POST /v1/chat/completions —— 完全兼容 OpenAI Chat Completions API
        /// </summary>
        [HttpPost("/v1/chat/completions")]
        [AllowAnonymous]
        public async Task OpenAIChatCompletions()
        {
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }
            Response.ContentType =
                "text/event-stream; charset=utf-8";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no";

            var result =
                await _proxyService.ExecuteOpenAiCompatibleAsync(
                    Request.Headers["Authorization"].ToString(),
                    rawBody,
                    Response.Body,
                    HttpContext.RequestAborted);
            if (result.ResponseWritten)
            {
                return;
            }
            if (!string.IsNullOrWhiteSpace(
                    result.ErrorMessage))
            {
                await WriteOpenAIErrorAsync(
                    result.StatusCode,
                    result.ErrorMessage,
                    result.ErrorType,
                    result.ErrorCode);
                return;
            }

            Response.StatusCode = result.StatusCode;
            Response.ContentType =
                "application/json; charset=utf-8";
            await Response.WriteAsync(
                result.ResponseBody ?? "{}");
        }

        /// <summary>
        /// GET /v1/models —— 返回可用模型列表
        /// </summary>
        [HttpGet("/v1/models")]
        [AllowAnonymous]
        public async Task<JsonResult> OpenAIListModels()
        {
            return Json(await _proxyService.GetModelListAsync());
        }

        /// <summary>
        /// OpenAI 兼容凭据的 Token 余额与最近扣减记录。
        /// </summary>
        [HttpGet("/v1/usage")]
        [AllowAnonymous]
        public async Task<JsonResult> OpenAIUsage(int pageIndex = 1, int pageSize = 20)
        {
            // Authorization 中的平台 API Key 直接进入 C# 凭据原子，不能经过
            // V8.Param、租户 Hook 或接口引擎日志，因此保留为最小协议网关。
            return Json(
                await _proxyService
                    .GetUsageByPlatformApiKeyAsync(
                        Request.Headers["Authorization"]
                            .ToString(),
                        pageIndex,
                        pageSize));
        }

        // ============================================================
        // region: 工具方法
        // ============================================================

        /// <summary>
        /// 写入 SSE event（NL2V8Engine 用）
        /// </summary>
        private async Task WriteSseEventAsync(string eventType, string data)
        {
            // SSE规范：data中的换行需拆分为多个data行，先统一换行符再替换
            var safeData = data?.Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", "\ndata: ");
            var sseMessage = $"event: {eventType}\ndata: {safeData}\n\n";
            var bytes = Encoding.UTF8.GetBytes(sseMessage);
            await Response.Body.WriteAsync(bytes, 0, bytes.Length);
            await Response.Body.FlushAsync();
        }

        /// <summary>
        /// 写入 SSE data 行（代理转发用）
        /// </summary>
        private async Task WriteSseDataAsync(string data)
        {
            var bytes = Encoding.UTF8.GetBytes($"data: {data}\n\n");
            await Response.Body.WriteAsync(bytes, 0, bytes.Length);
            await Response.Body.FlushAsync();
        }

        private async Task WriteSseDoneAsync()
        {
            var bytes = Encoding.UTF8.GetBytes("data: [DONE]\n\n");
            await Response.Body.WriteAsync(bytes, 0, bytes.Length);
            await Response.Body.FlushAsync();
        }

        /// <summary>
        /// 输出 OpenAI 标准格式错误响应
        /// </summary>
        private async Task WriteOpenAIErrorAsync(int statusCode, string message, string type, string code)
        {
            Response.StatusCode = statusCode;
            Response.ContentType = "application/json; charset=utf-8";
            await Response.WriteAsync(AiProxyService.MakeOpenAIError(message, type, code));
        }
    }

    #region 请求参数类

    public class CreateOrderParam
    {
        public string PlanId { get; set; }
        public int Months { get; set; } = 1;
    }

    public class PayOrderParam
    {
        public string OrderId { get; set; }
    }

    #endregion
}
