using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>V8 原子入口的可信上下文与配置校验。业务设备权限仍由白名单中的控制接口引擎校验。</summary>
    public static class IoTCommandRuntime
    {
        public static async Task<DosResult> SendAsync(JObject request)
        {
            try
            {
                var context = V8TenantContext.Current;
                if (context == null || string.IsNullOrWhiteSpace(context.ApiEngineKey))
                    return new DosResult(0, null, "IoT.Send 只能由已授权的后端接口引擎调用。");
                var tenant = TenantConfigurationSecurity.NormalizeTenantId(context.OsClient);
                // 不信任 V8.CurrentUser/Param。后台任务只接受由可信 runner 建立的身份作用域。
                var user = V8TrustedExecutionContext.CurrentUser;
                if (user == null || !string.Equals(V8TrustedExecutionContext.CurrentOsClient, tenant, StringComparison.OrdinalIgnoreCase))
                {
                    var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                    if (token?.CurrentUser == null || !string.Equals(token.OsClient, tenant, StringComparison.OrdinalIgnoreCase))
                        return new DosResult(0, null, "IoT.Send 需要当前租户的有效登录身份。");
                    user = token.CurrentUser;
                }
                var userId = user.Value<string>("Id");
                if (string.IsNullOrWhiteSpace(userId)) return new DosResult(0, null, "IoT.Send 缺少可信用户身份。");
                var model = OsClientExtend.GetClient(tenant).OsClientModel;
                if (model?["TcpIngressEnable"]?.ToString() == "0") return new DosResult(0, null, "TCP 已关闭。");
                var root = JObject.Parse(model?["TcpIngressRulesJson"]?.ToString() ?? "{}");
                var policy = IoTDownlinkPolicy.Parse(root);
                if (policy == null || !string.Equals(policy.OsClient, tenant, StringComparison.OrdinalIgnoreCase)
                    || !policy.SendApiEngineKeys.Contains(context.ApiEngineKey, StringComparer.OrdinalIgnoreCase))
                    return new DosResult(0, null, "当前接口引擎未获 IoT 下行授权。");
                ValidateRequest(request, policy, out var device, out var command, out var frame, out var expire);
                var store = CreateStore(tenant);
                var result = await store.EnqueueAsync(tenant, device, command, frame, context.ApiEngineKey, userId, expire, policy).ConfigureAwait(false);
                return new DosResult(result.Value<int>("Code"), result["Data"], result.Value<string>("Msg"));
            }
            catch (ArgumentException ex) { return new DosResult(0, null, ex.Message); }
            catch { return new DosResult(0, null, "IoT 下行不可用或提交结果未知；请使用相同 CommandId 查询/重试，禁止换号重发。"); }
        }

        public static IIoTCommandStore CreateStore(string tenant) =>
            new RedisIoTCommandStore(MicroiEngine.CacheTenant.Cache(tenant).Db(tenant));

        public static void ValidateRequest(JObject request, IoTDownlinkPolicy policy,
            out string device, out string command, out string frame, out int expire)
        {
            if (request == null || request.Properties().Any(p => !new[] { "DeviceId", "CommandId", "FrameHex", "ExpireSeconds" }.Contains(p.Name, StringComparer.Ordinal)))
                throw new ArgumentException("IoT.Send 只接受 DeviceId、CommandId、FrameHex、ExpireSeconds。");
            if (request["DeviceId"]?.Type != JTokenType.String || request["CommandId"]?.Type != JTokenType.String || request["FrameHex"]?.Type != JTokenType.String)
                throw new ArgumentException("DeviceId、CommandId、FrameHex 必须为字符串。");
            device = policy.NormalizeDeviceId(request.Value<string>("DeviceId"));
            command = request.Value<string>("CommandId");
            if (!Regex.IsMatch(command, @"\A[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\z")) throw new ArgumentException("CommandId 格式无效。");
            frame = IoTDownlinkPolicy.ToHex(policy.ValidateDownlink(device, request.Value<string>("FrameHex")));
            expire = IoTDownlinkPolicy.Number(request, "ExpireSeconds", Math.Min(30, policy.MaxExpireSeconds), 1, policy.MaxExpireSeconds);
        }
    }
}
