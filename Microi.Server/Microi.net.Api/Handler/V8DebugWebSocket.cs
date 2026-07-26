#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8DebugWebSocket.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-03-21
* 文件描述：V8引擎逐行调试 WebSocket 中间件（路由层）
*           此文件仅负责 WebSocket 路径匹配、JWT 鉴权、会话创建
*******************************************************/
#endregion
using System;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;
using Microsoft.AspNetCore.Http;

namespace Microi.net.Api
{
    /// <summary>
    /// V8 调试 WebSocket 中间件（路由层，核心逻辑在 V8McpDebugSession）
    /// </summary>
    public class V8DebugWebSocketMiddleware
    {
        private readonly RequestDelegate _next;

        public V8DebugWebSocketMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.Path == "/api/V8Debug/ws" && context.WebSockets.IsWebSocketRequest)
            {
                // JWT 鉴权
                dynamic currentToken = null;
                try
                {
                    var authHeader = context.Request.Headers["Authorization"].ToString();
                    if (string.IsNullOrWhiteSpace(authHeader))
                    {
                        var accessToken = context.Request.Query["access_token"].ToString();
                        if (!string.IsNullOrWhiteSpace(accessToken))
                        {
                            context.Request.Headers["Authorization"] = $"Bearer {accessToken}";
                        }
                    }
                    currentToken = await DiyToken.GetCurrentToken();
                }
                catch (Exception ex)
                {
                    MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "V8Debug", "AuthenticationFailed", "V8 调试 WebSocket 鉴权异常", ex.ToString(), 3);
                }

                if (currentToken == null || currentToken.CurrentUser == null)
                {
                    MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "V8Debug", "UnauthorizedConnectionRejected", "V8 调试 WebSocket 未授权连接已拒绝", "currentToken 或 CurrentUser 为空。", 3);
                    context.Response.StatusCode = 401;
                    await context.Response.WriteAsync("Unauthorized");
                    return;
                }

                var level = ((JToken)currentToken.CurrentUser["Level"]).Val<int>();
                if (level < 9999)
                {
                    MicroiEngine.QueueSystemLog(Convert.ToString(currentToken.OsClient), "V8Debug", "InsufficientLevelRejected", "V8 调试 WebSocket 权限不足，已拒绝", $"Level={level}，要求 Level >= 9999。", 3);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Forbidden: Level >= 9999 required");
                    return;
                }

                var ws = await context.WebSockets.AcceptWebSocketAsync();
                var session = new V8McpDebugSession(ws, currentToken, context);
                await session.RunAsync();
            }
            else
            {
                await _next(context);
            }
        }
    }
}
