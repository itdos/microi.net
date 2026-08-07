using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class DiyLangBackgroundTaskTests
{
    [Fact]
    public void SourceTag_RemovesCallerControlledLogCharacters()
    {
        var value = DiyLangBackgroundTaskService.SanitizeSource(
            "lang init\r\ncredential=unsafe/value",
            "api");

        Assert.Equal("lang-init--credential-unsafe-value", value);
        Assert.DoesNotContain('\r', value);
        Assert.DoesNotContain('\n', value);
        Assert.True(value.Length <= 80);
    }

    [Fact]
    public void DiyLangRowId_IsDeterministicPerTenantAndKey()
    {
        var first = FormEngineExtend.BuildDeterministicDiyLangRowId(
            "Tenant-A",
            "Sys_Menu:example");
        var sameIdentity = FormEngineExtend.BuildDeterministicDiyLangRowId(
            " tenant-a ",
            "sys_menu:EXAMPLE");
        var otherTenant = FormEngineExtend.BuildDeterministicDiyLangRowId(
            "tenant-b",
            "sys_menu:example");
        var otherKey = FormEngineExtend.BuildDeterministicDiyLangRowId(
            "tenant-a",
            "sys_menu:other");

        Assert.Equal(first, sameIdentity);
        Assert.NotEqual(first, otherTenant);
        Assert.NotEqual(first, otherKey);
        Assert.True(Guid.TryParse(first, out _));
    }

    [Fact]
    public void ProviderIdentity_IsStableFingerprintWithoutEndpointOrCredential()
    {
        const string providerKey =
            "libretranslate:https://translate.example.test/translate:credential-value";
        var method = typeof(FormEngineExtend).GetMethod(
            "SafeDiyLangProviderIdentity",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(method);
        var first = Assert.IsType<string>(method!.Invoke(null, new object?[] { providerKey }));
        var second = Assert.IsType<string>(method.Invoke(null, new object?[] { providerKey }));
        var changedCredential = Assert.IsType<string>(method.Invoke(
            null,
            new object?[]
            {
                "libretranslate:https://translate.example.test/translate:different-credential"
            }));
        var credentialDigest = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes("credential-value")))
            .Substring(0, 12)
            .ToLowerInvariant();

        Assert.Equal(first, second);
        Assert.Equal(first, changedCredential);
        Assert.StartsWith("configured:", first, StringComparison.Ordinal);
        Assert.DoesNotContain("translate.example.test", first, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("credential-value", first, StringComparison.Ordinal);
        Assert.DoesNotContain(credentialDigest, first, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("configured:".Length + 12, first.Length);
    }

    [Fact]
    public void ProviderDiagnostics_RedactUrlAndCredentialBeforePersistence()
    {
        const string providerKey =
            "libretranslate:https://translate.example.test/translate:credential-value";
        const string diagnostic =
            "Request https://translate.example.test/translate failed; apiKey=credential-value; provider returned ultra-secret-raw";
        var method = typeof(FormEngineExtend).GetMethod(
            "SanitizeDiyLangDiagnosticText",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(method);
        var safe = Assert.IsType<string>(method!.Invoke(
            null,
            new object?[] { diagnostic, providerKey, 500, new[] { "ultra-secret-raw" } }));

        Assert.DoesNotContain("translate.example.test", safe, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("credential-value", safe, StringComparison.Ordinal);
        Assert.DoesNotContain("ultra-secret-raw", safe, StringComparison.Ordinal);
        Assert.Contains("[redacted-url]", safe, StringComparison.Ordinal);
        Assert.Contains("[redacted]", safe, StringComparison.Ordinal);
    }

    [Fact]
    public void AllWaitModes_UseDurableTaskWithoutSynchronousFormEngineBypass()
    {
        var root = FindRepositoryRoot();
        var controller = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.net.Api",
            "Controllers",
            "FormEngineController.cs"));
        var queueIndex = controller.IndexOf(
            "DiyLangBackgroundTaskService.QueueManualSync(",
            StringComparison.Ordinal);

        Assert.True(queueIndex >= 0);
        Assert.Contains(
            "DiyLangBackgroundTaskService.WaitForCompletionAsync(",
            controller,
            StringComparison.Ordinal);
        Assert.DoesNotContain("QueueDiyLangFullSync(osClient", controller, StringComparison.Ordinal);
        Assert.DoesNotContain("SyncDiyLangFullAsync(osClient", controller, StringComparison.Ordinal);
        Assert.DoesNotContain("RepairMissingDiyLangTranslationsAsync(osClient", controller, StringComparison.Ordinal);
        Assert.DoesNotContain("requestedOsClient", controller, StringComparison.Ordinal);
    }

    [Fact]
    public void NativeWorkerAndStartupProducer_UseDurableTaskPath()
    {
        var root = FindRepositoryRoot();
        var worker = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "Runtime",
            "BackgroundTaskService.cs"));
        var program = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.net.Api",
            "Program.cs"));

        Assert.Contains(
            "DiyLangBackgroundTaskService.WorkerApiEngineKey",
            worker,
            StringComparison.Ordinal);
        Assert.Contains(
            "await DiyLangBackgroundTaskService.RunAsync(",
            worker,
            StringComparison.Ordinal);
        Assert.Contains(
            "DiyLangBackgroundTaskService.QueueStartupRepair(item)",
            program,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "RepairMissingDiyLangTranslationsAsync(item, \"startup\")",
            program,
            StringComparison.Ordinal);
    }

    [Fact]
    public void ActiveTaskReuse_RequiresEquivalentOrSupersetSemantics()
    {
        var repair = new Newtonsoft.Json.Linq.JObject
        {
            ["OnlyFillMissing"] = true,
            ["IncludeClientText"] = true,
            ["Force"] = false
        };
        var fullWithoutClientText = new Newtonsoft.Json.Linq.JObject
        {
            ["OnlyFillMissing"] = false,
            ["IncludeClientText"] = false,
            ["Force"] = false
        };
        var forcedFull = new Newtonsoft.Json.Linq.JObject
        {
            ["OnlyFillMissing"] = false,
            ["IncludeClientText"] = true,
            ["Force"] = true
        };

        Assert.False(DiyLangBackgroundTaskService.CanReuseActiveTask(
            repair, true, false, false));
        Assert.True(DiyLangBackgroundTaskService.CanReuseActiveTask(
            forcedFull, true, false, true));
        Assert.False(DiyLangBackgroundTaskService.CanReuseActiveTask(
            fullWithoutClientText, true, false, false));
        Assert.False(DiyLangBackgroundTaskService.CanReuseActiveTask(
            fullWithoutClientText, false, true, false));
    }

    [Fact]
    public void GenericApiEngineEntry_RejectsReservedNativeWorkerKey()
    {
        Assert.True(BackgroundTaskService.IsReservedNativeWorkerKey(
            DiyLangBackgroundTaskService.WorkerApiEngineKey));

        var root = FindRepositoryRoot();
        var controller = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.net.Api",
            "Controllers",
            "BackgroundTaskController.cs"));
        var worker = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "Services",
            "DiyLangBackgroundTaskService.cs"));
        var formEngine = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "FormEngine",
            "FormEngineLang.cs"));
        var store = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "Runtime",
            "BackgroundTaskStore.cs"));

        Assert.Contains(
            "BackgroundTaskService.IsReservedNativeWorkerKey(apiEngineKey)",
            controller,
            StringComparison.Ordinal);
        Assert.Contains(
            "PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, trustedUser)",
            worker,
            StringComparison.Ordinal);
        Assert.Contains(
            "[\"OsClient\"] = osClient",
            worker,
            StringComparison.Ordinal);
        Assert.Contains(
            "FormEngineExtend.EnterDiyLangSyncOwnershipGuard(",
            worker,
            StringComparison.Ordinal);
        Assert.Contains(
            "ThrowIfDiyLangSyncOwnershipLost();",
            formEngine,
            StringComparison.Ordinal);
        Assert.Contains(
            "BuildDeterministicDiyLangRowId(osClient, TokenString(row, \"Key\"))",
            formEngine,
            StringComparison.Ordinal);
        Assert.Contains(
            "catch (Exception ex) when (IsDiyLangDuplicateKeyException(ex))",
            formEngine,
            StringComparison.Ordinal);
        Assert.Contains("LeaseExpiresAt>@p4", store, StringComparison.Ordinal);
        Assert.Contains("FencingToken=@p3", store, StringComparison.Ordinal);
    }

    [Fact]
    public void GeneratedInitializeButton_ReportsPersistentTaskId()
    {
        var method = typeof(FormEngineExtend).GetMethod(
            "BuildSysConfigInitLangButtonV8Code",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(method);
        var script = Assert.IsType<string>(method!.Invoke(null, null));

        Assert.Contains("SyncLangMetadata?Source=sys_config", script, StringComparison.Ordinal);
        Assert.Contains("Wait: false", script, StringComparison.Ordinal);
        Assert.Contains("r.Data.TaskId", script, StringComparison.Ordinal);
        Assert.Contains(
            "持久后台任务队列",
            System.Text.RegularExpressions.Regex.Unescape(script),
            StringComparison.Ordinal);
    }

    [Fact]
    public void SaaSEnginePackage_CarriesDurableInitializeButtonScript()
    {
        var root = FindRepositoryRoot();
        var package = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Upgrade",
            "Resource",
            "app.microi.saas-engine.json")));
        var moreButtons = package.Descendants()
            .OfType<Newtonsoft.Json.Linq.JProperty>()
            .Where(property => property.Name == "MoreBtns")
            .Select(property => property.Value?.ToString())
            .Where(value => value?.Contains("sys-config-init-langs", StringComparison.Ordinal) == true)
            .ToList();

        var resource = Assert.Single(moreButtons);
        var button = Newtonsoft.Json.Linq.JArray.Parse(resource!)
            .OfType<Newtonsoft.Json.Linq.JObject>()
            .Single(item => item["Id"]?.ToString() == "sys-config-init-langs");
        var script = button["V8Code"]?.ToString() ?? "";

        Assert.Contains("r.Data.TaskId", script, StringComparison.Ordinal);
        Assert.Contains(
            "持久后台任务队列",
            System.Text.RegularExpressions.Regex.Unescape(script),
            StringComparison.Ordinal);
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
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}
