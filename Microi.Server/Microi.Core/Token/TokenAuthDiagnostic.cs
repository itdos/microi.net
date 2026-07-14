using System;

namespace Microi.net
{
    /// <summary>
    /// Token 失效诊断。仅用于向调用端解释失效原因，不能作为鉴权依据。
    /// </summary>
    public sealed class TokenAuthDiagnostic
    {
        public string ReasonCode { get; set; } = "Unknown";
        public string UserMessage { get; set; } = "当前登录身份已失效，请重新登录。";
        public string AppendMsg { get; set; } = "";
        public string TokenOsClient { get; set; } = "";
        public string RequestOsClient { get; set; } = "";
        public string ClientType { get; set; } = "";
        public string Did { get; set; } = "";
        public string IssuedAt { get; set; } = "";
        public string ExpiresAt { get; set; } = "";
        public long? ExpiredSeconds { get; set; }
        public string ExpiredFor { get; set; } = "";
        public bool IsExpired { get; set; }
        public bool IsTenantMismatch { get; set; }

        public void SetExpired(DateTime expiresAtUtc, DateTime? nowUtc = null)
        {
            var utcNow = nowUtc ?? DateTime.UtcNow;
            var elapsed = utcNow - expiresAtUtc;
            if (elapsed < TimeSpan.Zero)
            {
                elapsed = TimeSpan.Zero;
            }

            IsExpired = true;
            ExpiresAt = expiresAtUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");
            ExpiredSeconds = Math.Max(0L, (long)Math.Floor(elapsed.TotalSeconds));
            ExpiredFor = DiyToken.DescribeExpiredDuration(elapsed);
        }
    }
}
