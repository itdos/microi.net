using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class UpgradeDiagnosticsTests
{
    [Fact]
    public void RuntimeInvariantFailure_ReportsStageRootTypeAndRecoveryWithoutSecrets()
    {
        var method = typeof(MicroiUpgrade).GetMethod(
            "BuildUpgradeFailureDiagnostic",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);

        var error = new InvalidOperationException(
            "外围失败",
            new ArgumentException("连接失败 Password=top-secret; Token=token-secret"));
        var diagnostic = Assert.IsType<string>(method!.Invoke(
            null,
            new object[] { "接口引擎字段元数据兼容", error }));

        Assert.Contains("阶段=接口引擎字段元数据兼容", diagnostic, StringComparison.Ordinal);
        Assert.Contains("异常类型=ArgumentException", diagnostic, StringComparison.Ordinal);
        Assert.Contains("恢复建议=", diagnostic, StringComparison.Ordinal);
        Assert.Contains("Password=***", diagnostic, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Token=***", diagnostic, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("top-secret", diagnostic, StringComparison.Ordinal);
        Assert.DoesNotContain("token-secret", diagnostic, StringComparison.Ordinal);
    }

    [Fact]
    public void RuntimeInvariantChain_AssignsAStageBeforeEveryRepairBoundary()
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(),
            "Microi.Server",
            "Microi.Upgrade",
            "Upgrade.cs"));

        Assert.Contains("runtimeInvariantStage = \"平台运行时接口闭包\"", source, StringComparison.Ordinal);
        Assert.Contains("runtimeInvariantStage = \"接口引擎字段元数据兼容\"", source, StringComparison.Ordinal);
        Assert.Contains("runtimeInvariantStage = \"Upgrade21-持久后台任务\"", source, StringComparison.Ordinal);
        Assert.Contains("runtimeInvariantStage = \"菜单AppDisplay保护快照\"", source, StringComparison.Ordinal);
        Assert.Contains("BuildUpgradeFailureDiagnostic(runtimeInvariantStage, ex)", source, StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi 工作区根目录。");
    }
}
