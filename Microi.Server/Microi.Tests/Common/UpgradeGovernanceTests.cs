using Microi.net;

namespace Microi.Tests.Common;

public sealed class UpgradeGovernanceTests
{
    [Fact]
    public void StartupRecoveryBaselineIsNewerAndNoLongerRunsOptionalMigrations()
    {
        Assert.True(Version.Parse(UpgradeAppStore.Version) > Version.Parse("7.6.14.0"));
        var root = FindRepositoryRoot();
        var upgrade = Read(root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs");
        Assert.Contains("StartVersionStep(CurrentVersion, UpgradeAppStore.Version)", upgrade);
        Assert.Contains("PersistServerVersionForwardOnlyAsync(osClientSecret, UpgradeAppStore.Version)", upgrade);
        foreach (var number in new[] { 8,14,16,17,18,20,23,24,26,28,29,30,31,34,35,36 })
            Assert.DoesNotContain($"new Upgrade{number}()", upgrade);
        Assert.Contains("UpgradeExecutionLeaseContext.ConfirmOwnership()", upgrade);
        Assert.Contains("new Upgrade21().Run", upgrade);
    }

    [Fact]
    public void AlreadyCurrentTenantsExitBeforePrerequisitesLeaseAndHistory()
    {
        var root = FindRepositoryRoot();
        var coordinator = Read(root, "Microi.Server", "Microi.Upgrade", "TenantUpgradeCoordinator.cs");
        var firstVersionRead = coordinator.IndexOf(
            "beforeVersion = ReadServerVersion(runtimeClient)", StringComparison.Ordinal);
        var fastPath = coordinator.IndexOf(
            "if (IsVersionAtLeast(beforeVersion, targetVersion))", StringComparison.Ordinal);
        var prerequisite = coordinator.IndexOf(
            "EnsureRuntimePhysicalPrerequisitesAsync", StringComparison.Ordinal);
        var lease = coordinator.IndexOf(
            "UpgradeDistributedLease.TryAcquire", StringComparison.Ordinal);

        Assert.True(firstVersionRead >= 0 && fastPath > firstVersionRead);
        Assert.True(prerequisite > fastPath && lease > prerequisite);
        Assert.Contains("未取得升级租约、未执行历史迁移、未刷新缓存", coordinator, StringComparison.Ordinal);
        Assert.DoesNotContain("RequiredRuntimeInvariantNames", coordinator, StringComparison.Ordinal);
    }

    [Fact]
    public void AiWorkflowBlueprintSchemaBelongsToMarketplaceNotDotnetUpgrade()
    {
        var root = FindRepositoryRoot();
        var upgradeRoot = Path.Combine(root, "Microi.Server", "Microi.Upgrade");
        var forbidden = new[]
        {
            "sys_business_blueprint",
            "sys_blueprint_relation",
            "sys_blueprint_history",
            "microi-ai-workflow"
        };
        var sources = Directory.GetFiles(upgradeRoot, "*.cs", SearchOption.TopDirectoryOnly)
            .Select(File.ReadAllText)
            .ToArray();
        foreach (var value in forbidden)
        {
            Assert.DoesNotContain(sources, source =>
                source.Contains(value, StringComparison.OrdinalIgnoreCase));
        }

        var policy = Read(root, "microi.skills", "app-store", "SKILL.md");
        Assert.Contains("商城不可表达性", policy, StringComparison.Ordinal);
        Assert.Contains("每租户一次版本读取 + 实际待执行迁移", policy, StringComparison.Ordinal);
        Assert.Contains("客户租户缺少某张业务表不得写成全平台", policy, StringComparison.Ordinal);
    }

    private static string Read(string root, params string[] segments) =>
        File.ReadAllText(Path.Combine(new[] { root }.Concat(segments).ToArray()));

    private static string FindRepositoryRoot(
        [System.Runtime.CompilerServices.CallerFilePath] string sourcePath = "")
    {
        DirectoryInfo? directory = new(Path.GetDirectoryName(sourcePath)!);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
