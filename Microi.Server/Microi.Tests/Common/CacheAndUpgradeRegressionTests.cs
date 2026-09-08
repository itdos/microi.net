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
    [Theory]
    [InlineData("v7.6.0", "7.6.0", true)]
    [InlineData("7.6.0.0", "v7.6.0", true)]
    [InlineData("v7.6.1", "v7.6.0", false)]
    [InlineData("legacy", "v7.6.0", false)]
    public void UpgradeAppStore_ComparesPackageVersionsWithoutPrefixOrPartDrift(
        string installed,
        string incoming,
        bool expected)
    {
        Assert.Equal(expected, UpgradeAppStore.PackageVersionsEquivalent(installed, incoming));
    }

    [Fact]
    public void UpgradeAppStore_ReadsDynamicVersionRowsWithoutRuntimeBinderExtensions()
    {
        dynamic row = new System.Dynamic.ExpandoObject();
        row.InstallStatus = "Installed";
        row.AppVersionInstall = "";
        row.PackageVersion = "v7.6.3";

        var version = UpgradeAppStore.ReadInstalledPackageVersionRow(
            (object)row,
            new[] { "AppVersionInstall", "PackageVersion", "AppVersion" },
            hasStatus: true,
            out var installedStatus);

        Assert.True(installedStatus);
        Assert.Equal("v7.6.3", version);
    }

    [Fact]
    public void FormEngine_DoesNotScanRedisForDisabledSqlCountCache()
    {
        Assert.False(FormEngineExtend.SqlCountCacheEnabled);
    }

    [Fact]
    public void UpgradeLease_ToleratesTransientRedisTimeoutsButStopsBeforeExpiry()
    {
        Assert.True(UpgradeDistributedLease.IsWithinOwnershipSafetyWindow(0));
        Assert.True(UpgradeDistributedLease.IsWithinOwnershipSafetyWindow(
            UpgradeDistributedLease.LeaseMilliseconds
            - UpgradeDistributedLease.ExpirySafetyMarginMilliseconds
            - 1));
        Assert.False(UpgradeDistributedLease.IsWithinOwnershipSafetyWindow(
            UpgradeDistributedLease.LeaseMilliseconds
            - UpgradeDistributedLease.ExpirySafetyMarginMilliseconds));
        Assert.InRange(
            UpgradeDistributedLease.RenewRetryIntervalMilliseconds,
            1_000,
            UpgradeDistributedLease.RenewIntervalMilliseconds - 1);

        var source = File.ReadAllText(Path.Combine(
            FindServerRoot(),
            "Microi.Upgrade",
            "UpgradeExecutionSafety.cs"));
        Assert.Contains("TaskCreationOptions.LongRunning", source, StringComparison.Ordinal);
        Assert.DoesNotContain("_renewTask = Task.Run", source, StringComparison.Ordinal);
    }

    [Fact]
    public void FormEngineContract_ExposesBoundedBatchCountPrimitiveToV8()
    {
        var contract = typeof(IFormEngine).GetMethod(nameof(IFormEngine.GetTableDataCountBatch));
        var implementation = typeof(FormEngine).GetMethod(nameof(IFormEngine.GetTableDataCountBatch));

        Assert.NotNull(contract);
        Assert.NotNull(implementation);
        Assert.Equal(typeof(DosResultList<dynamic>), contract!.ReturnType);
    }

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
        var scopedClaimColumns = Assert.IsType<string[]>(typeof(Upgrade21).GetField(
            "ScopedClaimIndexColumns",
            BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null));
        Assert.Equal(new[]
        {
            "OsClient", "RuntimeOsClientType", "RuntimeOsClientNetwork", "Status",
            "NextRunTime", "LeaseExpiresAt", "CreateTime"
        }, scopedClaimColumns);
        var laneClaimColumns = Assert.IsType<string[]>(typeof(Upgrade21).GetField(
            "LaneClaimIndexColumns",
            BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null));
        Assert.Equal(new[]
        {
            "OsClient", "ApiEngineKey", "RuntimeOsClientType", "RuntimeOsClientNetwork",
            "Status", "NextRunTime", "LeaseExpiresAt", "CreateTime"
        }, laneClaimColumns);
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
        Assert.Equal(50_000, Assert.IsType<int>(maxRows!.GetRawConstantValue()));
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
                    SpoolDirectory = spool,
                    PersistenceConfigured = _ => true
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
    public async Task TwoLevelCache_BoundsAStalledPublishWithoutLeakingItsLateFault()
    {
        var stalled = new TaskCompletionSource<bool>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var awaitPublish = typeof(MicroiTwoLevelCache).GetMethod(
            "AwaitPublishWithinAsync",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(awaitPublish);

        await Assert.ThrowsAsync<TimeoutException>(async () =>
            await Assert.IsAssignableFrom<Task>(awaitPublish!.Invoke(
                null,
                new object[] { stalled.Task, TimeSpan.FromMilliseconds(25) })));

        stalled.TrySetException(new InvalidOperationException("late publish failure"));
        await Task.Delay(10, TestContext.Current.CancellationToken);
        Assert.True(stalled.Task.IsFaulted);
        Assert.True(stalled.Task.Exception?.InnerException is InvalidOperationException);
    }

    [Fact]
    public void TwoLevelCache_PublishTimeoutOpensABoundedCooldown()
    {
        var type = typeof(MicroiTwoLevelCache);
        var timeout = type.GetField(
            "PublishWaitTimeout",
            BindingFlags.Static | BindingFlags.NonPublic);
        var cooldown = type.GetField(
            "PublishFailureCooldown",
            BindingFlags.Static | BindingFlags.NonPublic);
        var suppressedUntil = type.GetField(
            "_publishSuppressedUntilTicks",
            BindingFlags.Instance | BindingFlags.NonPublic);
        var openCooldown = type.GetMethod(
            "OpenPublishFailureCooldown",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(timeout);
        Assert.NotNull(cooldown);
        Assert.NotNull(suppressedUntil);
        Assert.NotNull(openCooldown);
        Assert.InRange((TimeSpan)timeout!.GetValue(null)!, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(10));
        Assert.InRange((TimeSpan)cooldown!.GetValue(null)!, TimeSpan.FromSeconds(5), TimeSpan.FromMinutes(1));
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
    public void AppStoreBundle_DeliversStartupRuntimeDependenciesAsOneVerifiedCapability()
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
            packageVersion!.CompareTo(new System.Version(7, 5, 50)) >= 0,
            $"完整启动依赖与旧导入器兼容桥要求应用商城包版本不低于 v7.5.50，当前为 {packageVersionText}");

        var bulkEngine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "bulk-import-microi-store-packages");
        Assert.Equal(1, bulkEngine["IsEnable"]?.Value<int>());
        Assert.Equal(0, bulkEngine["StopHttp"]?.Value<int>());
        AssertEngineVersionAtLeast(bulkEngine, new System.Version(1, 3, 8));
        Assert.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("BULK_BOUNDED_PACKAGE_SLICES_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("StoreVersionId", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("BulkAdaptiveSingleSlice: false", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("STARTUP_DEPENDENCY_RESOURCE_CLOSURE_V2", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("STARTUP_DEPENDENCY_PREINSTALL_BOOTSTRAP_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("STARTUP_DEPENDENCY_BOOTSTRAP_ONLY_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("BULK_PACKAGE_MANAGED_OVERWRITE_RECOVERY_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("MARKETPLACE_LIST_ROUTE_FAILOVER_V1", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("platform-sys-menu", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains("platform-sys-config", bulkEngine["ApiV8Code"]?.ToString());
        Assert.Contains(
            "BackgroundTask:StartupDependencyResourceClosureV2",
            package["PackageInfo"]?["RequiredPlatformCapabilities"]?.Values<string>() ?? Array.Empty<string>());
        Assert.Contains(
            "BackgroundTask:StartupDependencyBootstrapOnlyV1",
            package["PackageInfo"]?["RequiredPlatformCapabilities"]?.Values<string>() ?? Array.Empty<string>());
        Assert.DoesNotContain("mci_marketplace_bulk_install_item", bulkEngine["ApiV8Code"]?.ToString());

        var importer = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");
        AssertEngineVersionAtLeast(importer, new System.Version(2, 4, 3));
        Assert.Contains("PACKAGE_API_ENGINE_READBACK_V1", importer["ApiV8Code"]?.ToString());
        Assert.Contains("PACKAGE_REPLAY_VERSION_GUARD_V2", importer["ApiV8Code"]?.ToString());
        Assert.Contains("PackagePointerMode: 'HdfsV1'", importer["ApiV8Code"]?.ToString());
        Assert.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_BATCH_V1", importer["ApiV8Code"]?.ToString());
        Assert.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_CHECKPOINT_V1", importer["ApiV8Code"]?.ToString());
        Assert.Contains("BULK_PLATFORM_BOOTSTRAP_ORDER_V1", package.ToString());

        var storeModelEngine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "get-microi-store-model");
        AssertEngineVersionAtLeast(storeModelEngine, new System.Version(1, 2, 9));
        Assert.Contains(
            "MARKETPLACE_LEGACY_IMPORTER_HDFS_BRIDGE_V1",
            storeModelEngine["ApiV8Code"]?.ToString());

        var backgroundTaskEngine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-background-task");
        Assert.Equal("/apiengine/platform-background-task", backgroundTaskEngine["ApiAddress"]?.ToString());
        Assert.Equal(1, backgroundTaskEngine["IsEnable"]?.Value<int>());
        Assert.Equal(0, backgroundTaskEngine["StopHttp"]?.Value<int>());
        Assert.Equal(0, backgroundTaskEngine["AllowAnonymous"]?.Value<int>());
        AssertEngineVersionAtLeast(backgroundTaskEngine, new System.Version(1, 1, 0));
        Assert.Contains(
            "V8.Method.ManageBackgroundTask(V8.Param)",
            backgroundTaskEngine["ApiV8Code"]?.ToString());
        Assert.Equal(
            "Managed",
            package["ResourcePolicies"]?["ApiEngines"]?["platform-background-task"]?["UpgradePolicy"]?.ToString());
        Assert.Contains(
            package["PackageInfo"]?["RequiredPlatformCapabilities"]!.Values<string>(),
            item => item == "ServerFeature:V8.ManageBackgroundTask");
        Assert.Contains(
            package["PackageInfo"]?["RequiredPlatformCapabilities"]!.Values<string>(),
            item => item == "ApiEngine:platform-background-task@v1.1.0");

        var sysMenuEngine = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-sys-menu");
        Assert.Equal("/apiengine/platform-sys-menu", sysMenuEngine["ApiAddress"]?.ToString());
        Assert.Equal(1, sysMenuEngine["IsEnable"]?.Value<int>());
        Assert.Equal(0, sysMenuEngine["StopHttp"]?.Value<int>());
        Assert.Equal(0, sysMenuEngine["AllowAnonymous"]?.Value<int>());
        AssertEngineVersionAtLeast(sysMenuEngine, new System.Version(1, 0, 3));
        Assert.Contains(
            "V8.Method.ManageSystemDirectory",
            sysMenuEngine["ApiV8Code"]?.ToString());
        Assert.Contains("Domain: 'SysMenu'", sysMenuEngine["ApiV8Code"]?.ToString());
        Assert.Contains("GetRolePermissionTree", sysMenuEngine["ApiV8Code"]?.ToString());
        Assert.Equal(
            "Managed",
            package["ResourcePolicies"]?["ApiEngines"]?["platform-sys-menu"]?["UpgradePolicy"]?.ToString());
        Assert.Contains(
            package["PackageInfo"]?["RequiredPlatformCapabilities"]!.Values<string>(),
            item => item == "V8.Method.ManageSystemDirectory");
        Assert.Contains(
            package["PackageInfo"]?["RequiredPlatformCapabilities"]!.Values<string>(),
            item => item == "ApiEngine:platform-sys-menu@v1.0.1");
    }

    [Fact]
    public void AppStoreUpgrade_RejectsWorkersWithoutPinnedSnapshotCapabilities()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        var hasImporter = typeof(UpgradeAppStore).GetMethod(
            "HasPinnedImporterCapabilities",
            BindingFlags.Static | BindingFlags.NonPublic);
        var hasBulk = typeof(UpgradeAppStore).GetMethod(
            "HasPinnedBulkCapabilities",
            BindingFlags.Static | BindingFlags.NonPublic);
        var hasSysMenu = typeof(UpgradeAppStore).GetMethod(
            "HasPlatformSysMenuCapabilities",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);
        Assert.NotNull(hasImporter);
        Assert.NotNull(hasBulk);
        Assert.NotNull(hasSysMenu);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        var importer = Assert.Single(package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");
        var importerCode = importer["ApiV8Code"]?.ToString() ?? string.Empty;
        var importerVersion = new System.Version(importer["Version"]!.ToString().TrimStart('v', 'V'));
        Assert.True(Assert.IsType<bool>(hasImporter!.Invoke(null,
            new object[] { importerCode, importerVersion })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode, new System.Version(2, 8, 9) })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode, new System.Version(2, 7, 4) })));
        foreach (var capability in new[] { "DATASET_TABLE_PREFLIGHT_V1", "PACKAGE_API_ENGINE_AUTHORITATIVE_READBACK_V2" })
            Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
                new object[] { importerCode.Replace(capability, "LEGACY_CAPABILITY"), importerVersion })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(
            null,
            new object[] { importerCode, new System.Version(2, 7, 1) })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode, new System.Version(2, 4, 9) })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode.Replace("PACKAGE_REPLAY_VERSION_GUARD_V2", "LEGACY_REPLAY_GUARD"), importerVersion })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode.Replace("PackagePointerMode: 'HdfsV1'", "PackagePointerMode: 'Legacy'"), importerVersion })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode.Replace("TRUSTED_EMBEDDED_OFFICIAL_PACKAGE_V1", "LEGACY_EMBEDDED_PACKAGE_TRUST"), importerVersion })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode.Replace("PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1", "LEGACY_NOT_NULL_BACKFILL"), importerVersion })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode.Replace("MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1", "LEGACY_CHANGELOG_BACKFILL"), new System.Version(2, 7, 4) })));
        Assert.False(Assert.IsType<bool>(hasImporter.Invoke(null,
            new object[] { importerCode.Replace("PAGE_ENGINE_OPTIONAL_REFERENCE_V1", "LEGACY_PAGE_REFERENCE"), importerVersion })));

        var bulk = Assert.Single(package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "bulk-import-microi-store-packages");
        var bulkCode = bulk["ApiV8Code"]?.ToString() ?? string.Empty;
        Assert.True(Assert.IsType<bool>(hasBulk!.Invoke(null,
            new object[] { bulkCode, new System.Version(1, 3, 8) })));
        Assert.False(Assert.IsType<bool>(hasBulk.Invoke(null,
            new object[] { bulkCode, new System.Version(1, 3, 7) })));
        Assert.False(Assert.IsType<bool>(hasBulk.Invoke(null,
            new object[] { bulkCode.Replace("BulkAdaptiveSingleSlice: false", "BulkAdaptiveSingleSlice: true"), new System.Version(1, 3, 8) })));
        Assert.False(Assert.IsType<bool>(hasBulk.Invoke(null,
            new object[] { bulkCode.Replace("STARTUP_DEPENDENCY_RESOURCE_CLOSURE_V2", "STARTUP_DEPENDENCY_RESOURCE_CLOSURE_V1"), new System.Version(1, 3, 8) })));
        Assert.False(Assert.IsType<bool>(hasBulk.Invoke(null,
            new object[] { bulkCode.Replace("STARTUP_DEPENDENCY_BOOTSTRAP_ONLY_V1", "LEGACY_STARTUP_BOOTSTRAP"), new System.Version(1, 3, 8) })));

        var sysMenu = Assert.Single(package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-sys-menu");
        var sysMenuCode = sysMenu["ApiV8Code"]?.ToString() ?? string.Empty;
        Assert.True(Assert.IsType<bool>(hasSysMenu!.Invoke(null,
            new object[] { sysMenuCode, new System.Version(1, 0, 1) })));
        Assert.False(Assert.IsType<bool>(hasSysMenu.Invoke(null,
            new object[] { sysMenuCode, new System.Version(1, 0, 0) })));
        Assert.False(Assert.IsType<bool>(hasSysMenu.Invoke(null,
            new object[] { sysMenuCode.Replace("V8.Method.ManageSystemDirectory", "V8.Method.LegacySysMenu"), new System.Version(1, 0, 1) })));
        Assert.False(Assert.IsType<bool>(hasSysMenu.Invoke(null,
            new object[] { sysMenuCode.Replace("platform-marketplace-source-hook", "missing-menu-hook"), new System.Version(1, 0, 1) })));
    }

    [Fact]
    public void AppStoreBundle_DeliversMarketplaceRuntimeAndDetectsBrokenRuntimeBindings()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        var hasPackagedRuntime = typeof(UpgradeAppStore).GetMethod(
            "HasPackagedMarketplaceRuntime",
            BindingFlags.Static | BindingFlags.NonPublic);
        var getRepairReason = typeof(UpgradeAppStore).GetMethod(
            "GetMarketplaceRuntimeRepairReason",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);
        Assert.NotNull(hasPackagedRuntime);
        Assert.NotNull(getRepairReason);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        Assert.True(Assert.IsType<bool>(hasPackagedRuntime!.Invoke(null, new object[] { package })));

        var brokenPackage = (JObject)package.DeepClone();
        var brokenBundle = Assert.Single(brokenPackage["ApplicationBundles"]!.Children<JObject>(),
            item => item["Application"]?["AppKey"]?.ToString() == "microi-platform-service");
        var marketplaceRoute = Assert.Single(brokenBundle["Routes"]!.Children<JObject>(),
            item => item["RoutePath"]?.ToString() == "/marketplace");
        marketplaceRoute.Remove();
        Assert.False(Assert.IsType<bool>(hasPackagedRuntime.Invoke(null, new object[] { brokenPackage })));

        var bundle = Assert.Single(package["ApplicationBundles"]!.Children<JObject>(),
            item => item["Application"]?["AppKey"]?.ToString() == "microi-platform-service");
        var serviceId = bundle["MicroService"]!["Id"]!.ToString();
        var route = Assert.Single(bundle["Routes"]!.Children<JObject>(),
            item => item["RoutePath"]?.ToString() == "/marketplace");
        var pageId = route["Id"]!.ToString();
        var runtimeAssets = new JArray(bundle["BuildAssets"]!.Children<JObject>().Select(asset => new JObject
        {
            ["Path"] = asset["Path"]?.ToString(),
            ["ContentBase64"] = asset["FileByteBase64"]?.ToString()
        }));
        var menu = new JObject
        {
            ["Id"] = "61b7faee-35b2-4571-add2-5231a355f368",
            ["OpenType"] = "MicroService",
            ["IsMicroiService"] = 1,
            ["ComponentPath"] = "/micro-app/host",
            ["MicroServiceId"] = serviceId,
            ["MicroServicePageId"] = pageId,
            ["MicroServiceRoutePath"] = "/marketplace"
        };
        var service = new JObject
        {
            ["Id"] = serviceId,
            ["MsKey"] = "microi-platform-service",
            ["IsEnable"] = 1,
            ["Runtime"] = "micro-app",
            ["StorageMode"] = "db",
            ["MsUrl"] = "db",
            ["EntryPath"] = "index.html",
            ["BuildVersion"] = bundle["MicroService"]!["BuildVersion"]?.ToString(),
            ["AssetsJson"] = runtimeAssets.ToString()
        };
        var page = new JObject
        {
            ["Id"] = pageId,
            ["MicroServiceId"] = serviceId,
            ["MicroServiceKey"] = "microi-platform-service",
            ["RoutePath"] = "/marketplace",
            ["IsEnable"] = 1
        };

        Assert.Null(getRepairReason!.Invoke(null, new object[] { menu, service, page }));
        menu["MicroServicePageId"] = null;
        var reason = Assert.IsType<string>(getRepairReason.Invoke(null, new object[] { menu, service, page }));
        Assert.Contains("页面绑定", reason);
    }

    [Fact]
    public void OfficialSsoBundle_IsEmbeddedAndCarriesManagedHookRuntimeContract()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        var hasPackagedSsoRuntime = typeof(UpgradeAppStore).GetMethod(
            "HasPackagedSsoRuntime",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);
        Assert.NotNull(hasPackagedSsoRuntime);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        Assert.Contains("app.microi.sso.json", resources.Keys);
        var package = JObject.Parse(resources["app.microi.sso.json"]);
        Assert.True(Assert.IsType<bool>(hasPackagedSsoRuntime!.Invoke(null, new object[] { package })));
        Assert.Equal("v7.6.0", package["PackageInfo"]?["Version"]?.ToString());
        Assert.Equal("Platform", package["PackageInfo"]?["ApplicationType"]?.ToString());
        Assert.Equal(35, package["SysApiEngines"]?.Children<JObject>().Count());

        var casLogin = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "sso_http_cas_login");
        Assert.Equal("/cas/{OsClient}/login", casLogin["ApiAddress"]?.ToString());
        Assert.Equal("HTTP", casLogin["ResponseType"]?.ToString());
        Assert.Contains("V8.Method.RunSsoProtocol", casLogin["ApiV8Code"]?.ToString());
        Assert.Equal(
            "Managed",
            package["ResourcePolicies"]?["ApiEngines"]?["sso_http_cas_login"]?["UpgradePolicy"]?.ToString());

        var hook = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "sso_event_hook");
        Assert.Equal(
            "CreateIfMissing",
            package["ResourcePolicies"]?["ApiEngines"]?["sso_event_hook"]?["UpgradePolicy"]?.ToString());
        Assert.StartsWith(
            "/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1",
            hook["ApiV8Code"]?.ToString()?.TrimStart());

        var brokenPackage = (JObject)package.DeepClone();
        var protocolEvent = Assert.Single(
            brokenPackage["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "sso_protocol_event");
        protocolEvent["ApiV8Code"] = protocolEvent["ApiV8Code"]?.ToString()
            .Replace("SSO_TENANT_HOOK_SAFE_PAYLOAD_V1", "UNSAFE_PAYLOAD");
        Assert.False(Assert.IsType<bool>(hasPackagedSsoRuntime.Invoke(null, new object[] { brokenPackage })));
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

    [Fact]
    public async Task SysLogQueue_UnconfiguredTenantSkipsPersistenceWithoutCreatingSpool()
    {
        var spool = Path.Combine(Path.GetTempPath(), "microi-syslog-unconfigured-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(spool);
        try
        {
            var service = new SysLogQueueService(
                DispatchProxy.Create<IMongoDB, NoopMongoProxy>(),
                NullLogger<SysLogQueueService>.Instance,
                new BoundedQueueHostEnvironment { ContentRootPath = spool },
                new SysLogQueueOptions
                {
                    SpoolDirectory = spool,
                    PersistenceConfigured = _ => false
                });

            await service.StartAsync(TestContext.Current.CancellationToken);
            Assert.True(service.Enqueue(new SysLogParam
            {
                OsClient = "without-mongo",
                EventId = "without-mongo-1",
                Action = "Skip"
            }));

            var deadline = DateTime.UtcNow.AddSeconds(3);
            while (service.GetHealth().Pending > 0 && DateTime.UtcNow < deadline)
                await Task.Delay(20, TestContext.Current.CancellationToken);
            await service.StopAsync(TestContext.Current.CancellationToken);

            var health = service.GetHealth();
            Assert.Equal(1, health.Enqueued);
            Assert.Equal(1, health.SkippedUnconfigured);
            Assert.Equal(0, health.Pending);
            Assert.Empty(Directory.EnumerateFiles(spool));
        }
        finally
        {
            if (Directory.Exists(spool)) Directory.Delete(spool, true);
        }
    }

    [Fact]
    public async Task SysLogQueue_SpoolCapacityDirectWriteIsolatesTenants()
    {
        var spool = Path.Combine(Path.GetTempPath(), "microi-syslog-partition-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(spool);
        File.WriteAllText(Path.Combine(spool, "existing.json"), "[]");
        try
        {
            var mongo = DispatchProxy.Create<IMongoDB, PartitionedMongoProxy>();
            var recorder = Assert.IsAssignableFrom<PartitionedMongoProxy>(mongo);
            var service = new SysLogQueueService(
                mongo,
                NullLogger<SysLogQueueService>.Instance,
                new BoundedQueueHostEnvironment { ContentRootPath = spool },
                new SysLogQueueOptions
                {
                    BatchSize = 10,
                    MaxSpoolFiles = 1,
                    SpoolDirectory = spool,
                    PersistenceConfigured = _ => true
                });
            var persist = typeof(SysLogQueueService).GetMethod(
                "JournalAndPersistAsync",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.NotNull(persist);

            var task = Assert.IsAssignableFrom<Task>(persist!.Invoke(service, new object[]
            {
                new List<SysLogParam>
                {
                    new() { OsClient = "goodTenant", EventId = "good-1", OccurredAt = DateTime.Now },
                    new() { OsClient = "badTenant", EventId = "bad-1", OccurredAt = DateTime.Now }
                },
                TestContext.Current.CancellationToken
            }));
            await task;

            var health = service.GetHealth();
            Assert.Equal(1, health.Persisted);
            Assert.Equal(1, health.Dropped);
            Assert.Equal(1, health.FailedBatches);
            Assert.Contains("badtenant", health.LastError, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(new[] { "badTenant", "goodTenant" }, recorder.TenantCalls.OrderBy(value => value));
        }
        finally
        {
            if (Directory.Exists(spool)) Directory.Delete(spool, true);
        }
    }

    [Fact]
    public void MongoSysLog_ResolvesRuntimeTenantKeyWithoutChangingConfiguredCase()
    {
        var resolve = typeof(V8MongoDB).GetMethod(
            "ResolveRuntimeTenantKey",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(resolve);

        const string configuredTenant = "CaseSensitiveTenantForSysLog";
        var added = Microi.net.OsClient.ClientList.TryAdd(
            configuredTenant,
            new OsClientSecret { OsClient = configuredTenant, OsClientModel = new JObject() });
        try
        {
            Assert.Equal(
                configuredTenant,
                Assert.IsType<string>(resolve!.Invoke(null, new object[] { configuredTenant.ToLowerInvariant() })));
        }
        finally
        {
            if (added) Microi.net.OsClient.ClientList.TryRemove(configuredTenant, out _);
        }
    }

    [Fact]
    public void MongoSysLog_CircuitBreakerIsIsolatedPerMonthlyCollection()
    {
        var buildCircuitKey = typeof(V8MongoDB).GetMethod(
            "BuildSysLogCircuitKey",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(buildCircuitKey);

        var july = new MongodbHost { Connection = "mongodb://example", DataBase = "sys_log_itdos", Table = "log_202607" };
        var august = new MongodbHost { Connection = "mongodb://example", DataBase = "sys_log_itdos", Table = "log_202608" };
        var julyKey = Assert.IsType<string>(buildCircuitKey!.Invoke(null, new object[] { july }));
        var augustKey = Assert.IsType<string>(buildCircuitKey.Invoke(null, new object[] { august }));

        Assert.NotEqual(julyKey, augustKey);
        Assert.EndsWith("|log_202607", julyKey, StringComparison.Ordinal);
        Assert.EndsWith("|log_202608", augustKey, StringComparison.Ordinal);
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

    private static string FindServerRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            var directCandidate = directory.FullName;
            if (IsServerRoot(directCandidate))
                return directCandidate;

            var nestedCandidate = Path.Combine(directory.FullName, "Microi.Server");
            if (IsServerRoot(nestedCandidate))
                return nestedCandidate;

            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录。");
    }

    private static bool IsServerRoot(string path)
    {
        return File.Exists(Path.Combine(path, "Microi.Upgrade", "Microi.Upgrade.csproj"))
            && File.Exists(Path.Combine(path, "Microi.net.Api", "Microi.net.Api.csproj"));
    }
}

public class NoopMongoProxy : DispatchProxy
{
    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        throw new NotSupportedException($"Bounded queue test did not expect IMongoDB.{targetMethod?.Name}");
    }
}

public class PartitionedMongoProxy : DispatchProxy
{
    public List<string> TenantCalls { get; } = new();

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        if (targetMethod?.Name == nameof(IMongoDB.AddSysLogs))
        {
            var batch = Assert.IsAssignableFrom<IReadOnlyCollection<SysLogParam>>(args![0]);
            var tenant = batch.First().OsClient;
            TenantCalls.Add(tenant);
            return Task.FromResult(string.Equals(tenant, "badTenant", StringComparison.OrdinalIgnoreCase)
                ? new DosResult(0, null, "simulated tenant failure")
                : new DosResult(1, batch.Count));
        }
        throw new NotSupportedException($"Partitioned queue test did not expect IMongoDB.{targetMethod?.Name}");
    }
}

public sealed class BoundedQueueHostEnvironment : IHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "Microi.Tests";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
