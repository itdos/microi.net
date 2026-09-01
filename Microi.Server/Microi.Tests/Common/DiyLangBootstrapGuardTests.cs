using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class DiyLangBootstrapGuardTests
{
    [Fact]
    public void DiyLangDatabaseGate_UsesShortBoundedWaitsAndConditionalRelease()
    {
        var waitSeconds = typeof(FormEngineExtend).GetField(
            "DiyLangDbSemaphoreWaitSeconds",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(waitSeconds);
        var value = Assert.IsType<int>(waitSeconds!.GetRawConstantValue());
        Assert.InRange(value, 1, 10);

        var source = ReadRepositoryFile(
            "Microi.Server", "Microi.Core", "FormEngine", "FormEngineLang.cs");
        var method = ExtractMethod(
            source,
            "private static async Task<T> RunDiyLangDbOperationAsync<T>",
            "internal static IDisposable EnterDiyLangSyncOwnershipGuard");

        Assert.Contains("tenantSemaphore.WaitAsync(", method, StringComparison.Ordinal);
        Assert.Contains("DiyLangGlobalDbSemaphore.WaitAsync(", method, StringComparison.Ordinal);
        Assert.DoesNotContain("WaitAsync();", method, StringComparison.Ordinal);
        Assert.True(
            method.IndexOf("tenantSemaphore.WaitAsync(", StringComparison.Ordinal)
            < method.IndexOf("DiyLangGlobalDbSemaphore.WaitAsync(", StringComparison.Ordinal),
            "The tenant gate must be acquired before the process-wide gate.");
        Assert.Contains("if (globalSemaphoreAcquired)", method, StringComparison.Ordinal);
        Assert.Contains("if (tenantSemaphoreAcquired)", method, StringComparison.Ordinal);
    }

    [Fact]
    public void GetSysConfig_ReadsValidCacheBeforeRequestTimeLanguageDdl()
    {
        var source = ReadRepositoryFile(
            "Microi.Server", "Microi.net", "FormEngine", "FormEngine.cs");
        var method = ExtractMethod(
            source,
            "public async Task<DosResult<dynamic>> GetSysConfig",
            "public async Task<DosResult<dynamic>> GetFormDataAsync(dynamic");

        var cacheRead = method.IndexOf("cache.GetAsync<dynamic>(sysConfigCacheKey)", StringComparison.Ordinal);
        var cacheReturn = method.IndexOf("if (sysConfigCache != null)", StringComparison.Ordinal);
        var requestTimeDdl = method.IndexOf("EnsureSysConfigLangFieldAsync(osClient)", StringComparison.Ordinal);

        Assert.True(cacheRead >= 0, "GetSysConfig must read the tenant sys_config cache.");
        Assert.True(cacheReturn > cacheRead, "GetSysConfig must return a valid cached snapshot.");
        Assert.True(
            requestTimeDdl > cacheReturn,
            "Request-time language metadata repair must only run after a cache miss.");
    }

    private static string ExtractMethod(string source, string startMarker, string endMarker)
    {
        var start = source.IndexOf(startMarker, StringComparison.Ordinal);
        var end = source.IndexOf(endMarker, start + startMarker.Length, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Missing source marker: {startMarker}");
        Assert.True(end > start, $"Missing source marker: {endMarker}");
        return source[start..end];
    }

    private static string ReadRepositoryFile(params string[] relativeSegments)
    {
        var root = FindRepositoryRoot();
        return File.ReadAllText(Path.Combine(new[] { root }.Concat(relativeSegments).ToArray()));
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
