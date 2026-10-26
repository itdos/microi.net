using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class AuthenticationMessageTests
{
    [Theory]
    [InlineData("cn", "用户名或密码错误！")]
    [InlineData("zh-CN", "用户名或密码错误！")]
    [InlineData("en-US", "Incorrect username or password.")]
    [InlineData("zh-TW", "用戶名或密碼錯誤！")]
    public void LoginError_IsLocalizedBeforeTenantCacheLoads(string language, string expected)
    {
        Assert.Equal(expected, DiyMessage.GetLang("cold-cache-" + Guid.NewGuid(), "AccountOrPwdError", language));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("AccountOrPwdError")]
    public void MissingTenantTranslation_FallsBackWithoutOverwritingOtherTenantText(string? missing)
    {
        var tenant = "auth-message-" + Guid.NewGuid();
        try
        {
            DiyMessage.ReplaceTenantMessages(tenant, new Dictionary<string, JObject>
            {
                ["AccountOrPwdError"] = new() { ["ZhCN"] = "自定义认证失败", ["En"] = missing }
            });
            Assert.Equal("Incorrect username or password.", DiyMessage.GetLang(tenant, "AccountOrPwdError", "en"));
            Assert.Equal("自定义认证失败", DiyMessage.GetLang(tenant, "AccountOrPwdError", "cn"));
            Assert.Equal("Incorrect username or password.", DiyMessage.GetLangBundle(tenant, "en").Value<string>("AccountOrPwdError"));
            Assert.Equal("UnknownKey", DiyMessage.GetLang(tenant, "UnknownKey", "en"));
        }
        finally
        {
            DiyMessage.Msg.TryRemove(tenant, out _);
            DiyMessage.ClearSourceTextCache(tenant);
        }
    }

    [Theory]
    [InlineData("cn")]
    [InlineData("en-US")]
    [InlineData("zh-TW")]
    public void SmsResetOutcomes_AreHumanReadable(string language)
    {
        foreach (var key in new[] { "PasswordResetInvalidPhone", "PasswordResetInvalidSms", "PasswordResetInvalidPassword",
                     "PasswordResetConfirmationMismatch", "PasswordResetUserUnavailable", "PasswordResetSmsLimited",
                     "PasswordResetConflict", "PasswordResetFailed", "PasswordResetSuccess", "NoAuth" })
            Assert.NotEqual(key, DiyMessage.GetLang("cold-cache", key, language));
    }
}
