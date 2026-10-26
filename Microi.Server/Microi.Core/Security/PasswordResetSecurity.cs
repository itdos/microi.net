using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>短信改密与历史编码修复共用的纯校验，绝不将恢复出的明文交给 V8。</summary>
    internal static class PasswordResetSecurity
    {
        internal static string ReadRegistrationPassword(JToken value)
        {
            var password = value == null || value.Type == JTokenType.Null ? "" : value.ToString();
            // 注册、改密、登录使用相同原始字节；超限显式拒绝，禁止截断后生成另一份密码。
            if (password.Length > 200 || (password.Length > 0 && string.IsNullOrWhiteSpace(password)))
                throw new ArgumentException("注册密码不能为空白且不能超过200位。");
            return password;
        }

        internal static string Validate(JObject request)
        {
            var phone = request?["Phone"]?.ToString()?.Trim() ?? "";
            var code = request?["SmsCode"]?.ToString()?.Trim() ?? "";
            // 密码是用户原始输入，不能 trim 或截断后再存储。
            var password = request?["NewPassword"]?.ToString() ?? "";
            var confirmation = request?["ConfirmPassword"]?.ToString();
            if (!Regex.IsMatch(phone, "^1[0-9]{10}$")) return "PasswordResetInvalidPhone";
            if (!Regex.IsMatch(code, "^[0-9]{4,8}$")) return "PasswordResetInvalidSms";
            if (password.Length < 6 || password.Length > 32 || string.IsNullOrWhiteSpace(password))
                return "PasswordResetInvalidPassword";
            if (confirmation != null && !string.Equals(password, confirmation, StringComparison.Ordinal))
                return "PasswordResetConfirmationMismatch";
            return null;
        }

        internal static bool IsResettable(JObject user)
        {
            // 与真实登录一致：只有 State=1 启用；State=2 也是停用，改密不得绕过。
            return user != null && !string.IsNullOrWhiteSpace(user["Id"]?.ToString())
                && int.TryParse(user["State"]?.ToString(), out var state) && state == 1
                && user["IsDeleted"]?.ToString() != "1";
        }

        internal static string HashVerifiedPassword(long proofStatus, string password)
        {
            // 昂贵的 PBKDF2 只能在短信证明消费成功后执行，错误码不能触发匿名 CPU 放大。
            if (proofStatus != 1) throw new InvalidOperationException("SmsProofRequired");
            return PasswordHashSecurity.HashPassword(password);
        }

        internal static string[] ReadRepairUserIds(JObject request)
        {
            if (!(request?["UserIds"] is JArray values) || values.Count < 1 || values.Count > 20
                || values.Any(value => value.Type != JTokenType.String
                    || !Regex.IsMatch(value.ToString(), "^[A-Za-z0-9-]{1,80}$")))
                return null;
            return values.Values<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        }

        internal static string Classify(JObject user)
        {
            if (user == null) return "NotFound";
            if (!IsResettable(user)) return "Inactive";
            var stored = user["Pwd"]?.ToString();
            if (!PasswordHashSecurity.IsSupportedEncoding(user["PwdEncode"]?.ToString()))
                return "OtherEncoding";
            // 自描述哈希即使损坏也不得回退解密，否则可能削弱现有登录边界。
            if (PasswordHashSecurity.IsRecognizedHash(stored)) return "HashPresent";
            return SysUserLogic.DecodeStoredPassword(stored, "DES").Code == 1
                ? "LegacyCipherWithHashEncoding" : "UnsupportedMaterial";
        }

        internal static string CreateRepairedHash(JObject user)
        {
            if (Classify(user) != "LegacyCipherWithHashEncoding") return null;
            var legacy = SysUserLogic.DecodeStoredPassword(user["Pwd"]?.ToString(), "DES");
            return legacy.Code == 1 ? PasswordHashSecurity.HashPassword(legacy.Data) : null;
        }
    }
}
