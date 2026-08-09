using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// AI 统一控制器
    /// 包含：AI对话、NL2SQL、NL2V8Engine、AI订阅管理、AI代理转发、OpenAI兼容端点
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class AiController : Controller
    {
        private readonly IMicroiAI _microiAi;
        private readonly SubscriptionService _subService;
        private readonly AiProxyService _proxyService;

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

        private async Task EnrichCurrentUserAsync(NL2SQLParam param)
        {
            if (param == null)
            {
                return;
            }
            var (userId, userName, osClient) = await GetCurrentUserContextAsync();
            param.CurrentUserId = userId;
            param.CurrentUserName = userName;
            param.OsClient = osClient;
        }

        public class UpdateConversationTitleParam
        {
            public string ConversationId { get; set; }
            public string Title { get; set; }
            public string Source { get; set; }
        }

        public class GenerateAvatarParam
        {
            public string Prompt { get; set; }
            public int Count { get; set; } = 4;
        }

        /// <summary>
        /// 修改当前用户整组 AI 对话标题。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> UpdateConversationTitle([FromBody] UpdateConversationTitleParam param)
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            var result = await _microiAi.UpdateConversationTitleAsync(
                userId,
                osClient,
                param?.ConversationId,
                param?.Title,
                param?.Source);
            return Json(result);
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
        /// AI语义分析：手动模式由前端指定，自动模式由后端模型先识别意图。
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> RecognizeIntent(
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] AiParam bodyParam,
            [FromQuery] string UserChatMsg = null,
            [FromQuery] string AiModel = null,
            [FromQuery] string AiModelId = null,
            [FromQuery] string OsClient = null)
        {
            var param = bodyParam ?? new AiParam();
            if (!string.IsNullOrWhiteSpace(UserChatMsg)) param.UserChatMsg = UserChatMsg;
            if (!string.IsNullOrWhiteSpace(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrWhiteSpace(AiModelId)) param.AiModelId = AiModelId;
            if (!string.IsNullOrWhiteSpace(OsClient)) param.OsClient = OsClient;
            await EnrichCurrentUserAsync(param);

            return Json(
                await _microiAi.ResolveIntentResultAsync(param));
        }

        /// <summary>
        /// AI对话
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> Chat(
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

            return Json(
                await _microiAi.ChatWithContextAsync(param));
        }

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
        /// 自然语言转SQL查询
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> NL2SQL(
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] NL2SQLParam bodyParam,
            [FromQuery] string Question = null,
            [FromQuery] string AiModel = null,
            [FromQuery] string AiModelId = null,
            [FromQuery] string ReasoningEffort = null,
            [FromQuery] string OsClient = null)
        {
            var param = bodyParam ?? new NL2SQLParam();
            if (!string.IsNullOrWhiteSpace(Question)) param.Question = Question;
            if (!string.IsNullOrWhiteSpace(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrWhiteSpace(AiModelId)) param.AiModelId = AiModelId;
            if (!string.IsNullOrWhiteSpace(ReasoningEffort)) param.ReasoningEffort = ReasoningEffort;
            if (!string.IsNullOrWhiteSpace(OsClient)) param.OsClient = OsClient;
            await EnrichCurrentUserAsync(param);
            var currentToken = await DiyToken.GetCurrentToken();
            return Json(
                await _microiAi.NL2SQLAuthorizedAsync(
                    param,
                    currentToken?.CurrentUser,
                    currentToken?.OsClient));
        }

        /// <summary>
        /// 获取当前用户 AI 中转站 Token 额度。
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> RelayTokenSummary(
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] AiParam bodyParam,
            [FromQuery] string AiModel = null,
            [FromQuery] string AiModelId = null,
            [FromQuery] string OsClient = null)
        {
            var param = bodyParam ?? new AiParam();
            if (!string.IsNullOrWhiteSpace(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrWhiteSpace(AiModelId)) param.AiModelId = AiModelId;
            if (!string.IsNullOrWhiteSpace(OsClient)) param.OsClient = OsClient;
            await EnrichCurrentUserAsync(param);
            var result = await _microiAi.GetRelayTokenSummary(param);
            return Json(result);
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

        /// <summary>
        /// 自然语言转V8引擎代码（非流式）
        /// </summary>
        [HttpPost, HttpGet]
        [PlatformAdminOnly]
        public async Task<JsonResult> NL2V8EngineSync(NL2V8Param param)
        {
            param ??= new NL2V8Param();
            var currentContext = await GetCurrentUserContextAsync();
            param.OsClient = currentContext.OsClient;
            var result = await _microiAi.NL2V8Engine(param);
            return Json(result);
        }

        // ============================================================
        // region: AI 订阅管理
        // ============================================================

        /// <summary>
        /// 获取所有套餐列表（无需登录）
        /// </summary>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> SubGetPlans()
        {
            var result = await _subService.GetPlans();
            return Json(result);
        }

        /// <summary>
        /// 获取当前用户的订阅信息及额度
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> SubGetInfo()
        {
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));

            var result = await _subService.GetUserSubscription(userId);
            return Json(result);
        }

        /// <summary>
        /// 获取当前用户的 AI 中转 API Key。
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetUserAiApiKey()
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(osClient))
                return Json(new DosResult(0, null, "OsClient不能为空！"));

            var result = await _subService.EnsureUserAiApiKey(userId, osClient);
            return Json(result);
        }

        /// <summary>
        /// 重置当前用户的 AI 中转 API Key。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> ResetUserAiApiKey()
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(osClient))
                return Json(new DosResult(0, null, "OsClient不能为空！"));

            var result = await _subService.EnsureUserAiApiKey(userId, osClient, true);
            return Json(result);
        }

        /// <summary>
        /// 获取当前登录用户的中转站 Token 余额和最近扣减记录。
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetUserAiUsage(int pageIndex = 1, int pageSize = 20)
        {
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId)) return Json(new DosResult(0, null, "请先登录！"));
            return Json(await _subService.GetRelayTokenUsage(userId, pageIndex, pageSize));
        }

        /// <summary>
        /// 创建订阅订单
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SubCreateOrder([FromBody] CreateOrderParam param)
        {
            var (userId, userName) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));

            var result = await _subService.CreateOrder(
                userId,
                userName,
                param?.PlanId,
                param?.Months ?? 0);
            return Json(result);
        }

        /// <summary>
        /// 获取支付宝支付链接
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SubCreateAlipay([FromBody] PayOrderParam param)
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(param?.OrderId))
                return Json(new DosResult(0, null, "订单Id不能为空！"));

            var result = await _subService.CreateAlipayForUser(
                param.OrderId,
                userId,
                osClient);
            return Json(result);
        }

        /// <summary>
        /// 支付宝异步回调通知
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<ContentResult> SubAlipayNotify()
        {
            try
            {
                var form = await Request.ReadFormAsync();
                var signParams = new Dictionary<string, string>();
                foreach (var key in form.Keys)
                {
                    signParams[key] = form[key];
                }

                var result =
                    await _subService.ProcessAlipayNotify(
                        signParams);
                return Content(
                    result.Code == 1
                        ? "success"
                        : "fail");
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "AI", "SubscriptionPaymentCallbackFailed", "AI 订阅支付回调处理异常", ex.ToString(), 2);
                return Content("fail");
            }
        }

        /// <summary>
        /// 获取用户订单列表
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> SubGetOrders(int pageIndex = 1, int pageSize = 20)
        {
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));

            var result = await _subService.GetUserOrders(userId, pageIndex, pageSize);
            return Json(result);
        }

        /// <summary>
        /// 消耗一次额度（供 Gateway 调用）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SubConsumeQuota()
        {
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));

            var result = await _subService.ConsumeQuota(userId);
            return Json(result);
        }

        /// <summary>
        /// 查询订单支付状态
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> SubGetOrderStatus(string orderId)
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(orderId))
                return Json(new DosResult(0, null, "订单Id不能为空！"));

            return Json(await _subService.GetOrderStatusForUser(
                orderId,
                userId,
                osClient));
        }

        /// <summary>
        /// 获取所有APIKey列表（管理接口）
        /// </summary>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> SubGetApiKeyList()
        {
            var result = await _subService.GetApiKeyList();
            return Json(result);
        }

        /// <summary>
        /// 获取指定APIKey绑定的用户列表（管理接口）
        /// </summary>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> SubGetApiKeyBindUsers(string apiKeyId)
        {
            if (string.IsNullOrWhiteSpace(apiKeyId))
                return Json(new DosResult(0, null, "apiKeyId不能为空！"));

            var result = await _subService.GetApiKeyBindUsers(apiKeyId);
            return Json(result);
        }

        /// <summary>
        /// 获取APIKey容量预警（管理接口）
        /// </summary>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> SubGetApiKeyCapacity()
        {
            var result = await _subService.GetApiKeyCapacityReport();
            return Json(result);
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
        /// 为当前登录用户生成候选头像。上游密钥只在服务端使用，返回的候选图
        /// 仍需由用户选中后上传到本租户 HDFS 并保存为账户头像。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GenerateProfileAvatar([FromBody] GenerateAvatarParam param)
        {
            var (userId, _) = await GetCurrentUserAsync();
            return Json(await _proxyService.GenerateAuthenticatedAvatarAsync(
                userId,
                param?.Prompt,
                param?.Count ?? 4));
        }

        /// <summary>
        /// 创建 MiniMax 视频异步任务。RequestId 必须由调用方按业务槽位稳定生成；
        /// 同一租户、用户和 RequestId 不会重复调用上游。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> CreateMiniMaxVideo([FromBody] MiniMaxVideoCreateParam param)
        {
            var context = await GetCurrentUserContextAsync();
            return Json(await _proxyService.CreateAuthenticatedVideoAsync(
                context.UserId,
                context.OsClient,
                param,
                HttpContext.RequestAborted));
        }

        /// <summary>
        /// 查询当前用户的 MiniMax 视频任务；仅接收服务器签发的 TaskHandle。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GetMiniMaxVideoTask([FromBody] MiniMaxVideoTaskParam param)
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            return Json(await _proxyService.GetAuthenticatedVideoTaskAsync(
                userId,
                osClient,
                param,
                HttpContext.RequestAborted));
        }

        /// <summary>
        /// 获取当前用户视频文件的临时下载地址；仅接收服务器签发的 FileHandle。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GetMiniMaxVideoFile([FromBody] MiniMaxVideoFileParam param)
        {
            var (userId, _, osClient) = await GetCurrentUserContextAsync();
            return Json(await _proxyService.GetAuthenticatedVideoFileAsync(
                userId,
                osClient,
                param,
                HttpContext.RequestAborted));
        }

        /// <summary>
        /// 查询当前用户的额度和订阅状态（给 OpenClaw 客户端用）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> ProxyGetQuotaStatus()
        {
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));

            var result = await _subService.GetUserSubscription(userId);
            return Json(result);
        }

        // ============================================================
        // region: OpenAI 兼容端点（平台 APIKey 鉴权，无需登录）
        // 用户在 Claude Code / Cursor / Continue 等工具中配置：
        //   API Base URL: https://api.microi.net/v1
        //   API Key:      sk-microi-xxx
        //   Model:        MiniMax-M2.7-highspeed（或平台上其它已上线模型）
        // ============================================================

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
            return Json(
                await _proxyService
                    .GetUsageByPlatformApiKeyAsync(
                        Request.Headers["Authorization"]
                            .ToString(),
                        pageIndex,
                        pageSize));
        }

        /// <summary>
        /// 获取平台已上线的模型列表（前端展示用）
        /// </summary>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> SubGetModels()
        {
            var result = await _subService.GetModels();
            return Json(result);
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
