using Dos.Common;
using Dos.ORM;
using Microi.net;
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
using System.Text;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class AiController : Controller
    {
        private readonly IMicroiAI _microiAi;
        public AiController(IMicroiAI microiAi)
        {
            _microiAi = microiAi;
        }
        /// <summary>
        /// AI对话
        /// </summary>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> Chat(AiParam param)
        {
            var result = await _microiAi.Chat(param);
            return Json(result);
        }

        /// <summary>
        /// 自然语言转SQL查询（用户可以问：今天订单数量多少）
        /// </summary>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> NL2SQL(NL2SQLParam param)
        {
            var result = await _microiAi.NL2SQL(param);
            return Json(result);
        }

        /// <summary>
        /// 自然语言转V8引擎代码（SSE流式输出，打字机效果）
        /// 用户用中文描述业务需求，AI根据V8文档+数据库结构生成可运行的V8接口引擎代码
        /// 
        /// 请求示例：POST /api/Ai/NL2V8Engine
        /// Body: { "Question": "帮我获取最新的一条生产订单数据", "AiModel": "deepseek-chat", "OsClient": "iTdos" }
        /// 
        /// 响应格式：SSE（text/event-stream），逐字输出AI生成的代码
        /// </summary>
        [HttpPost, HttpGet]
        public async Task NL2V8Engine([FromQuery] string Question, [FromQuery] string AiModel, [FromQuery] string OsClient, [FromBody] NL2V8Param bodyParam)
        {
            // 支持GET参数和POST Body两种传参方式
            var param = bodyParam ?? new NL2V8Param();
            if (!string.IsNullOrEmpty(Question)) param.Question = Question;
            if (!string.IsNullOrEmpty(AiModel)) param.AiModel = AiModel;
            if (!string.IsNullOrEmpty(OsClient)) param.OsClient = OsClient;

            // 设置SSE响应头
            Response.ContentType = "text/event-stream; charset=utf-8";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no"; // 禁用Nginx缓冲

            try
            {
                // 参数校验
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

                // 流式回调：每收到一个AI数据块，就通过SSE推送给前端
                Func<string, Task> onChunkReceived = async (chunk) =>
                {
                    await WriteSseEventAsync("message", chunk);
                };

                // 调用NL2V8Engine核心逻辑
                var result = await _microiAi.NL2V8Engine(param, onChunkReceived);

                // 发送最终结果（包含元数据）
                if (result.Code == 1 && result.Data != null)
                {
                    var resultJson = JsonConvert.SerializeObject(result.Data);
                    await WriteSseEventAsync("result", resultJson);
                }
                else if (result.Code != 1)
                {
                    await WriteSseEventAsync("error", result.Msg ?? "生成失败");
                }

                // SSE结束标识
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
        /// 自然语言转V8引擎代码（非流式，一次性返回完整结果）
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> NL2V8EngineSync(NL2V8Param param)
        {
            var result = await _microiAi.NL2V8Engine(param);
            return Json(result);
        }

        /// <summary>
        /// 写入SSE事件到Response流
        /// SSE格式：event: {eventType}\ndata: {data}\n\n
        /// </summary>
        private async Task WriteSseEventAsync(string eventType, string data)
        {
            // SSE标准格式
            var sseMessage = $"event: {eventType}\ndata: {data?.Replace("\n", "\ndata: ")}\n\n";
            var bytes = Encoding.UTF8.GetBytes(sseMessage);
            await Response.Body.WriteAsync(bytes, 0, bytes.Length);
            await Response.Body.FlushAsync();
        }
    }
}