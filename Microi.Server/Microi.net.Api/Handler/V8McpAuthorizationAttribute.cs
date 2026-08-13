using System;
using System.Reflection;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    public enum V8McpScope
    {
        Read,
        Write,
        Execute,
        Admin
    }

    /// <summary>
    /// Declares the least MCP capability required by one controller action.
    /// The controller-level authorization filter rejects actions that omit it,
    /// so a newly added endpoint cannot silently become available.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
    public sealed class V8McpCapabilityAttribute : Attribute
    {
        public V8McpCapabilityAttribute(V8McpScope scope)
        {
            Scope = scope;
        }

        public V8McpScope Scope { get; }
    }

    /// <summary>
    /// Mandatory, non-overridable authorization boundary for V8/MCP routes.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = true)]
    public sealed class V8McpAuthorizationAttribute : TypeFilterAttribute
    {
        public V8McpAuthorizationAttribute() : base(typeof(V8McpAuthorizationFilter))
        {
        }
    }

    public sealed class V8McpAuthorizationFilter : IAsyncAuthorizationFilter
    {
        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var descriptor = context.ActionDescriptor as ControllerActionDescriptor;
            var capability = descriptor?.MethodInfo.GetCustomAttribute<V8McpCapabilityAttribute>(true);
            if (capability == null)
            {
                Deny(context, 403, "当前 MCP 端点未声明能力范围，已默认拒绝访问。");
                return;
            }

            var (ok, message, currentToken) = await V8McpLogic.CheckPermission().ConfigureAwait(false);
            if (!ok)
            {
                Deny(context, 403, message);
                return;
            }

            var currentUser = (object)currentToken is CurrentToken typedToken
                ? typedToken.CurrentUser
                : null;
            if (!HasCapability(currentUser, capability.Scope))
            {
                Deny(context, 403, $"当前身份缺少 {ScopeName(capability.Scope)} 能力。");
            }
        }

        internal static bool HasCapability(JObject currentUser, V8McpScope required)
        {
            if (currentUser == null) return false;

            // Ordinary administrator sessions preserve existing behavior. Access-key
            // sessions are detached, server-built identities and must carry an
            // explicit MCP scope. No request header/body value participates here.
            if (!UserAccessKeySecurity.IsSession(currentUser)) return true;

            return UserAccessKeySecurity.HasScope(currentUser, "mcp:admin")
                   || UserAccessKeySecurity.HasScope(currentUser, ScopeName(required));
        }

        internal static string ScopeName(V8McpScope scope)
        {
            return scope switch
            {
                V8McpScope.Read => "mcp:read",
                V8McpScope.Write => "mcp:write",
                V8McpScope.Execute => "mcp:execute",
                V8McpScope.Admin => "mcp:admin",
                _ => "mcp:admin"
            };
        }

        private static void Deny(AuthorizationFilterContext context, int statusCode, string message)
        {
            context.Result = new ObjectResult(new DosResult(0, null, message))
            {
                StatusCode = statusCode
            };
        }
    }
}
