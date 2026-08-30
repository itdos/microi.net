using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// License 申请验证码的租户策略与共享一次性校验。
    /// 验证码不能保存在 API 进程内存中，否则获取和提交落到不同节点时会必然失败。
    /// </summary>
    public static class LicenseCaptchaSecurity
    {
        public const string CaptchaIdPrefix = "license:Captcha:";
        private const string CacheCategory = "LicenseCaptcha";

        /// <summary>
        /// 系统配置缺失或读取失败时默认启用验证码，避免匿名申请被意外放开。
        /// </summary>
        public static bool IsCaptchaRequired(object sysConfig)
        {
            return DynamicHelper.GetDynamicBoolValue(sysConfig, "EnableCaptcha", true);
        }

        public static string CreateCaptchaId()
        {
            return CaptchaIdPrefix + Guid.NewGuid().ToString("N");
        }

        /// <summary>
        /// 只接受本协议生成的固定格式 ID，禁止匿名调用者构造任意 Redis Key。
        /// </summary>
        public static bool TryBuildCacheKey(string osClient, string captchaId, out string cacheKey)
        {
            cacheKey = "";
            var tenant = (osClient ?? "").Trim();
            var id = (captchaId ?? "").Trim();
            if (tenant.Length == 0
                || !id.StartsWith(CaptchaIdPrefix, StringComparison.Ordinal)
                || id.Length != CaptchaIdPrefix.Length + 32)
            {
                return false;
            }

            var suffix = id.Substring(CaptchaIdPrefix.Length);
            if (!Guid.TryParseExact(suffix, "N", out var parsed))
            {
                return false;
            }

            cacheKey = $"Microi:{tenant}:{CacheCategory}:{parsed:N}";
            return true;
        }

        /// <summary>
        /// 仅保存验证码摘要；即使缓存被只读检查，也不会暴露验证码原文。
        /// </summary>
        public static async Task<bool> StoreAsync(
            IDatabase database,
            string osClient,
            string captchaId,
            string captchaValue,
            TimeSpan lifetime)
        {
            if (database == null) throw new ArgumentNullException(nameof(database));
            if (lifetime <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(lifetime));
            if (!TryBuildCacheKey(osClient, captchaId, out var cacheKey)
                || string.IsNullOrWhiteSpace(captchaValue))
            {
                return false;
            }

            var digest = ComputeDigest(captchaValue);
            try
            {
                return await database.StringSetAsync(
                        cacheKey,
                        Convert.ToBase64String(digest),
                        lifetime,
                        When.NotExists)
                    .ConfigureAwait(false);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(digest);
            }
        }

        /// <summary>
        /// Redis GETDEL 保证验证码无论正确与否都只能尝试一次，并支持多节点部署。
        /// </summary>
        public static async Task<bool> ValidateAndConsumeAsync(
            IDatabase database,
            string osClient,
            string captchaId,
            string captchaValue)
        {
            if (database == null) throw new ArgumentNullException(nameof(database));
            if (!TryBuildCacheKey(osClient, captchaId, out var cacheKey)
                || string.IsNullOrWhiteSpace(captchaValue))
            {
                return false;
            }

            var stored = await database.StringGetDeleteAsync(cacheKey).ConfigureAwait(false);
            if (!stored.HasValue)
            {
                return false;
            }

            byte[] expected;
            try
            {
                expected = Convert.FromBase64String(stored.ToString());
            }
            catch (FormatException)
            {
                return false;
            }

            var supplied = ComputeDigest(captchaValue);
            try
            {
                return expected.Length == supplied.Length
                    && CryptographicOperations.FixedTimeEquals(expected, supplied);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(expected);
                CryptographicOperations.ZeroMemory(supplied);
            }
        }

        private static byte[] ComputeDigest(string captchaValue)
        {
            var normalized = (captchaValue ?? "").Trim().ToUpperInvariant();
            using var sha256 = SHA256.Create();
            return sha256.ComputeHash(Encoding.UTF8.GetBytes(normalized));
        }
    }
}
