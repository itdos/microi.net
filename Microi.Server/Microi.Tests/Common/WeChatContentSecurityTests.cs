using System.Security.Cryptography;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

// 覆盖微信内容安全签名、回调解密、租户密钥隔离及前后端失败关闭链路。
public sealed class WeChatContentSecurityTests
{
    [Fact]
    public void CallbackSignature_IsVerifiedAndRejectsTampering()
    {
        const string token = "tenant-message-token";
        const string timestamp = "1785888000";
        const string nonce = "nonce-123";
        var signature = Signature(token, timestamp, nonce);

        Assert.True(WeChatContentSecurityService.VerifySignature(
            token, signature, timestamp, nonce));
        Assert.False(WeChatContentSecurityService.VerifySignature(
            token, signature, timestamp, nonce + "-changed"));
    }

    [Fact]
    public void SafeModeMessage_DecryptsAndChecksAppId()
    {
        const string appId = "wx0e661a2fc4f52530";
        const string xml = "<xml><trace_id>trace-1</trace_id><suggest>pass</suggest></xml>";
        var aesKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=');
        var encrypted = Encrypt(xml, aesKey, appId);

        Assert.Equal(xml, WeChatContentSecurityService.DecryptMessage(encrypted, aesKey, appId));
        Assert.Throws<WeChatContentSecurityException>(() =>
            WeChatContentSecurityService.DecryptMessage(encrypted, aesKey, "another-app"));
    }

    [Fact]
    public void MiniProgramDetection_RejectsUntrustedJwtPayload()
    {
        var context = new DefaultHttpContext();
        var forged = new JwtSecurityToken(claims: new[] { new Claim("ClientType", "WxMiniProgram") });
        context.Request.Headers.Authorization = "Bearer " + new JwtSecurityTokenHandler().WriteToken(forged);

        Assert.False(WeChatContentSecurityService.IsWeChatMiniProgramRequest(context));
    }

    [Theory]
    [InlineData("xjy", "", "xjy")]
    [InlineData("", "xjy", "xjy")]
    [InlineData("xjy", "XJY", "xjy")]
    public void CallbackTenant_SupportsSuffixAndOsClientQuery(
        string routeOsClient,
        string queryOsClient,
        string expected)
    {
        Assert.True(WeChatContentSecurityService.TryResolveCallbackTenant(
            routeOsClient,
            queryOsClient,
            out var actual));
        Assert.Equal(expected, actual, ignoreCase: true);
    }

    [Theory]
    [InlineData("", "")]
    [InlineData("xjy", "other")]
    [InlineData("../xjy", "")]
    public void CallbackTenant_RejectsMissingConflictingOrInvalidValues(
        string routeOsClient,
        string queryOsClient)
    {
        Assert.False(WeChatContentSecurityService.TryResolveCallbackTenant(
            routeOsClient,
            queryOsClient,
            out _));
    }

    [Fact]
    public void MiniProgramDetection_UsesExactActiveRedisSessionEntry()
    {
        const string token = "active-mini-program-token";
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer " + token;
        var currentToken = new CurrentToken
        {
            Token = token,
            AuthVersion = DiyToken.CurrentAuthVersion,
            Tokens = new List<TokensModel>
            {
                new()
                {
                    Token = token,
                    AuthVersion = DiyToken.CurrentAuthVersion,
                    ClientType = "WxMiniProgram"
                }
            }
        };

        Assert.True(WeChatContentSecurityService.IsWeChatMiniProgramRequest(context, currentToken));
    }

    [Fact]
    public void WeChatSecrets_AreTenantOwnedAndHiddenFromV8()
    {
        var source = new JObject
        {
            ["WeChatMiniProgramAppId"] = "wx-public-id",
            ["WeChatMiniProgramAppSecret"] = "secret-value",
            ["WeChatMiniProgramMessageToken"] = "token-value",
            ["WeChatMiniProgramAESKey"] = "aes-value"
        };

        var projection = TenantConfigurationSecurity.CreateV8Projection(source);

        Assert.Equal("wx-public-id", projection.Value<string>("WeChatMiniProgramAppId"));
        Assert.Null(projection["WeChatMiniProgramAppSecret"]);
        Assert.Null(projection["WeChatMiniProgramMessageToken"]);
        Assert.Null(projection["WeChatMiniProgramAESKey"]);
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("WeChatMiniProgramAppSecret"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("WeChatMiniProgramMessageToken"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("WeChatMiniProgramAESKey"));
        Assert.True(UserBehaviorAudit.IsSensitiveField("WeChatMiniProgramAESKey"));
    }

    [Fact]
    public void UploadAndProfileSources_KeepServerSideFailClosedGuards()
    {
        var root = FindRepositoryRoot();
        var hdfs = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "HDFSController.cs"));
        var user = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "SysUserController.cs"));
        var sdk = File.ReadAllText(Path.Combine(
            root, "microi.uniapp", "src", "utils", "microi.v8.js"));

        Assert.Contains("SubmitUploadedImagesAsync", hdfs, StringComparison.Ordinal);
        Assert.Contains("ValidateAvatarAsync", user, StringComparison.Ordinal);
        Assert.Contains("CheckProfileTextAsync", user, StringComparison.Ordinal);
        Assert.Contains("ContentSecurityReviewId", sdk, StringComparison.Ordinal);
        Assert.Contains("waitForContentSecurity", sdk, StringComparison.Ordinal);
        Assert.Contains(WeChatContentSecurityService.UnsafeContentMessage, sdk, StringComparison.Ordinal);
    }

    [Fact]
    public void CallbackSource_DelegatesBusinessLogicToManagedApiEngine()
    {
        var root = FindRepositoryRoot();
        var controller = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "WeChatContentSecurityController.cs"));
        var service = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Services", "WeChatContentSecurityService.cs"));

        Assert.Contains("Callback--OsClient--{routeOsClient}--", controller, StringComparison.Ordinal);
        Assert.Contains("FromQuery(Name = \"OsClient\")", controller, StringComparison.Ordinal);
        Assert.DoesNotContain("?o=", controller, StringComparison.Ordinal);
        Assert.Contains(WeChatContentSecurityService.CallbackCoreApiEngineKey, service, StringComparison.Ordinal);
        Assert.Contains("MicroiEngine.ApiEngine.RunAsync", service, StringComparison.Ordinal);
        Assert.DoesNotContain("CallbackLock", service, StringComparison.Ordinal);
    }

    private static string Signature(params string[] values)
    {
        var text = string.Concat(values.OrderBy(value => value, StringComparer.Ordinal));
        return Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();
    }

    private static string Encrypt(string message, string encodingAesKey, string appId)
    {
        var key = Convert.FromBase64String(encodingAesKey + "=");
        var messageBytes = Encoding.UTF8.GetBytes(message);
        var appIdBytes = Encoding.UTF8.GetBytes(appId);
        var plain = new List<byte>();
        plain.AddRange(RandomNumberGenerator.GetBytes(16));
        plain.Add((byte)(messageBytes.Length >> 24));
        plain.Add((byte)(messageBytes.Length >> 16));
        plain.Add((byte)(messageBytes.Length >> 8));
        plain.Add((byte)messageBytes.Length);
        plain.AddRange(messageBytes);
        plain.AddRange(appIdBytes);
        var padding = 32 - plain.Count % 32;
        plain.AddRange(Enumerable.Repeat((byte)padding, padding));

        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = key.Take(16).ToArray();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.None;
        using var encryptor = aes.CreateEncryptor();
        return Convert.ToBase64String(encryptor.TransformFinalBlock(plain.ToArray(), 0, plain.Count));
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(directory.FullName, "microi.uniapp")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
