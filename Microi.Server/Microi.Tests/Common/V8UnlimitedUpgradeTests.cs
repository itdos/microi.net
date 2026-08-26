using Microi.net;

namespace Microi.Tests.Common;

public class V8UnlimitedUpgradeTests
{
    [Fact]
    public void StartupRepairsGeneratedRuntimeColumnsBeforeLicenseQueriesFormEngine()
    {
        var root = FindRepositoryRoot();
        var program = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Program.cs"));
        var hostedService = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "MicroiUpgradeHostedService.cs"));
        var upgrade = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs"));

        var prerequisiteIndex = program.IndexOf(
            ".EnsureRuntimePhysicalPrerequisitesAsync(clientModel)",
            StringComparison.Ordinal);
        var licenseIndex = program.IndexOf(
            "LicenseServerStore.RestoreCurrentServerLicenseAsync",
            StringComparison.Ordinal);

        Assert.True(prerequisiteIndex >= 0);
        Assert.True(licenseIndex > prerequisiteIndex);
        Assert.Contains("UpgradeDistributedLease.TryAcquire", upgrade, StringComparison.Ordinal);
        Assert.Contains("RuntimePhysicalPrerequisitesReady", upgrade, StringComparison.Ordinal);
        Assert.Contains("[\"V8Limit\"] = \"int\"", upgrade, StringComparison.Ordinal);
        Assert.Contains("[\"Id\"] = \"varchar(36)\"", upgrade, StringComparison.Ordinal);
        Assert.Contains("BackfillApiEngineIds(osClientSecret)", upgrade, StringComparison.Ordinal);
        Assert.Contains("SET `Id`=UUID()", upgrade, StringComparison.Ordinal);
        Assert.Contains("SET [Id]=CONVERT(varchar(36), NEWID())", upgrade, StringComparison.Ordinal);
        Assert.Contains("[\"OsClient\"] = \"varchar(255)\"", upgrade, StringComparison.Ordinal);
        Assert.Contains("[\"TableInEdit\"] = \"int\"", upgrade, StringComparison.Ordinal);
        Assert.Contains("[\"AddCallbakApi\"] = \"varchar(500)\"", upgrade, StringComparison.Ordinal);
        Assert.Contains("EnsureRuntimePhysicalPrerequisitesAsync(runtimeClient, stoppingToken)", hostedService, StringComparison.Ordinal);
        Assert.True(
            hostedService.IndexOf("EnsureRuntimePhysicalPrerequisitesAsync", StringComparison.Ordinal)
            < hostedService.IndexOf("new Upgrade21()", StringComparison.Ordinal));
    }

    [Fact]
    public void AddFormData_ReusesResolvedDiyTableModel_AndPreservesMetadataRootCause()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net", "FormEngine", "FormEngineAdd.cs"));

        Assert.Contains("_DiyTableModel = diyTableModel", source, StringComparison.Ordinal);
        Assert.Contains("fieldListResult.Code != 1 || fieldListResult.Data == null", source, StringComparison.Ordinal);
        Assert.Contains("[GetDiyField][AddFormData]", source, StringComparison.Ordinal);
        var checkIndex = source.IndexOf(
            "if (fieldListResult.Code != 1 || fieldListResult.Data == null)",
            StringComparison.Ordinal);
        var dereferenceIndex = source.IndexOf(
            "var fieldList = fieldListResult.Data;",
            checkIndex,
            StringComparison.Ordinal);
        Assert.True(checkIndex >= 0 && dereferenceIndex > checkIndex);
    }

    [Fact]
    public void Upgrade27_PreservesCustomInFormCodeAndAddsOneManagedVisibilityBlock()
    {
        const string custom = "V8.FieldSet('LockKey', 'Visible', !!V8.Form.Lock);";

        var result = Upgrade27.ReconcileApiEngineInFormV8(custom, out var changed);

        Assert.True(changed);
        Assert.StartsWith(custom, result, StringComparison.Ordinal);
        Assert.Equal(1, Count(result, Upgrade27.BeginMarker));
        Assert.Equal(1, Count(result, Upgrade27.EndMarker));
        Assert.Contains("MaxStatements: 50000000", result, StringComparison.Ordinal);
        Assert.Contains("LimitRecursion: 2000", result, StringComparison.Ordinal);
        Assert.Equal("6.9.8.2", Upgrade27.Version);
    }

    [Fact]
    public void Upgrade27_InFormReconciliationIsIdempotent()
    {
        var once = Upgrade27.ReconcileApiEngineInFormV8("var keep = 1;", out var firstChanged);
        var twice = Upgrade27.ReconcileApiEngineInFormV8(once, out var secondChanged);

        Assert.True(firstChanged);
        Assert.False(secondChanged);
        Assert.Equal(once, twice);
        Assert.Equal(1, Count(twice, Upgrade27.BeginMarker));
    }

    [Fact]
    public void Upgrade27_RejectsAnIncompleteManagedBlockWithoutOverwritingCustomCode()
    {
        Assert.Throws<FormatException>(() =>
            Upgrade27.ReconcileApiEngineInFormV8(
                "var keep = 1;\n" + Upgrade27.BeginMarker,
                out _));
    }

    [Fact]
    public void Upgrade32_ReplacesLegacyVisibilityBlockAndIsIdempotent()
    {
        const string custom = "V8.FieldSet('LockKey', 'Visible', !!V8.Form.Lock);";
        var legacy = Upgrade27.ReconcileApiEngineInFormV8(custom, out _);

        var once = Upgrade32.ReconcileApiEngineInFormV8(legacy, out var firstChanged);
        var twice = Upgrade32.ReconcileApiEngineInFormV8(once, out var secondChanged);

        Assert.True(firstChanged);
        Assert.False(secondChanged);
        Assert.StartsWith(custom, once, StringComparison.Ordinal);
        Assert.DoesNotContain(Upgrade27.BeginMarker, once, StringComparison.Ordinal);
        Assert.Equal(1, Count(once, Upgrade32.BeginMarker));
        Assert.Contains("var limited = V8.Form.V8Limit", once, StringComparison.Ordinal);
        Assert.Contains("V8.FieldSet(limitFields[i], 'Visible', limited)", once, StringComparison.Ordinal);
        Assert.Equal("6.9.8.7", Upgrade32.Version);
    }

    [Fact]
    public void Upgrade32_OneTimeResetAndPositiveRuntimeSemanticsAreWired()
    {
        var root = FindRepositoryRoot();
        var migration = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "32-UpgradeV8RuntimeLimit.cs"));
        var upgrade = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs"));
        var apiEngine = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net", "ApiEngine", "ApiEngine.cs"));

        Assert.Contains("UPDATE sys_apiengine", migration, StringComparison.Ordinal);
        Assert.Contains("SET V8Limit = @p0", migration, StringComparison.Ordinal);
        Assert.Contains("AdvanceSuccessfulVersion(ref uptVersion, Upgrade32.Version)", upgrade, StringComparison.Ordinal);
        Assert.Contains("UnlimitedRuntime = !DynamicHelper.GetDynamicBoolValue", apiEngine, StringComparison.Ordinal);
        Assert.Contains("\"V8Limit\"", apiEngine, StringComparison.Ordinal);
    }

    [Fact]
    public void Upgrade33_ResetsExistingTablesOnce_AndStartupOnlyInitializesNullValues()
    {
        var root = FindRepositoryRoot();
        var migration = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "33-UpgradeDiyTableV8RuntimeLimit.cs"));
        var upgrade = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs"));
        var hostedService = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "MicroiUpgradeHostedService.cs"));

        Assert.Equal("6.9.8.9", Upgrade33.Version);
        Assert.Contains("UPDATE diy_table", migration, StringComparison.Ordinal);
        Assert.Contains("if (resetExistingValues)", migration, StringComparison.Ordinal);
        Assert.Contains("SET V8Limit = @p0", migration, StringComparison.Ordinal);
        Assert.Contains("V8Unlimited = @p1", migration, StringComparison.Ordinal);
        Assert.Contains("WHERE V8Limit IS NULL", migration, StringComparison.Ordinal);
        Assert.Contains(".AddInParameter(\"p0\", 0)", migration, StringComparison.Ordinal);
        Assert.Contains(".AddInParameter(\"p1\", 1)", migration, StringComparison.Ordinal);
        Assert.Contains("Name = FieldName", migration, StringComparison.Ordinal);
        Assert.Contains("DefaultValue = \"0\"", migration, StringComparison.Ordinal);
        Assert.Contains("[\"Visible\"] = 0", migration, StringComparison.Ordinal);
        Assert.DoesNotContain("[\"IsDeleted\"] = 1", migration, StringComparison.Ordinal);
        Assert.Contains("AdvanceSuccessfulVersion(ref uptVersion, Upgrade33.Version)", upgrade, StringComparison.Ordinal);
        var leaseContextIndex = hostedService.IndexOf(
            "using (UpgradeExecutionLeaseContext.Enter(upgradeLease))",
            StringComparison.Ordinal);
        var invariantIndex = hostedService.IndexOf("\"Upgrade33-表单V8限额\"", StringComparison.Ordinal);
        Assert.Contains(".Run(runtimeClient.OsClient, resetExistingValues: false)", hostedService, StringComparison.Ordinal);
        Assert.Contains("RunRuntimeInvariantAsync(runtimeClient, upgradeLease", hostedService, StringComparison.Ordinal);
        var versionReadIndex = hostedService.IndexOf("SELECT ServerVersion FROM sys_config", StringComparison.Ordinal);
        var versionGateIndex = hostedService.IndexOf("_upgrade.Upgrade(currentVersion", StringComparison.Ordinal);
        Assert.True(leaseContextIndex >= 0);
        Assert.True(invariantIndex > leaseContextIndex);
        Assert.True(versionReadIndex > invariantIndex);
        Assert.True(versionGateIndex > versionReadIndex);
    }

    private static int Count(string value, string needle)
    {
        var count = 0;
        var index = 0;
        while ((index = value.IndexOf(needle, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += needle.Length;
        }
        return count;
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi 仓库根目录。");
    }
}
