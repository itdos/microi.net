using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Minio.DataModel;
using MySqlX.XDevAPI.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Quartz.Impl.AdoJobStore.Common;
using Senparc.CO2NET.Extensions;
using System;
using System.Collections.Generic;
using System.Data.Common;
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
        private readonly IFormEngine _formEngine;
        private readonly SubscriptionService _subService;
        private readonly AiProxyService _proxyService;

        public AiController(IMicroiAI microiAi, IFormEngine formEngine)
        {
            _microiAi = microiAi;
            _formEngine = formEngine;
            _subService = new SubscriptionService(formEngine);
            _proxyService = new AiProxyService(_subService);
        }

        /// <summary>
        /// 从 CurrentToken 获取当前用户信息
        /// </summary>
        private async Task<(string UserId, string UserName)> GetCurrentUserAsync()
        {
            var token = await DiyToken.GetCurrentToken();
            if (token?.CurrentUser == null) return (null, null);
            var userId = token.CurrentUser["Id"]?.ToString();
            var userName = token.CurrentUser["Name"]?.ToString() ?? token.CurrentUser["Account"]?.ToString() ?? "";
            return (userId, userName);
        }

        // ============================================================
        // region: AI 对话 / NL2SQL / NL2V8Engine（原有功能）
        // ============================================================

        /// <summary>
        /// AI对话
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> Chat(AiParam param)
        {
            var result = await _microiAi.Chat(param);
            return Json(result);
        }

        /// <summary>
        /// 自然语言转SQL查询
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> NL2SQL(NL2SQLParam param)
        {
            var result = await _microiAi.NL2SQL(param);
            return Json(result);
        }

        /// <summary>
        /// 自然语言转V8引擎代码（SSE流式输出）
        /// </summary>
        [HttpPost, HttpGet]
        public async Task NL2V8Engine([FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] NL2V8Param bodyParam, [FromQuery] string Question = null, [FromQuery] string AiModel = null, [FromQuery] string OsClient = null)
        {
            var param = bodyParam ?? new NL2V8Param();
            if (!string.IsNullOrEmpty(Question)) param.Question = Question;
            if (!string.IsNullOrEmpty(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrEmpty(OsClient)) param.OsClient = OsClient;

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
        public async Task<JsonResult> NL2V8EngineSync(NL2V8Param param)
        {
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
        /// 创建订阅订单
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SubCreateOrder([FromBody] CreateOrderParam param)
        {
            var (userId, userName) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(param?.PlanId))
                return Json(new DosResult(0, null, "请选择套餐！"));

            var result = await _subService.CreateOrder(userId, userName, param.PlanId, param.Months > 0 ? param.Months : 1);
            return Json(result);
        }

        /// <summary>
        /// 获取支付宝支付链接
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SubCreateAlipay([FromBody] PayOrderParam param)
        {
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(param?.OrderId))
                return Json(new DosResult(0, null, "订单Id不能为空！"));

            var result = await _subService.CreateAlipay(param.OrderId);
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

                var verifyResult = await _subService.VerifyAlipayNotify(signParams);
                if (verifyResult.Code != 1)
                    return Content("fail");

                string tradeStatus = signParams.ContainsKey("trade_status") ? signParams["trade_status"] : "";
                string outTradeNo = signParams.ContainsKey("out_trade_no") ? signParams["out_trade_no"] : "";
                string tradeNo = signParams.ContainsKey("trade_no") ? signParams["trade_no"] : "";

                if (tradeStatus == "TRADE_SUCCESS" || tradeStatus == "TRADE_FINISHED")
                {
                    await _subService.HandlePaySuccess(outTradeNo, tradeNo);
                }

                return Content("success");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AiController] SubAlipayNotify 异常: {ex.Message}");
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
            var (userId, _) = await GetCurrentUserAsync();
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));
            if (string.IsNullOrWhiteSpace(orderId))
                return Json(new DosResult(0, null, "订单Id不能为空！"));

            var orderResult = await _formEngine.GetFormDataAsync("mic_sub_order", new
            {
                Id = orderId,
                _Where = new List<DiyWhere>()
                {
                    new DiyWhere() { Name = "UserId", Value = userId, Type = "=" }
                }
            });

            if (orderResult.Code != 1 || orderResult.Data == null)
                return Json(new DosResult(0, null, "订单不存在！"));

            return Json(new DosResult(1, new
            {
                PayStatus = Convert.ToInt32(orderResult.Data.PayStatus),
                PayTime = orderResult.Data.PayTime,
                TradeNo = orderResult.Data.TradeNo
            }));
        }

        /// <summary>
        /// 获取所有APIKey列表（管理接口）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> SubGetApiKeyList()
        {
            var result = await _subService.GetApiKeyList();
            return Json(result);
        }

        /// <summary>
        /// 获取指定APIKey绑定的用户列表（管理接口）
        /// </summary>
        [HttpGet, HttpPost]
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
            if (string.IsNullOrEmpty(userId))
            {
                Response.ContentType = "text/event-stream; charset=utf-8";
                await WriteSseDataAsync(JsonConvert.SerializeObject(new { error = new { message = "请先登录！", code = "unauthorized" } }));
                await WriteSseDoneAsync();
                return;
            }

            // 读取请求体
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }

            // 解析模型路由
            string modelName = null;
            try { modelName = JObject.Parse(rawBody)["model"]?.ToString(); } catch { }
            var route = await _subService.ResolveModel(modelName);
            if (route == null)
            {
                // 未指定或无效模型时使用第一个可用模型
                var models = await _subService.GetModels();
                if (models.Code == 1 && models.Data != null && models.Data.Count > 0)
                {
                    route = await _subService.ResolveModel((string)models.Data[0].DisplayName);
                }
            }
            if (route == null)
            {
                Response.ContentType = "text/event-stream; charset=utf-8";
                await WriteSseDataAsync(JsonConvert.SerializeObject(new { error = new { message = "没有可用的模型！", code = "model_not_found" } }));
                await WriteSseDoneAsync();
                return;
            }

            // 鉴权 + 扣额度 + 获取 Key
            var (apiKey, prepError) = await _proxyService.PrepareProxy(userId, route);
            if (!string.IsNullOrEmpty(prepError))
            {
                Response.ContentType = "text/event-stream; charset=utf-8";
                await WriteSseDataAsync(JsonConvert.SerializeObject(new { error = new { message = prepError, code = "quota_exceeded" } }));
                await WriteSseDoneAsync();
                return;
            }

            // 规范化请求体（替换为上游模型名）
            var (body, _, bodyError) = _proxyService.PrepareRequestBody(rawBody, route.UpstreamModelId, forceStream: true);
            if (!string.IsNullOrEmpty(bodyError))
            {
                Response.ContentType = "text/event-stream; charset=utf-8";
                await WriteSseDataAsync(JsonConvert.SerializeObject(new { error = new { message = bodyError, code = "invalid_request" } }));
                await WriteSseDoneAsync();
                return;
            }

            // SSE 流式转发到供应商
            Response.ContentType = "text/event-stream; charset=utf-8";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no";

            try
            {
                string targetUrl = route.ApiBase.TrimEnd('/') + route.ApiPath;
                await _proxyService.ForwardStreamingAsync(body, apiKey, targetUrl, route.AuthPrefix, Response.Body, HttpContext.RequestAborted);
                _ = _subService.IncrementApiKeyCallCount(userId);
            }
            catch (TaskCanceledException) { }
            catch (Exception ex)
            {
                try
                {
                    await WriteSseDataAsync(JsonConvert.SerializeObject(new { error = new { message = $"代理转发异常: {ex.Message}", code = "proxy_error" } }));
                    await WriteSseDoneAsync();
                }
                catch { }
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
            if (string.IsNullOrEmpty(userId))
                return Json(new DosResult(0, null, "请先登录！"));

            // 读取请求体
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }

            // 解析模型路由
            string modelName = null;
            try { modelName = JObject.Parse(rawBody)["model"]?.ToString(); } catch { }
            var route = await _subService.ResolveModel(modelName);
            if (route == null)
            {
                var models = await _subService.GetModels();
                if (models.Code == 1 && models.Data != null && models.Data.Count > 0)
                {
                    route = await _subService.ResolveModel((string)models.Data[0].DisplayName);
                }
            }
            if (route == null)
                return Json(new DosResult(0, null, "没有可用的模型！"));

            var (apiKey, prepError) = await _proxyService.PrepareProxy(userId, route);
            if (!string.IsNullOrEmpty(prepError))
                return Json(new DosResult(0, null, prepError));

            var (body, _, bodyError) = _proxyService.PrepareRequestBody(rawBody, route.UpstreamModelId, forceStream: false);
            if (!string.IsNullOrEmpty(bodyError))
                return Json(new DosResult(0, null, bodyError));

            try
            {
                string targetUrl = route.ApiBase.TrimEnd('/') + route.ApiPath;
                var (success, responseBody, statusCode) = await _proxyService.ForwardAsync(body, apiKey, targetUrl, route.AuthPrefix);
                if (!success)
                    return Json(new DosResult(0, null, $"上游 API 错误: {statusCode} - {responseBody}"));

                _ = _subService.IncrementApiKeyCallCount(userId);
                return Json(new DosResult(1, JObject.Parse(responseBody)));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, $"代理请求异常: {ex.Message}"));
            }
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
            // 1. 平台 APIKey 鉴权
            var (userId, authError) = await _proxyService.AuthByPlatformApiKey(Request.Headers["Authorization"].ToString());
            if (!string.IsNullOrEmpty(authError))
            {
                await WriteOpenAIErrorAsync(401, authError, "invalid_request_error", "invalid_api_key");
                return;
            }

            // 2. 读取请求体
            string rawBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }

            // 3. 解析模型 → 获取供应商路由信息
            string modelName = null;
            try { modelName = JObject.Parse(rawBody)["model"]?.ToString(); } catch { }
            var route = await _subService.ResolveModel(modelName);
            if (route == null)
            {
                await WriteOpenAIErrorAsync(400, $"Model '{modelName}' not found or not available.", "invalid_request_error", "model_not_found");
                return;
            }

            // 4. 扣额度 + 获取供应商 APIKey
            var (apiKey, prepError) = await _proxyService.PrepareProxy(userId, route);
            if (!string.IsNullOrEmpty(prepError))
            {
                await WriteOpenAIErrorAsync(429, prepError, "rate_limit_error", "quota_exceeded");
                return;
            }

            // 5. 规范化请求体（替换为上游模型名）
            var (body, isStream, bodyError) = _proxyService.PrepareRequestBody(rawBody, route.UpstreamModelId);
            if (!string.IsNullOrEmpty(bodyError))
            {
                await WriteOpenAIErrorAsync(400, bodyError, "invalid_request_error", "invalid_json");
                return;
            }

            // 6. 转发到供应商
            try
            {
                string targetUrl = route.ApiBase.TrimEnd('/') + route.ApiPath;

                if (isStream)
                {
                    Response.ContentType = "text/event-stream; charset=utf-8";
                    Response.Headers["Cache-Control"] = "no-cache";
                    Response.Headers["Connection"] = "keep-alive";
                    Response.Headers["X-Accel-Buffering"] = "no";

                    await _proxyService.ForwardStreamingAsync(body, apiKey, targetUrl, route.AuthPrefix, Response.Body, HttpContext.RequestAborted);
                }
                else
                {
                    var (success, responseBody, statusCode) = await _proxyService.ForwardAsync(body, apiKey, targetUrl, route.AuthPrefix);
                    Response.StatusCode = statusCode;
                    Response.ContentType = "application/json; charset=utf-8";
                    await Response.WriteAsync(responseBody);
                }

                _ = _subService.IncrementApiKeyCallCount(userId);
            }
            catch (TaskCanceledException) { }
            catch (Exception ex)
            {
                if (!Response.HasStarted)
                {
                    await WriteOpenAIErrorAsync(502, $"Proxy error: {ex.Message}", "server_error", "proxy_error");
                }
            }
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