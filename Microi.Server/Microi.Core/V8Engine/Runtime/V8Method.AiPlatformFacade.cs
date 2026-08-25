using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string AiPlatformAccountEngineKey = "platform-ai-account";

        private static readonly HashSet<string> AiPlatformPublicAtomActions =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "GetPlans",
                "GetModels"
            };

        private static readonly HashSet<string> AiPlatformAdministratorAtomActions =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "GetApiKeyList",
                "GetApiKeyBindUsers",
                "GetApiKeyCapacity",
                "PersistMiniMaxVideoFile"
            };

        private static readonly HashSet<string> AiPlatformAtomActions =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "AuthorizeAction",
                "GetPlans",
                "EnsureUserAiApiKey",
                "ResetUserAiApiKey",
                "GetRelayTokenSummary",
                "GetRelayTokenUsage",
                "GetQuotaWindow",
                "CreateAlipay",
                "ConsumeQuota",
                "GetApiKeyList",
                "GetApiKeyBindUsers",
                "GetApiKeyCapacity",
                "GenerateProfileAvatar",
                "CreateMiniMaxVideo",
                "GetMiniMaxVideoTask",
                "GetMiniMaxVideoFile",
                "PersistMiniMaxVideoFile",
                "GetModels"
            };

        private static readonly HashSet<string> AiPlatformEngineActions =
            new HashSet<string>(AiPlatformAtomActions, StringComparer.OrdinalIgnoreCase)
            {
                "GetSubscription",
                "CreateOrder",
                "GetOrders",
                "GetOrderStatus"
            };

        /// <summary>
        /// 仅供 platform-ai-account 调用。接口引擎负责普通业务编排，本方法
        /// 对动作、可信租户和可信身份重新校验后，才进入 Microi.AI 插件原子。
        /// </summary>
        public DosResult ManageAiPlatform(dynamic dynamicParam)
        {
            var engineDenied = RequireTrustedApiEngine(AiPlatformAccountEngineKey);
            if (engineDenied != null) return engineDenied;

            try
            {
                var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var action = request["Action"]?.ToString()?.Trim() ?? string.Empty;
                if (!AiPlatformAtomActions.Contains(action))
                    return new DosResult(0, null, "不支持的 AI 平台受信原子动作。");

                var authorizationTarget = string.Equals(
                    action,
                    "AuthorizeAction",
                    StringComparison.OrdinalIgnoreCase)
                    ? request["TargetAction"]?.ToString()?.Trim() ?? string.Empty
                    : action;
                if (!AiPlatformEngineActions.Contains(authorizationTarget)
                    || string.Equals(
                        authorizationTarget,
                        "AuthorizeAction",
                        StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult(0, null, "不支持的 AI 平台授权动作。");
                }

                var allowAnonymous = AiPlatformPublicAtomActions.Contains(action);
                var identityDenied = ResolveAiPlatformIdentity(
                    allowAnonymous,
                    out var osClient,
                    out var currentUser);
                if (identityDenied != null) return identityDenied;

                if (AiPlatformAdministratorAtomActions.Contains(authorizationTarget))
                {
                    if (currentUser == null
                        || UserAccessKeySecurity.IsSession(currentUser)
                        || !PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                            osClient,
                            currentUser))
                    {
                        return new DosResult(
                            0,
                            null,
                            "只有当前租户平台管理员可以执行该 AI 平台动作，访问密钥会话不允许使用。");
                    }
                }

                if (string.Equals(action, "AuthorizeAction", StringComparison.OrdinalIgnoreCase))
                    return new DosResult(1);

                var runtime = MicroiEngine.TryGetService<IAiPlatformRuntime>();
                if (runtime == null)
                    return new DosResult(0, null, "AI 平台插件尚未安装或未启动。");

                request = (JObject)request.DeepClone();
                foreach (var untrustedName in new[]
                         {
                             "Action", "OsClient", "_OsClient", "CurrentUser", "_CurrentUser",
                             "UserId", "UserName", "ApiKey", "Endpoint", "ServerInternalCall"
                         })
                {
                    foreach (var property in request.Properties()
                                 .Where(item => string.Equals(
                                     item.Name,
                                     untrustedName,
                                     StringComparison.OrdinalIgnoreCase))
                                 .ToList())
                    {
                        property.Remove();
                    }
                }

                return runtime.ExecuteAsync(osClient, action, request, currentUser)
                    .ConfigureAwait(false).GetAwaiter().GetResult()
                    ?? new DosResult(0, null, "AI 平台插件没有返回结果。");
            }
            catch (Exception)
            {
                // 插件异常可能包含供应商地址、请求细节或凭据上下文；租户可编辑
                // 接口引擎只接收稳定错误，不回显底层异常消息。
                return new DosResult(0, null, "AI 平台原子调用失败，请联系管理员。");
            }
        }

        private static DosResult ResolveAiPlatformIdentity(
            bool allowAnonymous,
            out string osClient,
            out JObject currentUser)
        {
            osClient = V8TenantContext.Current?.OsClient;
            currentUser = V8TrustedExecutionContext.CurrentUser;
            try
            {
                if (currentUser == null && !allowAnonymous)
                {
                    var token = DiyToken.GetCurrentToken(false)
                        .ConfigureAwait(false).GetAwaiter().GetResult();
                    if (token?.CurrentUser != null)
                    {
                        if (!osClient.DosIsNullOrWhiteSpace()
                            && !token.OsClient.DosIsNullOrWhiteSpace()
                            && !string.Equals(
                                osClient,
                                token.OsClient,
                                StringComparison.OrdinalIgnoreCase))
                        {
                            return new DosResult(0, null, "登录身份与接口引擎租户不匹配。");
                        }
                        currentUser = JObject.FromObject(token.CurrentUser);
                        if (osClient.DosIsNullOrWhiteSpace()) osClient = token.OsClient;
                    }
                }

                if (osClient.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "当前租户上下文不存在。");
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);

                if (!allowAnonymous
                    && (currentUser == null
                        || currentUser["Id"].Val<string>().DosIsNullOrWhiteSpace()))
                {
                    return new DosResult(1001, null, "登录身份已过期。");
                }

                if (!allowAnonymous && UserAccessKeySecurity.IsSession(currentUser))
                    return new DosResult(0, null, "访问密钥会话不能管理 AI 平台账户。");
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "校验 AI 平台访问身份失败：" + ex.Message);
            }
        }
    }
}
