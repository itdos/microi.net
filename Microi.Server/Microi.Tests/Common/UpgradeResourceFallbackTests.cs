using System.Reflection;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class UpgradeResourceFallbackTests
{
    [Fact]
    public void OfficialResponse_InvalidJson_ReturnsDiagnosticWithoutThrowing()
    {
        var method = GetPrivateStaticMethod("TryParseOfficialResourceResponse");
        var arguments = new object?[]
        {
            "app.microi.sys_user.json",
            "{not-json",
            null,
            null
        };

        object? result = null;
        var exception = Record.Exception(() => result = method.Invoke(null, arguments));

        Assert.Null(exception);
        Assert.False(Assert.IsType<bool>(result));
        Assert.Equal(string.Empty, arguments[2]);
        Assert.Contains("不是标准JSON响应", Assert.IsType<string>(arguments[3]));
    }

    [Theory]
    [InlineData("{\"Code\":\"not-a-number\"}", "返回升级资源")]
    [InlineData("{\"Code\":1,\"Data\":\"not-an-object\"}", "缺少标准Data对象")]
    public void OfficialResponse_InvalidEnvelopeTypes_ReturnDiagnosticWithoutThrowing(
        string response,
        string expectedDiagnostic)
    {
        var method = GetPrivateStaticMethod("TryParseOfficialResourceResponse");
        var arguments = new object?[]
        {
            "app.microi.sys_user.json",
            response,
            null,
            null
        };

        object? result = null;
        var exception = Record.Exception(() => result = method.Invoke(null, arguments));

        Assert.Null(exception);
        Assert.False(Assert.IsType<bool>(result));
        Assert.Equal(string.Empty, arguments[2]);
        Assert.Contains(expectedDiagnostic, Assert.IsType<string>(arguments[3]));
    }

    [Fact]
    public void OfficialResponse_ValidEnvelope_ReturnsContentWithoutThrowing()
    {
        var method = GetPrivateStaticMethod("TryParseOfficialResourceResponse");
        const string content = "{\"PackageInfo\":{\"Name\":\"系统账号\"}}";
        var response = new JObject
        {
            ["Code"] = 1,
            ["Data"] = new JObject
            {
                ["ResourceName"] = "app.microi.sys_user.json",
                ["Content"] = content
            }
        };
        var arguments = new object?[]
        {
            "app.microi.sys_user.json",
            response.ToString(Formatting.None),
            null,
            null
        };

        var succeeded = Assert.IsType<bool>(method.Invoke(null, arguments));

        Assert.True(succeeded);
        Assert.Equal(content, arguments[2]);
        Assert.Equal(string.Empty, arguments[3]);
    }

    [Fact]
    public void OnlineContractDrift_ReturnsDiagnostic_WhileBundledValidationStillFailsClosed()
    {
        var resources = LoadBundledResources();
        var package = JObject.Parse(resources["app.microi.sys_user.json"]);
        var managed = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-sys-user-admin");
        managed["ApiV8Code"] = managed["ApiV8Code"]?.ToString()
            .Replace("OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1", "MISSING_OFFICIAL_NOTICE");
        var packageText = package.ToString(Formatting.None);

        var getError = GetPrivateStaticMethod("GetResourceContentValidationError");
        var onlineException = Record.Exception(() => getError.Invoke(
            null,
            new object[] { "app.microi.sys_user.json", packageText }));
        Assert.Null(onlineException);
        var diagnostic = Assert.IsType<string>(getError.Invoke(
            null,
            new object[] { "app.microi.sys_user.json", packageText }));
        Assert.Contains("app.microi.sys_user.json", diagnostic);
        Assert.Contains("PackageInfo.Version", diagnostic);

        var validateBundled = GetPrivateStaticMethod("ValidateResourceContent");
        var hardFailure = Assert.Throws<TargetInvocationException>(() => validateBundled.Invoke(
            null,
            new object[] { "app.microi.sys_user.json", packageText }));
        Assert.IsType<InvalidOperationException>(hardFailure.InnerException);
    }

    [Fact]
    public void UpgradeFailureSummary_IsQueuedToStructuredSystemLog()
    {
        var upgradeSource = File.ReadAllText(Path.Combine(
            FindServerRoot(),
            "Microi.Upgrade",
            "Upgrade.cs"));
        var coordinatorSource = File.ReadAllText(Path.Combine(
            FindServerRoot(),
            "Microi.Upgrade",
            "TenantUpgradeCoordinator.cs"));

        Assert.Contains("TenantMigrationFailed", upgradeSource);
        Assert.Contains("MicroiEngine.QueueSystemLog", upgradeSource);
        Assert.Contains("系统日志队列暂不可用，失败详情已保留在控制台日志", upgradeSource);
        Assert.Contains("TenantUpgradeFailed", coordinatorSource);
        Assert.Contains("MicroiEngine.QueueSystemLog", coordinatorSource);
        Assert.Contains("协调器失败详情已保留在控制台日志", coordinatorSource);
    }

    private static MethodInfo GetPrivateStaticMethod(string name)
    {
        var method = typeof(UpgradeAppStore).GetMethod(
            name,
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return method!;
    }

    private static IReadOnlyDictionary<string, string> LoadBundledResources()
    {
        var method = GetPrivateStaticMethod("LoadBundledResources");
        return Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(method.Invoke(null, null));
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(current.FullName, "Microi.Upgrade", "Microi.Upgrade.csproj")))
            {
                return current.FullName;
            }
            var nested = Path.Combine(current.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(nested, "Microi.Upgrade", "Microi.Upgrade.csproj")))
            {
                return nested;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("找不到 Microi.Server 根目录。");
    }
}
