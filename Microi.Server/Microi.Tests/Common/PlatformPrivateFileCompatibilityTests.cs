using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class PlatformPrivateFileCompatibilityTests
{
    [Fact]
    public async Task ManagedCompatibilityBridge_StripsSpoofedRoutingAndFailsClosed()
    {
        var trustedUser = new JObject { ["Id"] = "trusted-user", ["Level"] = 1 };
        var request = new JObject
        {
            ["ApiEngineKey"] = "attacker-engine",
            ["apiaddress"] = "/apiengine/attacker",
            ["_CURRENTUSER"] = new JObject { ["Id"] = "attacker" },
            ["_InvokeType"] = "Server",
            ["OsClient"] = "tenant-a",
            ["FilePathName"] = "/tenant-a/private/a.png"
        };

        string observedKey = null;
        JObject observedRequest = null;
        JObject observedUser = null;
        var failed = await ManagedApiEngineCompatibility.RunAsync(
            "platform-private-file-url",
            request,
            trustedUser,
            (key, normalized, user) =>
            {
                observedKey = key;
                observedRequest = normalized;
                observedUser = user;
                throw new InvalidOperationException("engine unavailable");
            });

        Assert.Equal("platform-private-file-url", observedKey);
        Assert.Null(observedRequest?["ApiEngineKey"]);
        Assert.Null(observedRequest?["apiaddress"]);
        Assert.Equal("trusted-user", observedRequest?["_CurrentUser"]?["Id"]?.ToString());
        Assert.Equal("Client", observedRequest?["_InvokeType"]?.ToString());
        Assert.False(observedRequest?["_IsAnonymous"]?.Value<bool>());
        Assert.Same(trustedUser, observedUser);
        var denied = Assert.IsType<DosResult>(failed);
        Assert.Equal(0, denied.Code);
        Assert.Contains("platform-private-file-url", denied.Msg, StringComparison.Ordinal);
        Assert.Contains("不可用", denied.Msg, StringComparison.Ordinal);
    }

    [Fact]
    public void TrustedExecutionContext_BindsAndRestoresTenantWithIdentity()
    {
        var first = new JObject { ["Id"] = "user-a" };
        var second = new JObject { ["Id"] = "user-b" };

        using (V8TrustedExecutionContext.EnterForTenant(first, "tenant-a"))
        {
            Assert.Equal("user-a", V8TrustedExecutionContext.CurrentUser?["Id"]?.ToString());
            Assert.Equal("tenant-a", V8TrustedExecutionContext.CurrentOsClient);
            using (V8TrustedExecutionContext.Enter(second))
            {
                Assert.Equal("user-b", V8TrustedExecutionContext.CurrentUser?["Id"]?.ToString());
                Assert.Equal("tenant-a", V8TrustedExecutionContext.CurrentOsClient);
            }
            Assert.Equal("user-a", V8TrustedExecutionContext.CurrentUser?["Id"]?.ToString());
            Assert.Equal("tenant-a", V8TrustedExecutionContext.CurrentOsClient);
            using (V8TrustedExecutionContext.EnterForTenant(second, "tenant-b"))
            {
                Assert.Equal("user-b", V8TrustedExecutionContext.CurrentUser?["Id"]?.ToString());
                Assert.Equal("tenant-b", V8TrustedExecutionContext.CurrentOsClient);
            }
            Assert.Equal("user-a", V8TrustedExecutionContext.CurrentUser?["Id"]?.ToString());
            Assert.Equal("tenant-a", V8TrustedExecutionContext.CurrentOsClient);
        }
        Assert.Null(V8TrustedExecutionContext.CurrentUser);
        Assert.Null(V8TrustedExecutionContext.CurrentOsClient);
    }

    [Fact]
    public void LegacyHdfsRoutes_DelegateOnlyToFixedManagedPrivateFileEngine()
    {
        var root = FindRepositoryRoot();
        var hdfsSource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "LegacyMobileCompatibilityController.cs"));
        var method = ExtractMethod(
            hdfsSource,
            "public async Task<JsonResult> GetPrivateFileUrl");

        Assert.Contains(
            "PlatformPrivateFileUrlEngineKey = \"platform-private-file-url\"",
            hdfsSource,
            StringComparison.Ordinal);
        Assert.Contains("DiyToken.GetCurrentToken", method, StringComparison.Ordinal);
        Assert.Contains("GetLegacyClientUserFromToken", method, StringComparison.Ordinal);
        Assert.Contains("ManagedApiEngineCompatibility.RunAsync", method, StringComparison.Ordinal);
        Assert.Contains("PlatformPrivateFileUrlEngineKey", method, StringComparison.Ordinal);
        Assert.Contains("JObject.FromObject(param)", method, StringComparison.Ordinal);
        Assert.DoesNotContain("AuthorizePrivateFileRead", method, StringComparison.Ordinal);
        Assert.DoesNotContain("MicroiEngine.HDFS.GetPrivateFileUrl", method, StringComparison.Ordinal);
        Assert.DoesNotContain("NormalizeFilePaths", method, StringComparison.Ordinal);
        Assert.Contains("仅用于兼容旧版吾码 PC / UniApp / 定制移动端", hdfsSource, StringComparison.Ordinal);
        Assert.Contains("本 Controller 及全部历史地址可能整体删除", hdfsSource, StringComparison.Ordinal);

        var facadeSource = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "V8Engine",
            "Runtime",
            "V8Method.PlatformRuntimeFacade.cs"));
        var facade = ExtractMethod(
            facadeSource,
            "public DosResult GetAuthorizedPrivateFileUrl");
        Assert.Contains("V8TrustedExecutionContext.CurrentUser", facade, StringComparison.Ordinal);
        Assert.Contains("V8TrustedExecutionContext.CurrentOsClient", facade, StringComparison.Ordinal);
        Assert.Contains("DiyToken.GetCurrentToken(false)", facade, StringComparison.Ordinal);
        Assert.Contains("PrivateFileAccessAuthorization.AuthorizeAsync", facade, StringComparison.Ordinal);
        Assert.Contains("MicroiEngine.HDFS.GetPrivateFileUrl", facade, StringComparison.Ordinal);
    }

    [Fact]
    public void PrivateFileAuditLinks_UseCanonicalTenantQuery_AndKeepConflictCheckedLegacyRead()
    {
        var root = FindRepositoryRoot();
        var linkSource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Services", "PrivateFileAuditLinkService.cs"));
        var controllerSource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "HDFSController.PrivateFileAudit.cs"));

        Assert.Contains("OpenPrivateFile?OsClient=", linkSource, StringComparison.Ordinal);
        Assert.DoesNotContain("OpenPrivateFile?o=", linkSource, StringComparison.Ordinal);
        Assert.Contains("TenantConfigurationSecurity.NormalizeTenantId(param.OsClient)", linkSource, StringComparison.Ordinal);
        Assert.Contains("[FromQuery(Name = \"OsClient\")]", controllerSource, StringComparison.Ordinal);
        Assert.Contains("[FromQuery(Name = \"o\")]", controllerSource, StringComparison.Ordinal);
        Assert.Contains("TryResolvePrivateFileAuditTenant", controllerSource, StringComparison.Ordinal);
        Assert.Contains("!string.Equals(canonical, legacy", controllerSource, StringComparison.Ordinal);
        Assert.Contains("CacheTenant.Cache(tenant)", controllerSource, StringComparison.Ordinal);
    }

    private static string ExtractMethod(string source, string methodSignature)
    {
        var nameIndex = source.IndexOf(methodSignature, StringComparison.Ordinal);
        Assert.True(nameIndex >= 0, $"未找到方法 {methodSignature}");
        var start = source.IndexOf('{', nameIndex);
        Assert.True(start >= 0, $"未找到方法 {methodSignature} 的方法体");
        var depth = 0;
        for (var index = start; index < source.Length; index++)
        {
            if (source[index] == '{') depth++;
            else if (source[index] == '}' && --depth == 0) return source[start..(index + 1)];
        }
        throw new InvalidOperationException($"方法 {methodSignature} 的方法体不完整");
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Client")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}
