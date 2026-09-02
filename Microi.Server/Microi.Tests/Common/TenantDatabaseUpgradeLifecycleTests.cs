using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class TenantDatabaseUpgradeLifecycleTests
{
    [Fact]
    public void StartupCreateAndManualFlowsShareOneTenantUpgradeCoordinator()
    {
        var root = FindRepositoryRoot();
        var interfaceSource = Read(root, "Microi.Server", "Microi.Core", "Interface", "IMicroiUpgrade.cs");
        var hostedSource = Read(root, "Microi.Server", "Microi.Upgrade", "MicroiUpgradeHostedService.cs");
        var provisioningSource = Read(root, "Microi.Server", "Microi.Core", "Runtime", "TenantProvisioningService.cs");

        Assert.Contains("Task<DosResult> UpgradeTenantAsync(", interfaceSource, StringComparison.Ordinal);
        Assert.Contains(".UpgradeTenantAsync(tenantName", hostedSource, StringComparison.Ordinal);
        Assert.Equal(3, Count(provisioningSource, "var upgradeResult = await UpgradeProvisionedTenantAsync("));
        Assert.Contains("var upgrade = await UpgradeProvisionedTenantAsync(", provisioningSource, StringComparison.Ordinal);
        Assert.Contains("return await upgrade\n                .UpgradeTenantAsync(osClient, backgroundTaskId)",
            provisioningSource.Replace("\r\n", "\n"), StringComparison.Ordinal);
        Assert.Contains("不能把未升级的租户标记为创建成功", provisioningSource, StringComparison.Ordinal);
        Assert.Contains("CompensateProvisioningFailure(", provisioningSource, StringComparison.Ordinal);
    }

    [Fact]
    public void CoordinatorReadsServerVersionSkipsCoveredProgramsAndAdvancesOnlyThroughVersionChain()
    {
        var root = FindRepositoryRoot();
        var coordinator = Read(root, "Microi.Server", "Microi.Upgrade", "TenantUpgradeCoordinator.cs");
        var upgrade = Read(root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs");

        var prerequisite = coordinator.IndexOf("EnsureRuntimePhysicalPrerequisitesAsync", StringComparison.Ordinal);
        var lease = coordinator.IndexOf("UpgradeDistributedLease.TryAcquire", StringComparison.Ordinal);
        var versionRead = coordinator.IndexOf("beforeVersion = ReadServerVersion(runtimeClient)", StringComparison.Ordinal);
        var pending = coordinator.IndexOf("NeedUpgrade(beforeVersion, program.Value)", StringComparison.Ordinal);
        var versionChain = coordinator.IndexOf("Upgrade(beforeVersion, runtimeClient)", StringComparison.Ordinal);
        Assert.True(prerequisite >= 0 && lease > prerequisite && versionRead > lease
                    && pending > versionRead && versionChain > pending);
        Assert.Contains("PersistServerVersionForwardOnlyAsync", upgrade, StringComparison.Ordinal);
        Assert.Contains("ServerVersion 未越过失败步骤", coordinator, StringComparison.Ordinal);
        Assert.Contains("AlreadyCurrent = alreadyCurrent", coordinator, StringComparison.Ordinal);
        Assert.Contains("BackgroundTaskRuntime.TryUpdateProgress", coordinator, StringComparison.Ordinal);
        Assert.Contains("BackgroundTaskRuntime.TryAppendLog", coordinator, StringComparison.Ordinal);
        Assert.DoesNotContain("OsClientModel?[\"DbConn\"]", coordinator, StringComparison.Ordinal);
    }

    [Fact]
    public void ManualUpgradeUsesAuthoritativeTenantRowProvisioningLeaseAndExactTaskFence()
    {
        var root = FindRepositoryRoot();
        var provisioning = Read(root, "Microi.Server", "Microi.Core", "Runtime", "TenantProvisioningService.cs");
        var v8Method = Read(root, "Microi.Server", "Microi.Core", "V8Engine", "Runtime", "V8Method.cs");
        var manualStart = provisioning.IndexOf(
            "public async Task<DosResult> UpgradeAdminTenantDatabaseAsync(", StringComparison.Ordinal);
        var manualEnd = provisioning.IndexOf(
            "private static async Task<DosResult> UpgradeProvisionedTenantAsync(", manualStart, StringComparison.Ordinal);
        Assert.True(manualStart >= 0 && manualEnd > manualStart);
        var manual = provisioning.Substring(manualStart, manualEnd - manualStart);

        Assert.Contains("TenantProvisioningLease.TryAcquire(", manual, StringComparison.Ordinal);
        Assert.Contains("\"admin:\" + tenantKey.ToLowerInvariant()", manual, StringComparison.Ordinal);
        Assert.Contains("FROM sys_osclients", manual, StringComparison.Ordinal);
        Assert.Contains("WHERE Id = @TenantId AND OsClient = @TenantKey", manual, StringComparison.Ordinal);
        Assert.Contains("AND IsDeleted = 0 AND IsEnable = 1", manual, StringComparison.Ordinal);
        Assert.Contains("InvalidateSaasConfigurationCache(tenantKey)", manual, StringComparison.Ordinal);
        Assert.Contains("ReloadSingleOsClient(tenantKey)", manual, StringComparison.Ordinal);
        Assert.DoesNotContain("DbConn =", manual, StringComparison.Ordinal);
        Assert.DoesNotContain("Password", manual, StringComparison.OrdinalIgnoreCase);

        var facadeStart = v8Method.IndexOf(
            "public DosResult UpgradeAdminTenantDatabase(object param)", StringComparison.Ordinal);
        var facadeEnd = v8Method.IndexOf(
            "private static DosResult ResolveCurrentManagedBackgroundTask(", facadeStart, StringComparison.Ordinal);
        Assert.True(facadeStart >= 0 && facadeEnd > facadeStart);
        var facade = v8Method.Substring(facadeStart, facadeEnd - facadeStart);
        Assert.Contains("admin_upgrade_saas_tenant_database", facade, StringComparison.Ordinal);
        Assert.Contains("ResolveTrustedManagedCurrentUser(", facade, StringComparison.Ordinal);
        Assert.Contains("PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(", facade, StringComparison.Ordinal);
        Assert.Contains("ResolveCurrentManagedBackgroundTask(", facade, StringComparison.Ordinal);
        Assert.Contains("BackgroundTaskId = taskContext.TaskId", facade, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Unknown MySQL server host 'mysql8.0';Password=plain-secret", "数据库主机名无法解析")]
    [InlineData("Access denied for user admin;Pwd=plain-secret", "数据库拒绝登录")]
    [InlineData("Connection refused by 10.0.0.8:3306;Password=plain-secret", "端口拒绝连接")]
    [InlineData("Unknown database 'jisu1';Password=plain-secret", "目标数据库不存在")]
    public void CoordinatorTranslatesDatabaseFailuresAndRedactsCredentials(
        string diagnostic,
        string expectedChinese)
    {
        var method = typeof(MicroiUpgrade).GetMethod(
            "BuildChineseUpgradeDiagnostic",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var result = Assert.IsType<string>(method!.Invoke(null, new object?[] { diagnostic }));
        Assert.Contains(expectedChinese, result, StringComparison.Ordinal);
        Assert.DoesNotContain("plain-secret", result, StringComparison.Ordinal);
        Assert.Contains("***", result, StringComparison.Ordinal);
    }

    private static int Count(string source, string value)
    {
        var count = 0;
        for (var index = 0; (index = source.IndexOf(value, index, StringComparison.Ordinal)) >= 0;
             index += value.Length) count++;
        return count;
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
