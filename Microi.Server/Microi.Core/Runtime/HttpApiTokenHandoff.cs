using System;
using System.Runtime.CompilerServices;
using System.Threading;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Controller 到同次接口引擎的单次身份交接。授权只来自宿主已验证的 Token，
    /// 不写入 JSON/注解，不跨请求缓存，也不替代下一次请求或嵌套调用的重新验证。
    /// </summary>
    internal static class HttpApiTokenHandoff
    {
        private static readonly ConditionalWeakTable<JObject, Grant> Grants = new ConditionalWeakTable<JObject, Grant>();

        internal static void Bind(JObject request, HttpContext context, CurrentToken token)
        {
            if (request == null || context == null || token?.CurrentUser == null) return;
            if (Grants.TryGetValue(request, out _)) return; // 重新绑定不能复活已消费的交接。
            Grants.Add(request, new Grant(context, token, request["_CurrentUser"], request["OsClient"]?.ToString()));
        }

        internal static bool TryConsume(JObject request, HttpContext context, out CurrentToken token)
        {
            token = null;
            if (request == null || context == null || !Grants.TryGetValue(request, out var grant)) return false;
            // 消费失败也不能重放。参数克隆、租户改写或其它 HttpContext 一律回到实时验证。
            if (Interlocked.Exchange(ref grant.Consumed, 1) != 0
                || !ReferenceEquals(context, grant.Context)
                || !string.Equals(context.TraceIdentifier, grant.RequestId, StringComparison.Ordinal)
                || !ReferenceEquals(request["_CurrentUser"], grant.User)
                || !string.Equals(request["OsClient"]?.ToString(), grant.OsClient, StringComparison.Ordinal)) return false;
            token = grant.Token;
            return true;
        }

        private sealed class Grant
        {
            internal Grant(HttpContext context, CurrentToken token, JToken user, string osClient)
            { Context = context; RequestId = context.TraceIdentifier; Token = token; User = user; OsClient = osClient; }
            internal readonly HttpContext Context;
            internal readonly string RequestId;
            internal readonly CurrentToken Token;
            internal readonly JToken User;
            internal readonly string OsClient;
            internal int Consumed;
        }
    }
}
