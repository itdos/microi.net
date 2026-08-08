using System.Reflection;
using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class CacheAndUpgradeRegressionTests
{
    [Fact]
    public void Upgrade21_CoversEveryBackgroundTaskRuntimeColumn_AndCanAdoptLegacyPhysicalTable()
    {
        var requiredColumnsMethod = typeof(Upgrade21).GetMethod(
            "GetRequiredPhysicalColumnNames",
            BindingFlags.Static | BindingFlags.NonPublic);
        var adoptMethod = typeof(Upgrade21).GetMethod(
            "AdoptExistingPhysicalTableAsync",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(requiredColumnsMethod);
        Assert.NotNull(adoptMethod);
        Assert.Equal(typeof(Task<DosResult>), adoptMethod!.ReturnType);

        var requiredColumns = Assert.IsType<string[]>(requiredColumnsMethod!.Invoke(null, null));
        Assert.Equal(
            requiredColumns.Length,
            requiredColumns.Distinct(StringComparer.OrdinalIgnoreCase).Count());

        var storeType = typeof(BackgroundTaskService).Assembly.GetType(
            "Microi.net.BackgroundTaskStore",
            throwOnError: true);
        var projectionField = storeType!.GetField(
            "Projection",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(projectionField);

        var projection = Assert.IsType<string>(projectionField!.GetRawConstantValue());
        var runtimeReadColumns = projection
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part.Split(
                ' ',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[0]);

        foreach (var column in runtimeReadColumns.Concat(new[]
                 {
                     "UpdateTime", "UserId", "UserName", "IsDeleted"
                 }))
        {
            Assert.Contains(
                requiredColumns,
                candidate => string.Equals(candidate, column, StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void BackgroundTasks_ArePartitionedByRuntimeScope_WithLegacyWildcardCompatibility()
    {
        var storeType = typeof(BackgroundTaskService).Assembly.GetType(
            "Microi.net.BackgroundTaskStore",
            throwOnError: true)!;
        var predicate = Assert.IsType<string>(storeType.GetField(
            "RuntimeScopePredicate",
            BindingFlags.Static | BindingFlags.NonPublic)!.GetRawConstantValue());
        Assert.Contains("RuntimeOsClientType IS NULL", predicate);
        Assert.Contains("RuntimeOsClientType=''", predicate);
        Assert.Contains("RuntimeOsClientType=@runtimeType", predicate);
        Assert.Contains("RuntimeOsClientNetwork IS NULL", predicate);
        Assert.Contains("RuntimeOsClientNetwork=@runtimeNetwork", predicate);

        var normalize = storeType.GetMethod(
            "NormalizeRuntimeScopeValue",
            BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.Equal("Product", normalize.Invoke(null, new object?[] { "  Product  " }));
        Assert.Equal(50, Assert.IsType<string>(normalize.Invoke(null, new object?[] { new string('x', 80) })).Length);

        var scopedIdempotencyColumns = Assert.IsType<string[]>(typeof(Upgrade21).GetField(
            "ScopedIdempotencyIndexColumns",
            BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null));
        Assert.Equal(new[]
        {
            "OsClient", "RuntimeOsClientType", "RuntimeOsClientNetwork", "IdempotencyKey"
        }, scopedIdempotencyColumns);
        Assert.NotEqual(
            BackgroundTaskService.GetScopedChatOnlineKey("iTdos", "admin", "Product", "Internet"),
            BackgroundTaskService.GetScopedChatOnlineKey("iTdos", "admin", "Product", "Internal"));
    }

    [Fact]
    public void DiyLangRuntimeCache_ExposesBoundedReloadContract()
    {
        var contract = typeof(IFormEngine).GetMethod(nameof(IFormEngine.ReloadDiyLangCacheAsync));
        var implementation = typeof(FormEngineExtend).GetMethod(
            nameof(IFormEngine.ReloadDiyLangCacheAsync),
            BindingFlags.Instance | BindingFlags.Public);

        Assert.NotNull(contract);
        Assert.Equal(typeof(Task<DosResult>), contract!.ReturnType);
        Assert.NotNull(implementation);
        Assert.False(implementation!.IsStatic);
        Assert.Equal(typeof(Task<DosResult>), implementation.ReturnType);

        var pageSize = typeof(FormEngineExtend).GetField(
            "DiyLangRuntimeCacheDefaultPageSize",
            BindingFlags.Static | BindingFlags.NonPublic);
        var maxRows = typeof(FormEngineExtend).GetField(
            "DiyLangRuntimeCacheDefaultMaxRows",
            BindingFlags.Static | BindingFlags.NonPublic);
        var maxCharacters = typeof(FormEngineExtend).GetField(
            "DiyLangRuntimeCacheDefaultMaxCharacters",
            BindingFlags.Static | BindingFlags.NonPublic);
        var commandTimeout = typeof(FormEngineExtend).GetField(
            "DiyLangRuntimeCacheDefaultCommandTimeoutSeconds",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.Equal(500, Assert.IsType<int>(pageSize!.GetRawConstantValue()));
        Assert.Equal(10_000, Assert.IsType<int>(maxRows!.GetRawConstantValue()));
        Assert.Equal(5_000_000, Assert.IsType<int>(maxCharacters!.GetRawConstantValue()));
        Assert.Equal(30, Assert.IsType<int>(commandTimeout!.GetRawConstantValue()));
    }

    [Fact]
    public void ProcessMemoryGuard_EvaluatesSoftAndHardThresholds()
    {
        var options = new ProcessMemoryGuardOptions
        {
            Enabled = true,
            SoftLimitBytes = 100,
            HardLimitBytes = 200
        };

        Assert.Equal(ProcessMemoryPressureLevel.Normal, options.Evaluate(99));
        Assert.Equal(ProcessMemoryPressureLevel.Soft, options.Evaluate(100));
        Assert.Equal(ProcessMemoryPressureLevel.Soft, options.Evaluate(199));
        Assert.Equal(ProcessMemoryPressureLevel.Hard, options.Evaluate(200));
    }

    [Fact]
    public void ProcessMemoryGuard_UsesResidentMemory_NotReservedPrivateAddressSpace()
    {
        var options = new ProcessMemoryGuardOptions
        {
            Enabled = true,
            SoftLimitBytes = 4L * 1024 * 1024 * 1024,
            HardLimitBytes = 5L * 1024 * 1024 * 1024
        };
        var state = new ProcessMemoryPressureState(options);
        var update = typeof(ProcessMemoryPressureState).GetMethod(
            "Update",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(update);
        update!.Invoke(state, new object[]
        {
            512L * 1024 * 1024,
            271_000L * 1024 * 1024,
            94L * 1024 * 1024,
            false
        });

        var snapshot = state.GetSnapshot();
        Assert.Equal(512L * 1024 * 1024, snapshot.ProcessBytes);
        Assert.Equal(512L * 1024 * 1024, snapshot.WorkingSetBytes);
        Assert.Equal(271_000L * 1024 * 1024, snapshot.PrivateBytes);
        Assert.Equal(ProcessMemoryPressureLevel.Normal, options.Evaluate(snapshot.ProcessBytes));
    }

    [Fact]
    public void ProcessMemoryGuard_DefaultsToNinetyFiveAndNinetyEightPercentOf48GiB()
    {
        const long gib = 1024L * 1024 * 1024;
        const long mib = 1024L * 1024;
        var options = ProcessMemoryGuardOptions.ForCapacity(
            new ProcessMemoryCapacity(48L * gib, "Test48GiB"));

        Assert.Equal(46_694L * mib, options.SoftLimitBytes);
        Assert.Equal(48_168L * mib, options.HardLimitBytes);
        Assert.Equal(48L * gib, options.EffectiveMemoryBytes);
        Assert.Equal("Test48GiB", options.EffectiveMemorySource);
        Assert.Equal(95, options.SoftLimitPercent);
        Assert.Equal(98, options.HardLimitPercent);
        Assert.Equal(ProcessMemoryPressureLevel.Normal, options.Evaluate(3_940L * mib));
    }

    [Fact]
    public void ProcessMemoryGuard_PrefersContainerLimitOverLargerHost()
    {
        const long gib = 1024L * 1024 * 1024;

        var capacity = ProcessMemoryCapacity.SelectForTest(
            hostBytes: 48L * gib,
            cgroupBytes: 8L * gib,
            cgroupSource: "TestCgroupV2");

        Assert.Equal(8L * gib, capacity.TotalBytes);
        Assert.Equal("TestCgroupV2", capacity.Source);
    }

    [Fact]
    public void SysLogQueue_UsesBoundedOverflowAndDurableEmergencySpool()
    {
        var spool = Path.Combine(Path.GetTempPath(), "microi-syslog-bounded-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(spool);
        try
        {
            var mongo = DispatchProxy.Create<IMongoDB, NoopMongoProxy>();
            var environment = new BoundedQueueHostEnvironment { ContentRootPath = spool };
            var service = new SysLogQueueService(
                mongo,
                NullLogger<SysLogQueueService>.Instance,
                environment,
                new SysLogQueueOptions
                {
                    Capacity = 2,
                    OverflowCapacity = 1,
                    BatchSize = 10,
                    SpoolDirectory = spool
                });

            for (var index = 0; index < 5; index++)
            {
                Assert.True(service.Enqueue(new SysLogParam
                {
                    OsClient = "bounded-test",
                    EventId = "bounded-" + index,
                    Action = "Enqueue"
                }));
            }

            var health = service.GetHealth();
            Assert.Equal(2, health.Capacity);
            Assert.Equal(1, health.OverflowCapacity);
            Assert.Equal(1, health.OverflowPending);
            Assert.Equal(2, health.EmergencySpooled);
            Assert.Equal(0, health.Dropped);
            Assert.Equal(5, health.Pending);
            Assert.Equal(2, Directory.EnumerateFiles(spool, "*.json").Count());
        }
        finally
        {
            if (Directory.Exists(spool)) Directory.Delete(spool, true);
        }
    }

    [Fact]
    public void TwoLevelCache_BoundsPublishConcurrencyPerTenant()
    {
        var type = typeof(MicroiTwoLevelCache);
        var publishGate = type.GetField("_publishGate", BindingFlags.Instance | BindingFlags.NonPublic);
        var subscriberInitialized = type.GetField(
            "_subscriberInitialized",
            BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic);
        var publishWithRetry = type.GetMethod(
            "PublishWithRetryAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(publishGate);
        Assert.Equal(typeof(SemaphoreSlim), publishGate!.FieldType);
        Assert.NotNull(subscriberInitialized);
        Assert.False(subscriberInitialized!.IsStatic);
        Assert.NotNull(publishWithRetry);
        Assert.Equal(typeof(Task), publishWithRetry!.ReturnType);
    }

    [Fact]
    public void TwoLevelCache_UsesContainerSafeInstanceIdentityForPubSubInvalidation()
    {
        var type = typeof(MicroiTwoLevelCache);
        var instanceId = type.GetField(
            "_cacheInstanceId",
            BindingFlags.Static | BindingFlags.NonPublic);
        var buildInstanceId = type.GetMethod(
            "BuildCacheInstanceId",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(instanceId);
        Assert.True(instanceId!.IsStatic);
        Assert.NotNull(buildInstanceId);

        var first = Assert.IsType<string>(buildInstanceId!.Invoke(null, null));
        var second = Assert.IsType<string>(buildInstanceId.Invoke(null, null));
        Assert.NotEqual(first, second);
        Assert.Contains($":{Environment.ProcessId}:", first);
    }

    [Fact]
    public void Upgrade_RepairsOnlyOfficialWebsiteAnonymousApiContract()
    {
        var type = typeof(MicroiUpgrade);
        var keysField = type.GetField(
            "OfficialWebsiteAnonymousApiEngineKeys",
            BindingFlags.Static | BindingFlags.NonPublic);
        var tenantCheck = type.GetMethod(
            "IsOfficialWebsiteTenant",
            BindingFlags.Static | BindingFlags.NonPublic);
        var repairMethod = type.GetMethod(
            "EnsureOfficialWebsitePublicApiEngineContractAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(keysField);
        var keys = Assert.IsType<string[]>(keysField!.GetValue(null));
        Assert.Equal(new[] { "send_sms_reg" }, keys);
        Assert.NotNull(tenantCheck);
        Assert.Equal(
            Microi.License.LicenseService.IsOfficialPlatform("iTdos"),
            Assert.IsType<bool>(tenantCheck!.Invoke(null, new object[] { "iTdos" })));
        Assert.False(Assert.IsType<bool>(tenantCheck.Invoke(null, new object[] { "customer" })));
        Assert.NotNull(repairMethod);
        Assert.Equal(typeof(Task), repairMethod!.ReturnType);
    }

    [Fact]
    public void AppStoreBundle_KeepsTrustedImporterAboveJintTwoGigabyteBoundary()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        var importer = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");

        Assert.True(
            importer["LimitMemory"]?.Value<int>() >= 3072,
            "The trusted package importer must retain enough cumulative-allocation budget for Jint 4.14.");
    }

    [Fact]
    public void AppStoreBundle_DeliversBulkButtonRuntimeDependencyAsOneVerifiedCapability()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        var packageVersionText = package["PackageInfo"]?["Version"]?.ToString();
        Assert.NotNull(packageVersionText);
        Assert.True(
            System.Version.TryParse(packageVersionText!.TrimStart('v', 'V'), out var packageVersion),
            $"应用商城包版本格式无效：{packageVersionText}");
        Assert.True(
            packageVersion!.CompareTo(new System.Version(7, 0, 5)) >= 0,
            $"批量安装能力要求应用商城包版本不低于 v7.0.5，当前为 {packageVersionText}");

        var bulkEngine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "bulk-import-microi-store-packages");
        Assert.Equal(1, bulkEngine["IsEnable"]?.Value<int>());
        Assert.Equal(0, bulkEngine["StopHttp"]?.Value<int>());
        AssertEngineVersionAtLeast(bulkEngine, new System.Version(1, 1, 1));
        Assert.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.DoesNotContain("mci_marketplace_bulk_install_item", bulkEngine["ApiV8Code"]?.ToString());

        var importer = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");
        AssertEngineVersionAtLeast(importer, new System.Version(1, 8, 6));
        Assert.Contains("PACKAGE_API_ENGINE_READBACK_V1", importer["ApiV8Code"]?.ToString());
    }

    [Fact]
    public void OfficialBundles_DoNotPersistRecursionAboveRuntimeHardCeiling()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var checkedEngines = 0;

        foreach (var resourceName in new[] { "app.microi.store.json", "app.microi.form-engine.json" })
        {
            var package = JObject.Parse(resources[resourceName]);
            foreach (var engine in package["SysApiEngines"]?.Children<JObject>() ?? [])
            {
                checkedEngines++;
                var limitRecursion = engine["LimitRecursion"]?.Value<int>() ?? 0;
                Assert.InRange(limitRecursion, 0, CreateV8EngineParam.MaxLimitRecursion);
            }
        }

        Assert.True(checkedEngines > 0, "The official bundles must contain interface engines to validate.");
    }

    [Fact]
    public void AppStoreRefresh_RejectsPersistedRecursionAboveEffectiveRuntimeCeiling()
    {
        var hasExpectedSettings = typeof(UpgradeAppStore).GetMethod(
            "HasExpectedPublisherSettings",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(hasExpectedSettings);

        var effectiveCeiling = Math.Min(5000, CreateV8EngineParam.MaxLimitRecursion);
        JObject Settings(int limitRecursion) => new()
        {
            ["StopHttp"] = 0,
            ["Timeout"] = 3600,
            ["MaxStatements"] = 100_000_000,
            ["LimitMemory"] = 2048,
            ["LimitRecursion"] = limitRecursion,
            ["Lock"] = 1
        };

        Assert.True(Assert.IsType<bool>(hasExpectedSettings!.Invoke(null, new object[] { Settings(effectiveCeiling) })));
        Assert.False(Assert.IsType<bool>(hasExpectedSettings.Invoke(null, new object[] { Settings(effectiveCeiling + 1) })));
    }

    [Fact]
    public void AppStorePackageImport_ClampsOnlineResourceRecursionBeforeInstall()
    {
        var normalizePackage = typeof(UpgradeAppStore).GetMethod(
            "NormalizePackageExecutionLimits",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(normalizePackage);

        const string packageText = """
        {"SysApiEngines":[{"ApiEngineKey":"old","LimitRecursion":10000},{"ApiEngineKey":"normal","LimitRecursion":2000}]}
        """;
        var normalized = Assert.IsType<string>(normalizePackage!.Invoke(null, new object[] { packageText }));
        var engines = JObject.Parse(normalized)["SysApiEngines"]!.Children<JObject>().ToArray();
        var effectiveCeiling = Math.Min(5000, CreateV8EngineParam.MaxLimitRecursion);

        Assert.Equal(effectiveCeiling, engines[0]["LimitRecursion"]!.Value<int>());
        Assert.Equal(2000, engines[1]["LimitRecursion"]!.Value<int>());
    }

    [Fact]
    public void UpgradeMenuPatch_ConvertsDynamicDataBeforeUsingJTokenExtensions()
    {
        dynamic data = JObject.Parse("""{"Id":"menu-a","Name":null}""");

        JObject currentMenu = JsonHelper.ToJObject((object)data) ?? new JObject();

        Assert.Equal("menu-a", currentMenu["Id"].Val<string>());
        Assert.Null(currentMenu["Name"].Val<string>());
    }

    [Fact]
    public void OnlineAppStoreBundle_WithLegacyImporterLimit_RemainsRuntimeRepairable()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        var validateResource = typeof(UpgradeAppStore).GetMethod(
            "ValidateResourceContent",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);
        Assert.NotNull(validateResource);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        var importer = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");
        importer["LimitMemory"] = 2048;

        var exception = Record.Exception(() => validateResource!.Invoke(
            null,
            new object[] { "app.microi.store.json", package.ToString() }));

        Assert.Null(exception);
    }

    private static void AssertEngineVersionAtLeast(JObject engine, System.Version minimum)
    {
        var versionText = engine["Version"]?.ToString();
        Assert.NotNull(versionText);
        Assert.True(
            System.Version.TryParse(versionText!.TrimStart('v', 'V'), out var version),
            $"接口引擎版本格式无效：{versionText}");
        Assert.True(
            version!.CompareTo(minimum) >= 0,
            $"接口引擎版本不得低于 v{minimum}，当前为 {versionText}");
        Assert.Contains($"Version: {versionText}", engine["ApiV8Code"]?.ToString());
    }
}

public class NoopMongoProxy : DispatchProxy
{
    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        throw new NotSupportedException($"Bounded queue test did not expect IMongoDB.{targetMethod?.Name}");
    }
}

public sealed class BoundedQueueHostEnvironment : IHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "Microi.Tests";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
