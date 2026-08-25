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

                var osClient = Convert.ToString(currentToken.OsClient);
                var currentUser = currentToken.CurrentUser as JObject
                    ?? JsonHelper.ToJObject((object)currentToken.CurrentUser);
                if (currentUser == null || UserAccessKeySecurity.IsSession(currentUser))
                {
                    MicroiEngine.QueueSystemLog(osClient, "V8Debug", "AccessKeyRejected", "V8 调试 WebSocket 访问密钥连接已拒绝", "逐行调试只允许真实 DiyToken 管理员会话。", 3);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Forbidden: interactive administrator session required");
                    return;
                }

                // 调试器能够读取/执行租户脚本，不能只相信可能陈旧的 Token Level。
                // 同时要求签入投影与当前租户主库中的用户、状态和管理员角色仍然有效。
                if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser))
                {
                    MicroiEngine.QueueSystemLog(osClient, "V8Debug", "AdministratorRevalidationRejected", "V8 调试 WebSocket 管理员主库复核失败，已拒绝", "当前用户已失效、降权或不再具备平台管理员角色。", 3);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Forbidden: current platform administrator required");
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
