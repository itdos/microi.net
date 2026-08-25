using System;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 旧 Controller 路由到官方 Managed 接口引擎的最小兼容桥。
    /// 引擎 Key 只能由服务端常量传入；请求不能覆盖路由或伪造当前用户。
    /// </summary>
    internal static class ManagedApiEngineCompatibility
    {
        private static readonly string[] UntrustedRoutingProperties =
        {
            "ApiEngineKey", "ApiKey", "ApiAddress", "_CurrentUser", "_InvokeType", "_IsAnonymous",
            "_TrustedExternalLoginProtocol", "_TrustedWeChatProtocol"
        };

        internal static JObject PrepareRequest(JObject request, JObject trustedCurrentUser = null)
        {
            var result = request?.DeepClone() as JObject ?? new JObject();
            foreach (var propertyName in UntrustedRoutingProperties)
            {
                foreach (var property in result.Properties().Where(item => string.Equals(
                             item.Name,
                             propertyName,
                             StringComparison.OrdinalIgnoreCase)).ToList())
                    property.Remove();
            }

            if (trustedCurrentUser != null)
                result["_CurrentUser"] = trustedCurrentUser.DeepClone();
            result["_InvokeType"] = InvokeType.Client.ToString();
            result["_IsAnonymous"] = trustedCurrentUser == null;
            return result;
        }

        internal static async Task<object> RunAsync(
            string managedApiEngineKey,
            JObject request,
            JObject trustedCurrentUser = null)
        {
            return await RunAsync(
                    managedApiEngineKey,
                    request,
                    trustedCurrentUser,
                    RunManagedEngineAsync)
                .ConfigureAwait(false);
        }

        /// <summary>
        /// 仅供已完成协议验签/一次性票据消费的 C# 网关调用。授权保存在宿主
        /// AsyncLocal 中并绑定租户与固定 Managed Key，不写入可伪造的 V8.Param。
        /// 目标引擎必须调用 V8.Method.RequireManagedProtocolContext 原子消费。可选当前
        /// 用户只能传入宿主已完成 Token/会话验证的权威快照，V8.Param 中的同名字段会被移除。
        /// </summary>
        internal static async Task<object> RunTrustedProtocolAsync(
            string managedApiEngineKey,
            string trustedOsClient,
            JObject request,
            JObject trustedCurrentUser = null)
        {
            if (managedApiEngineKey.DosIsNullOrWhiteSpace()
                || trustedOsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "官方协议接口引擎配置错误。");
            }

            string normalizedOsClient;
            try
            {
                normalizedOsClient = TenantConfigurationSecurity.NormalizeTenantId(trustedOsClient);
            }
            catch
            {
                return new DosResult(0, null, "可信协议租户无效。");
            }

            var trustedRequest = request?.DeepClone() as JObject ?? new JObject();
            trustedRequest["OsClient"] = normalizedOsClient;
            using (V8TrustedExecutionContext.EnterManagedProtocol(
                       managedApiEngineKey,
                       normalizedOsClient))
            {
                return await RunAsync(
                        managedApiEngineKey,
                        trustedRequest,
                        trustedCurrentUser)
                    .ConfigureAwait(false);
            }
        }

        internal static async Task<object> RunAsync(
            string managedApiEngineKey,
            JObject request,
            JObject trustedCurrentUser,
            Func<string, JObject, JObject, Task<object>> runManagedEngine)
        {
            if (managedApiEngineKey.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "官方接口引擎配置错误。");
            if (runManagedEngine == null)
                return new DosResult(0, null, "官方接口引擎执行器不可用。");

            try
            {
                var result = await runManagedEngine(
                        managedApiEngineKey,
                        PrepareRequest(request, trustedCurrentUser),
                        trustedCurrentUser)
                    .ConfigureAwait(false);
                return result ?? new DosResult(0, null,
                    $"官方接口引擎 {managedApiEngineKey} 未返回结果，请升级包含该资源的官方应用。");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(
                    $"Microi：【官方接口引擎兼容路由】{managedApiEngineKey} 调用失败：{ex.GetType().Name}");
                return new DosResult(0, null,
                    $"官方接口引擎 {managedApiEngineKey} 不可用，请安装或升级包含该资源的官方应用。");
            }
        }

        private static async Task<object> RunManagedEngineAsync(
            string managedApiEngineKey,
            JObject request,
            JObject trustedCurrentUser)
        {
            return await MicroiEngine.ManagedCompatibilityApiEngine.RunManagedCompatibilityAsync(
                    managedApiEngineKey,
                    request,
                    trustedCurrentUser)
                .ConfigureAwait(false);
        }
    }
}
