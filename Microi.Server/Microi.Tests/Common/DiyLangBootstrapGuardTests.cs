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
    public void GetSysConfig_NeverRunsLanguageDdlOnAnonymousBootstrap()
    {
        var source = ReadRepositoryFile(
            "Microi.Server", "Microi.net", "FormEngine", "FormEngine.cs");
        var method = ExtractMethod(
            source,
            "public async Task<DosResult<dynamic>> GetSysConfig",
            "public async Task<DosResult<dynamic>> GetFormDataAsync(dynamic");

        var cacheRead = method.IndexOf("cache.GetAsync<dynamic>(sysConfigCacheKey)", StringComparison.Ordinal);
        var cacheReturn = method.IndexOf("if (sysConfigCache != null)", StringComparison.Ordinal);
        Assert.True(cacheRead >= 0, "GetSysConfig must read the tenant sys_config cache.");
        Assert.True(cacheReturn > cacheRead, "GetSysConfig must return a valid cached snapshot.");
        Assert.DoesNotContain("EnsureSysConfigLangFieldAsync", method, StringComparison.Ordinal);
        Assert.Contains("NormalizeSysConfigLangForReturn(result.Data, sysLangs)", method, StringComparison.Ordinal);
    }

    [Fact]
    public void ColdConfiguration_NormalizesOldRowsWithoutMutatingPersistedLanguageChoices()
    {
        var normalize = typeof(FormEngineExtend).GetMethod(
            "NormalizeSysConfigLangForReturn", BindingFlags.NonPublic | BindingFlags.Static)!;
        var oldRow = new Newtonsoft.Json.Linq.JObject { ["SysTitle"] = "Old tenant" };
        var oldResult = Assert.IsType<Newtonsoft.Json.Linq.JObject>(
            normalize.Invoke(null, new object[] { oldRow, "zh-CN,zh-TW,en" }));
        Assert.Equal("zh-CN,zh-TW,en", oldResult["SysLangs"]?.ToString());
        Assert.Equal("zh-CN", oldResult["SysLang"]?.ToString());
        var configured = new Newtonsoft.Json.Linq.JObject { ["SysLangs"] = "en,ja", ["SysLang"] = "ja" };
        var result = Assert.IsType<Newtonsoft.Json.Linq.JObject>(
            normalize.Invoke(null, new object[] { configured, "zh-CN,zh-TW,en" }));
        Assert.Equal("en,ja", result["SysLangs"]?.ToString());
        Assert.Equal("ja", result["SysLang"]?.ToString());
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
