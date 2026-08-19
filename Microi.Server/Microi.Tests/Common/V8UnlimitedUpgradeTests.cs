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
        Assert.Contains("EnsureRuntimePhysicalPrerequisitesAsync(runtimeClient, stoppingToken)", hostedService, StringComparison.Ordinal);
        Assert.True(
            hostedService.IndexOf("EnsureRuntimePhysicalPrerequisitesAsync", StringComparison.Ordinal)
            < hostedService.IndexOf("new Upgrade21()", StringComparison.Ordinal));
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
