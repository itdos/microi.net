using System;
using System.Linq;
using System.IO;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>推广只获得限定的统计读取授权，不提升为平台管理员身份。</summary>
    public static class SaasPromotionSecurity
    {
        public const string ManagerEngine = "platform-saas-promotion";
        public const string PublicEngine = "platform-saas-public-trial";
        public const string WorkerEngine = "platform-saas-public-trial-worker";
        public const string PublicApp = "microi-platform-service";
        public const string PublicRoute = "/saas-trial";

        public static bool IsPublicTrialRoute(string osClient, string appKey, string route, string mainOsClient) =>
            !string.IsNullOrWhiteSpace(mainOsClient)
            && string.Equals(osClient, mainOsClient, StringComparison.OrdinalIgnoreCase)
            && string.Equals(appKey, PublicApp, StringComparison.Ordinal)
            && string.Equals(route, PublicRoute, StringComparison.Ordinal);

        public static bool ValidRequestId(string value) => Guid.TryParseExact(value, "D", out _) || Guid.TryParseExact(value, "N", out _);

        /// <summary>非人类任务主体仍写入通用 UserId(varchar36)，使用目的前缀和紧凑 UUID 保持 35 字符。</summary>
        public static string PublicTrialPrincipalId(string requestId) => "pt:" + Guid.Parse(requestId).ToString("N");

        /// <summary>保留签名票据中的 ISO 时间字符串，避免自动 DateTime 转换后丢失 Z 或时区偏移。</summary>
        internal static JObject ParseCapabilityPayload(string json)
        {
            using var reader = new JsonTextReader(new StringReader(json)) { DateParseHandling = DateParseHandling.None };
            return JObject.Load(reader);
        }

        /// <summary>仅用于 DiyToken.GetCurrentToken 返回的可信快照；URL 租户标识不构成登录身份。</summary>
        public static bool HasAuthenticatedSession(CurrentToken session) =>
            session != null && !string.IsNullOrWhiteSpace(session.Token)
            && !string.IsNullOrWhiteSpace(session.OsClient)
            && !string.IsNullOrWhiteSpace(session.CurrentUser?["Id"]?.ToString());

        public static bool IsPublicTrialEnabled(string osClient)
        {
            if (!string.Equals(osClient, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase)) return false;
            try { return Flag(V8Method.ReadSaasPromotionMainConfiguration()["SaasPublicTrialEnabled"]); }
            catch { return false; }
        }
        public static bool ValidTenantKey(string value) => Regex.IsMatch(value ?? "", "^[A-Za-z][A-Za-z0-9_-]{2,49}$");
        /// <summary>公开空库通过主租户启动地址访问，不伪造或自动绑定客户的独立域名。</summary>
        public static bool TryResolveProvisioningDomain(string tenantKey, string requestedDomain, bool publicTrial, out string domain)
        {
            domain = (requestedDomain ?? "").Trim();
            if (publicTrial) return domain.Length == 0;
            if (domain.Length == 0) domain = tenantKey + ".microi.net";
            return Regex.IsMatch(domain, @"^[A-Za-z0-9.-]+$") && !domain.Contains("..");
        }
        /// <summary>允许常见电话分隔符，但不能把全空白或符号当作有效联系方式。</summary>
        public static bool ValidContactPhone(string value) => Regex.IsMatch(value ?? "", "^[0-9+ ()-]{6,32}$")
            && value.Count(char.IsDigit) >= 6 && value.Count(char.IsDigit) <= 15;
        public static bool Flag(JToken value) => value != null && new[] { "1", "true" }.Contains(value.ToString().Trim().ToLowerInvariant());
        internal static bool CanResumePublicTrialTask(BackgroundTaskRecord task) => task != null
            && task.ApiEngineKey == WorkerEngine && task.Status == "Failed" && !task.CancelRequested
            && task.BusinessTable == "mci_saas_referral_link" && !string.IsNullOrWhiteSpace(task.BusinessId)
            && task.AttemptCount >= 0 && task.AttemptCount < task.MaxAttempts
            && task.ExecutionCount >= 1 && task.ExecutionCount < task.MaxAttempts && task.MaxAttempts <= 3;
        public static bool CanReadTenant(bool all, string actorId, JObject tenant) => tenant != null
            && (all || (!string.IsNullOrWhiteSpace(actorId) && string.Equals(actorId,
                tenant["ReferralUserId"]?.ToString(), StringComparison.OrdinalIgnoreCase)));

        public static string TrialState(JObject tenant, DateTime utcNow)
        {
            if (!Flag(tenant?["IsEnable"])) return "Disabled";
            var state = tenant?["PromotionStage"]?.ToString();
            if (state == "Converted") return "Converted";
            if (!DateTime.TryParse(tenant?["TrialEndTime"]?.ToString(), out var expiry)) return "Unclassified";
            expiry = DateTime.SpecifyKind(expiry, DateTimeKind.Utc);
            return expiry <= utcNow ? "Expired" : expiry <= utcNow.AddDays(3) ? "Expiring" : "Trial";
        }

        public static JObject SafeTrialProgress(JObject result)
        {
            var data = result?["Data"] as JObject ?? new JObject();
            var safe = new JObject();
            foreach (var name in new[] { "OsClient", "SystemName", "AdminAccount", "LaunchUrl", "DomainBindingStatus" })
                if (data[name] != null) safe[name] = data[name].DeepClone();
            return safe;
        }
    }
}
