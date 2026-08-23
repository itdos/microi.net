using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ChildTenantPlatformAppControlServiceTests
{
    [Fact]
    public void BuildEligibleChildTenants_UsesRuntimeTripleAndExcludesMain()
    {
        var rows = new[]
        {
            Tenant("main", "主租户", "Product", "Internet", 1, 0),
            Tenant("tenant-a", "租户 A", "Product", "Internet", 1, 0),
            Tenant("TENANT-A", "重复租户", "Product", "Internet", 1, 0),
            Tenant("tenant-disabled", "停用", "Product", "Internet", 0, 0),
            Tenant("tenant-deleted", "删除", "Product", "Internet", 1, 1),
            Tenant("tenant-dev", "错误环境", "Dev", "Internet", 1, 0),
            Tenant("tenant-internal", "错误网络", "Product", "Internal", 1, 0),
            Tenant("含中文", "非法 Key", "Product", "Internet", 1, 0)
        };

        var result = ChildTenantPlatformAppControlService.BuildEligibleChildTenants(
            rows,
            "Product",
            "Internet",
            "main");

        var target = Assert.Single(result);
        Assert.Equal("tenant-a", target.OsClient);
        Assert.Equal("租户 A", target.Name);
    }

    [Fact]
    public void TargetExecutionMarker_AllowsOnlyTheFixedChildWorkerFromMainTenant()
    {
        ChildTenantPlatformAppControlService.EnsureTargetExecutionAllowed(
            ChildTenantPlatformAppControlService.ChildWorkerApiEngineKey,
            "main",
            "tenant-a",
            "main");

        Assert.Throws<InvalidOperationException>(() =>
            ChildTenantPlatformAppControlService.EnsureTargetExecutionAllowed(
                "arbitrary-engine",
                "main",
                "tenant-a",
                "main"));
        Assert.Throws<InvalidOperationException>(() =>
            ChildTenantPlatformAppControlService.EnsureTargetExecutionAllowed(
                ChildTenantPlatformAppControlService.ChildWorkerApiEngineKey,
                "tenant-a",
                "tenant-b",
                "main"));
        Assert.Throws<InvalidOperationException>(() =>
            ChildTenantPlatformAppControlService.EnsureTargetExecutionAllowed(
                ChildTenantPlatformAppControlService.ChildWorkerApiEngineKey,
                "main",
                "main",
                "main"));
    }

    [Theory]
    [InlineData("bulk-import-microi-store-packages", "iTdos", "lxwb", "lxwb", true)]
    [InlineData("bulk-import-microi-store-packages", "lxwb", "lxwb", "", false)]
    [InlineData("bulk-import-microi-store-packages", "lxwb", "lxwb", "lxwb", false)]
    [InlineData("bulk-import-microi-store-packages", "iTdos", "lxwb", "other", false)]
    [InlineData("ordinary-engine", "iTdos", "lxwb", "lxwb", false)]
    public void ExecutionBootstrap_RequiresPersistedCrossTenantTargetMarker(
        string apiEngineKey,
        string ownerOsClient,
        string executionOsClient,
        string persistedTargetOsClient,
        bool expected)
    {
        Assert.Equal(
            expected,
            ChildTenantPlatformAppControlService.RequiresTargetExecutionBootstrap(
                apiEngineKey,
                ownerOsClient,
                executionOsClient,
                persistedTargetOsClient));
    }

    [Fact]
    public void ExecutionBootstrap_SkipsSameTenantMarketplaceSelfServiceBeforeDatabaseAccess()
    {
        var result = ChildTenantPlatformAppControlService.EnsureTargetExecutionBootstrap(
            "lxwb",
            "lxwb",
            new JObject());

        Assert.Equal(1, result.Code);
        var data = Assert.IsType<JObject>(result.Data);
        Assert.True(data["Skipped"]?.Value<bool>() == true);
        Assert.Equal("SameTenantSelfService", data["Scope"]?.ToString());
        Assert.Contains("不执行跨租户工作器自愈", result.Msg, StringComparison.Ordinal);
    }

    [Fact]
    public void ChildMaintenance_BootstrapsInstallerAndWorker_AndParentMonitorsTerminalRows()
    {
        Assert.Equal(8, ChildTenantPlatformAppControlService.ChildWorkerMaxAttempts);
        Assert.Equal(
            "__microi_child_platform_app_install_cluster__",
            ChildTenantPlatformAppControlService.ClusterConcurrencyKey);
        Assert.Equal(
            new[] { "import-microi-store-package", "bulk-import-microi-store-packages" },
            ChildTenantPlatformAppControlService.RequiredBootstrapApiEngineKeys);

        var root = FindRepositoryRoot();
        var orchestrator = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Upgrade",
            "Resource",
            "bulk-update-child-tenant-platform-apps.js"));
        Assert.Contains("Phase: 'Monitor'", orchestrator, StringComparison.Ordinal);
        Assert.Contains("GetTableData('mci_background_task'", orchestrator, StringComparison.Ordinal);
        Assert.Contains("childStatus == 'Failed' || childStatus == 'Canceled'", orchestrator, StringComparison.Ordinal);
        Assert.Contains("全部子租户任务已结束", orchestrator, StringComparison.Ordinal);
        Assert.Contains("全部 ' + childTasks.length + ' 个子租户平台应用均已安装/更新成功", orchestrator, StringComparison.Ordinal);
    }

    [Fact]
    public void ChildMaintenance_RefreshesLatestRecoverableImporterForAlreadyRunningParentTasks()
    {
        var root = FindRepositoryRoot();
        var controlSource = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "Services",
            "ChildTenantPlatformAppControlService.cs"));
        var importerSource = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Upgrade",
            "Resource",
            "import-package.js"));

        Assert.Contains("CHILD_TENANT_MONITOR_BOOTSTRAP_RECOVERY_V1", controlSource, StringComparison.Ordinal);
        Assert.Contains("CHILD_TENANT_EXECUTION_BOOTSTRAP_V1", controlSource, StringComparison.Ordinal);
        Assert.Contains("EnsureMonitorBootstrapRecovery", controlSource, StringComparison.Ordinal);
        Assert.Contains("EnsureTargetExecutionBootstrap", controlSource, StringComparison.Ordinal);
        Assert.Contains("CHILD_TENANT_EXECUTION_BOOTSTRAP_SCOPE_V1", controlSource, StringComparison.Ordinal);
        Assert.Contains("BACKGROUND_TASK_IDEMPOTENCY_DUPLICATE_REPAIR_V1", controlSource, StringComparison.Ordinal);
        Assert.Contains("BACKGROUND_TASK_IDEMPOTENCY_DUPLICATE_REPAIR_V1", importerSource, StringComparison.Ordinal);
        Assert.Contains("Version: v2.3.3", importerSource, StringComparison.Ordinal);
    }

    [Fact]
    public void CachePatternInvalidation_UsesExactTenantConnectionInsteadOfDatabaseIndexInference()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Cache",
            "MicroiCacheRedis.cs"));

        Assert.Contains("CACHE_PATTERN_EXACT_TENANT_CONNECTION_V1", source, StringComparison.Ordinal);
        Assert.Contains("private readonly string _osClient;", source, StringComparison.Ordinal);
        Assert.Contains("var connection = GetConnection(_osClient);", source, StringComparison.Ordinal);
        Assert.DoesNotContain("GetConnection(GetCurrentOsClient())", source, StringComparison.Ordinal);
        Assert.DoesNotContain("GetDatabase(kvp.Key).Database == _redisDb.Database", source, StringComparison.Ordinal);
    }

    [Fact]
    public void BootstrapSwitch_UsesNativeBooleanForHistoricBitAndBinaryColumns()
    {
        Assert.IsType<bool>(ChildTenantPlatformAppControlService.BootstrapSwitch(false));
        Assert.IsType<bool>(ChildTenantPlatformAppControlService.BootstrapSwitch(true));
        Assert.False((bool)ChildTenantPlatformAppControlService.BootstrapSwitch(false));
        Assert.True((bool)ChildTenantPlatformAppControlService.BootstrapSwitch(true));
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    [InlineData("0", 0)]
    [InlineData("1", 1)]
    [InlineData("False", 0)]
    [InlineData("True", 1)]
    public void BootstrapSwitchLiteral_EmitsSingleDigitSqlCompatibleValues(object value, int expected)
    {
        Assert.Equal(expected, ChildTenantPlatformAppControlService.BootstrapSwitchLiteral(value));
    }

    [Fact]
    public void BootstrapSwitchLiteral_HandlesHistoricBitByteArrays()
    {
        Assert.Equal(0, ChildTenantPlatformAppControlService.BootstrapSwitchLiteral(new byte[] { 0 }));
        Assert.Equal(1, ChildTenantPlatformAppControlService.BootstrapSwitchLiteral(new byte[] { 1 }));
    }

    [Fact]
    public void BootstrapWorkerRefresh_AllowsOnlyRecognizedStrictlyOlderPlatformSources()
    {
        const string oldImporter = "var Package = V8.Param.Package; V8.FormEngine.GetTableData('sys_microistore', {});";
        const string newImporter = oldImporter + " // GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1";

        Assert.True(ChildTenantPlatformAppControlService.ShouldRefreshBootstrapEngine(
            "import-microi-store-package", "v2.2.2", oldImporter, "v2.2.3", newImporter, out var error));
        Assert.Equal(string.Empty, error);
    }

    [Fact]
    public void BootstrapWorkerRefresh_UsesStandardSourceHeaderWhenHistoricVersionColumnIsEmpty()
    {
        const string oldImporter = "/* Version: v2.2.2 */ var Package = V8.Param.Package; sys_microistore;";
        const string newImporter = "/* Version: v2.2.4 */ var Package = V8.Param.Package; sys_microistore;";

        Assert.True(ChildTenantPlatformAppControlService.ShouldRefreshBootstrapEngine(
            "import-microi-store-package", "", oldImporter, "v2.2.4", newImporter, out var error));
        Assert.Equal(string.Empty, error);
    }

    [Fact]
    public void BootstrapWorkerRefresh_IgnoresBomAndLineEndingDifferencesAtSameVersion()
    {
        const string source = "/* Version: v1.2.6 */\nimport-microi-store-package\nApplicationType\n";
        const string target = "\uFEFF/* Version: v1.2.6 */\r\nimport-microi-store-package\r\nApplicationType\r\n";

        Assert.False(ChildTenantPlatformAppControlService.ShouldRefreshBootstrapEngine(
            "bulk-import-microi-store-packages",
            "v1.2.6",
            target,
            "v1.2.6",
            source,
            out var error));
        Assert.Equal(string.Empty, error);
    }

    [Theory]
    [InlineData("v2.2.3", "v2.2.3", "同版本但源码不同")]
    [InlineData("invalid", "v2.2.3", "版本无法安全比较")]
    public void BootstrapWorkerRefresh_RejectsAmbiguousOrCustomizedSources(
        string targetVersion,
        string sourceVersion,
        string expectedError)
    {
        Assert.False(ChildTenantPlatformAppControlService.ShouldRefreshBootstrapEngine(
            "import-microi-store-package",
            targetVersion,
            "var Package = V8.Param.Package; // tenant custom without store lineage",
            sourceVersion,
            "var Package = V8.Param.Package; sys_microistore; // official",
            out var error));
        Assert.Contains(expectedError, error, StringComparison.Ordinal);
    }

    [Fact]
    public void BootstrapWorkerRefresh_PreservesNewerTargetVersion()
    {
        Assert.False(ChildTenantPlatformAppControlService.ShouldRefreshBootstrapEngine(
            "bulk-import-microi-store-packages",
            "v1.2.6",
            "import-microi-store-package ApplicationType // newer",
            "v1.2.5",
            "import-microi-store-package ApplicationType // source",
            out var error));
        Assert.Equal(string.Empty, error);
    }

    private static JObject Tenant(
        string osClient,
        string name,
        string type,
        string network,
        int enabled,
        int deleted)
    {
        return new JObject
        {
            ["OsClient"] = osClient,
            ["ClientName"] = name,
            ["OsClientType"] = type,
            ["OsClientNetwork"] = network,
            ["IsEnable"] = enabled,
            ["IsDeleted"] = deleted
        };
    }


    private static string FindRepositoryRoot()
    {
        foreach (var startPath in new[]
                 {
                     Environment.GetEnvironmentVariable("MICROI_TEST_REPOSITORY_ROOT"),
                     Directory.GetCurrentDirectory(),
                     AppContext.BaseDirectory
                 }.Where(path => !string.IsNullOrWhiteSpace(path)))
        {
            var directory = new DirectoryInfo(startPath);
            while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                directory = directory.Parent;
            if (directory != null) return directory.FullName;
        }
        throw new DirectoryNotFoundException("Repository root not found.");
    }
}
