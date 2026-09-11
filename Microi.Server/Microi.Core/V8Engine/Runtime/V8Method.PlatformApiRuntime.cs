using System;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private static readonly IReadOnlyDictionary<string, string[]> PlatformApiRuntimeEngineKeys =
            new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                ["PlatformReminders"] = new[] { "platform-reminder-runtime", "platform-reminder-official-feed", "platform-reminder-tick" },
                ["MarketplaceSource"] = new[] { "platform-marketplace-source" },
                ["ExternalLogin"] = new[]
                {
                    "platform-external-login", "platform-external-login-callback"
                },
                ["IdentityVerification"] = new[] { "platform-identity-verification" },
                ["TenantSystemSettings"] = new[] { "platform-tenant-system-settings" },
                ["WeChatContentSecurity"] = new[]
                {
                    "platform-wechat-content-security",
                    "platform-wechat-content-security-callback"
                },
                ["WeChatOAuth"] = new[] { "platform-wechat-oauth" },
                ["SysUserSession"] = new[] { "platform-sys-user-session" },
                ["LegacyOs"] = new[] { "platform-os-legacy-compatibility" }
            };

        /// <summary>
        /// 统一插件原子门面。RuntimeKey 只能命中后端编译期白名单，且每项绑定精确
        /// 官方 ApiEngineKey；业务 Hook、Action 分派和兼容路由仍由接口引擎完成。
        /// </summary>
        public dynamic RunPlatformApiRuntime(dynamic dynamicParam)
        {
            try
            {
                var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var runtimeKey = (request["RuntimeKey"]?.ToString() ?? string.Empty).Trim();
                if (!PlatformApiRuntimeEngineKeys.TryGetValue(runtimeKey, out var allowedKeys))
                    return new DosResult(0, null, "平台接口运行时 Key 无效。");
                var denied = RequireTrustedApiEngine(allowedKeys);
                if (denied != null) return denied;
                if (!PlatformApiRuntimeRegistry.TryCreate(runtimeKey, out var runtime))
                    return new DosResult(0, null, $"平台接口运行时[{runtimeKey}]尚未注册。");
                var action = (request["Action"]?.ToString() ?? string.Empty).Trim();
                var parameters = request["Param"] as JObject
                                 ?? (request["Param"] == null
                                     ? new JObject()
                                     : JObject.FromObject(request["Param"]));
                return runtime.ExecuteAsync(action, parameters).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    V8TenantContext.Current?.OsClient,
                    "PlatformApiRuntime",
                    "TrustedAtomFailed",
                    "平台接口可信原子执行失败",
                    ex.ToString(),
                    3,
                    false,
                    V8TenantContext.Current?.ApiEngineKey);
                return new DosResult(0, null, "平台接口可信原子执行失败，请使用 TraceId 查询系统日志。");
            }
        }
    }
}
