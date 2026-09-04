namespace Dos.Common.Tests;

public sealed class BackgroundTaskWorkerSupervisionTests
{
    [Fact]
    public void Worker_IsRegisteredSupervisedObservableAndSchemaAware()
    {
        var serverRoot = FindServerRoot();
        var program = File.ReadAllText(Path.Combine(serverRoot, "Microi.net.Api", "Program.cs"));
        var startup = File.ReadAllText(Path.Combine(serverRoot, "Microi.net", "Common", "DiyStartup.cs"));
        var worker = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net",
            "Runtime",
            "BackgroundTaskWorkerService.cs"));
        var atom = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "V8Engine",
            "Runtime",
            "V8Method.cs"));
        var workerRuntime = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "Runtime",
            "BackgroundTaskWorkerRuntime.cs"));
        var engine = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Upgrade",
            "Resource",
            "platform-background-task.js"));
        var runtime = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "Runtime",
            "BackgroundTaskService.cs"));
        var store = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "Runtime",
            "BackgroundTaskStore.cs"));

        Assert.Contains("services.AddHostedService<BackgroundTaskWorkerService>()", startup);
        Assert.DoesNotContain("AddHostedService<BackgroundTaskWorkerService>", program);
        Assert.Contains("while (!stoppingToken.IsCancellationRequested)", worker);
        Assert.Contains("BackgroundTaskWorkerRuntime.MarkFault(ex)", worker);
        Assert.Contains("BackgroundTaskWorkerRuntime.MarkHeartbeat", worker);
        Assert.Contains("LoopHealthy", workerRuntime);
        Assert.Contains("WorkerStatus", engine);
        Assert.Contains("BackgroundTaskService.GetWorkerReadiness()", atom);
        Assert.False(File.Exists(Path.Combine(
            serverRoot, "Microi.net.Api", "Controllers", "BackgroundTaskController.cs")));
        Assert.Contains("BackgroundTaskStore.TryGetAvailability", runtime);
        Assert.Contains("heartbeat?.Invoke()", runtime);
        Assert.Contains("RunningSlotCount", runtime);
        Assert.Contains("BackgroundTaskSchedulingPolicy.CanAdmit", runtime);
        Assert.Contains("BackgroundTaskSchedulingPolicy.ExcludedApiEngineKeys", runtime);
        Assert.Contains("BackgroundTaskSchedulingPolicy.LaneConcurrencyKey", runtime);
        Assert.Contains("new List<WorkerSlot>()", runtime);
        Assert.DoesNotContain("Dictionary<Task", runtime);
        Assert.Contains("Task.Run(", runtime);
        Assert.Contains("CancellationToken.None", runtime);
        Assert.Contains("\"LaneV1\"", runtime);
        Assert.Contains("DiyLangBackgroundTaskService.ClusterConcurrencyKey", runtime);
        Assert.Contains("ChildTenantPlatformAppControlService.ClusterConcurrencyKey", runtime);
        Assert.Contains("ChildTenantPlatformAppControlService.ChildWorkerApiEngineKey", runtime);
        Assert.Contains("CHILD_TENANT_EXECUTION_BOOTSTRAP_V1", runtime);
        Assert.Contains("CHILD_TENANT_EXECUTION_BOOTSTRAP_SCOPE_V1", runtime);
        Assert.Contains("RequiresTargetExecutionBootstrap", runtime);
        Assert.Contains("EnsureTargetExecutionBootstrap", runtime);
        Assert.Contains("concurrencyLeaseOsClient = OsClientExtend.GetConfigOsClient()", runtime);
        Assert.Contains("ActiveTasks", runtime);
        Assert.Contains("CommandFlags.FireAndForget", runtime);
        Assert.Contains("WorkerRenewalShutdownTimedOut", runtime);
        Assert.Contains("WorkerLeaseRenewalFailed", runtime);
        Assert.Contains("ShouldRetryRenewalFailure", runtime);
        Assert.Contains("PendingNotifications", runtime);
        Assert.Contains("SignalWorker(item.OsClient, item.ApiEngineKey)", runtime);
        Assert.Contains("WorkerWakeQueue.TryTake", runtime);
        Assert.Contains("WorkerWakeQueue.HasPending", runtime);
        Assert.Contains("WorkerWakeQueue.HasPendingTaskLane", runtime);
        Assert.Contains(".Concat(OsClientExtend.ClientList.Keys)", runtime);
        Assert.DoesNotContain("WorkerWakeQueue.HasPendingExcept", runtime);
        Assert.Contains("hintsSinceCompletedRecovery", runtime);
        Assert.Contains("recoveryAttemptCompleted", runtime);
        Assert.Contains("genericRecoveryYielded", runtime);
        Assert.Contains("tenantScanBatchSize: forceRecoveryScan", runtime);
        Assert.Contains("ScheduleWorkerWake(item)", runtime);
        Assert.DoesNotContain("var current = BackgroundTaskStore.Get(item.OsClient, item.Id)", runtime);
        Assert.Contains("Msg='等待同一并发组的上一项任务完成'", store);
        Assert.Contains("AttemptCount>=MaxAttempts", store);
        Assert.Contains("任务已耗尽重试次数，系统已自动终结", store);
        Assert.Contains("ApiEngineKey NOT IN", store);
        Assert.Contains("ApiEngineKey=@requiredApiEngineKey", store);
        Assert.Contains("BACKGROUND_TASK_READY_TIME_FAIR_ORDER_V1", store);
        Assert.Contains(
            "ORDER BY COALESCE(NextRunTime, CreateTime) ASC, CreateTime ASC",
            store);
        Assert.Contains("BACKGROUND_TASK_CONSECUTIVE_RETRY_BUDGET_V1", store);
        Assert.Contains("AttemptCount=0,LastError=''", store);
        Assert.Contains("LastError=@p9", store);
        Assert.Contains("Interlocked.Increment(ref _tenantScanCursor)", store);
        Assert.Contains("TenantScanBatchSize = 4", store);
        Assert.Contains("ValidateSchemaCached", store);
        Assert.Contains("TryReadCandidate", store);
        Assert.Contains("SetCommandTimeout(TenantScanCommandTimeoutSeconds)", store);
        Assert.Contains("item.LeaseExpiresAt = leaseExpiresAt", store);
        Assert.Contains("Math.Max(1, Math.Min(3600, delaySeconds))", store);
        Assert.Contains(
            "BackgroundTaskStore.ResolveLeaseSeconds(item.ApiEngineKey) * 1000",
            runtime);
    }

    [Fact]
    public void TenantScanOrder_RotatesInsteadOfRestartingAtTheAlphabeticalFirstTenant()
    {
        var tenants = new[] { "iTdos", "alpha", "nbcmc", "zeta" };

        Assert.Equal(
            new[] { "iTdos", "alpha", "nbcmc", "zeta" },
            Microi.net.BackgroundTaskStore.RotateTenantScanOrder(tenants, 0));
        Assert.Equal(
            new[] { "nbcmc", "zeta", "iTdos", "alpha" },
            Microi.net.BackgroundTaskStore.RotateTenantScanOrder(tenants, 2));
        Assert.Equal(
            new[] { "iTdos", "alpha", "nbcmc", "zeta" },
            Microi.net.BackgroundTaskStore.RotateTenantScanOrder(tenants, 4));
    }

    [Fact]
    public void TenantRecoveryScan_IsBoundedAndRotatesAcrossEveryTenant()
    {
        var tenants = Enumerable.Range(0, 10).Select(index => "tenant-" + index).ToArray();
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var cursor = 0; cursor < tenants.Length; cursor += 4)
        {
            var batch = Microi.net.BackgroundTaskStore.GetTenantScanBatch(tenants, cursor, 4);
            Assert.InRange(batch.Count, 1, 4);
            visited.UnionWith(batch);
        }

        Assert.Equal(tenants.OrderBy(value => value), visited.OrderBy(value => value));
    }

    [Fact]
    public void Scheduler_IsolatesTenantTaskLanesAndBoundsPlatformMaintenance()
    {
        const int workerParallelism = 4;
        var running = new List<Microi.net.BackgroundTaskLaneState>();
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "junchi", "junchi_material_request_approve", running, workerParallelism));
        running.Add(new Microi.net.BackgroundTaskLaneState
        {
            OsClient = "junchi",
            ApiEngineKey = "junchi_material_request_approve"
        });

        Assert.False(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "JUNCHI", "JUNCHI_MATERIAL_REQUEST_APPROVE", running, workerParallelism));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "junchi", "junchi_material_request_generate_requisition", running, workerParallelism));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "itdos", "junchi_material_request_approve", running, workerParallelism));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "junchi", "import-microi-store-package", running, workerParallelism));

        running.Add(new Microi.net.BackgroundTaskLaneState
        {
            OsClient = "junchi",
            ApiEngineKey = "import-microi-store-package"
        });
        Assert.False(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "junchi", "bulk-import-microi-store-packages", running, workerParallelism));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "itdos", "bulk-import-microi-store-packages", running, workerParallelism));
        running.Add(new Microi.net.BackgroundTaskLaneState
        {
            OsClient = "itdos",
            ApiEngineKey = "bulk-import-microi-store-packages"
        });
        Assert.False(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "huayou", "import-microi-store-package", running, workerParallelism));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.CanAdmit(
            "itdos", "ordinary-business-engine", running, workerParallelism));
        Assert.Equal(
            2,
            Microi.net.BackgroundTaskSchedulingPolicy.MaxPlatformMaintenanceParallelism(
                workerParallelism));
    }

    [Fact]
    public void LaneIdentity_IsScopedByTenantAndTaskType()
    {
        var audit = Microi.net.BackgroundTaskWakeQueue.BuildLaneKey(" junchi ", " audit ");
        Assert.Equal(
            audit,
            Microi.net.BackgroundTaskWakeQueue.BuildLaneKey("JUNCHI", "AUDIT"));
        Assert.NotEqual(
            audit,
            Microi.net.BackgroundTaskWakeQueue.BuildLaneKey("itdos", "audit"));
        Assert.NotEqual(
            audit,
            Microi.net.BackgroundTaskWakeQueue.BuildLaneKey("junchi", "purchase"));
        Assert.Equal(
            Microi.net.BackgroundTaskSchedulingPolicy.LaneConcurrencyKey(" audit "),
            Microi.net.BackgroundTaskSchedulingPolicy.LaneConcurrencyKey("AUDIT"));
    }

    [Fact]
    public void HotLaneHints_ForceBoundedDurableRecovery()
    {
        var now = DateTime.UtcNow;
        Assert.False(Microi.net.BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
            15,
            now,
            now.AddSeconds(1)));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
            16,
            now,
            now.AddSeconds(1)));
        Assert.False(Microi.net.BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
            0,
            now,
            now));
        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
            1,
            now,
            now));
    }

    [Fact]
    public void AlternatingLaneHints_StillForceDurableRecovery()
    {
        var hintsSinceCompletedRecovery = 0;
        foreach (var ignoredLane in Enumerable.Range(0, 16)
                     .Select(index => index % 2 == 0 ? "audit" : "purchase"))
        {
            _ = ignoredLane;
            hintsSinceCompletedRecovery++;
        }

        Assert.True(Microi.net.BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
            hintsSinceCompletedRecovery,
            DateTime.UtcNow,
            DateTime.UtcNow.AddMinutes(1)));
    }

    [Fact]
    public async Task WorkerCleanupTimeout_ReleasesTheSlotWithoutWaitingForAStuckDependency()
    {
        var stuck = new TaskCompletionSource<object?>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        var completed = await Microi.net.BackgroundTaskService.WaitForWorkerCleanupAsync(
            stuck.Task,
            TimeSpan.FromMilliseconds(25));

        Assert.False(completed);
        stuck.SetResult(null);
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(3, false)]
    public void LeaseRenewal_RetriesTransientFailuresBeforeOwnershipExpires(
        int consecutiveFailures,
        bool expected)
    {
        Assert.Equal(
            expected,
            Microi.net.BackgroundTaskService.ShouldRetryRenewalFailure(consecutiveFailures));
    }

    [Fact]
    public async Task WorkerWakeQueue_CoalescesTenantHintsAndInterruptsTheFallbackWait()
    {
        var queue = new Microi.net.BackgroundTaskWakeQueue();
        var waiting = queue.WaitAsync(TimeSpan.FromSeconds(30), CancellationToken.None);

        queue.Signal("", "ignored");
        queue.Signal("junchi", "audit");
        queue.Signal("JUNCHI", "AUDIT");
        queue.Signal("junchi", "purchase");
        queue.SignalTenantRecovery("itdos");

        var completed = await Task.WhenAny(waiting, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.Same(waiting, completed);
        await waiting;
        Assert.Equal(3, queue.PendingLaneCount);
        Assert.True(queue.HasPendingTaskLane);
        Assert.True(queue.TryTake(out var hint));
        Assert.Equal("junchi", hint.OsClient, ignoreCase: true);
        Assert.Equal("audit", hint.ApiEngineKey, ignoreCase: true);
        Assert.True(queue.HasPending);
        Assert.True(queue.TryTake(out var secondHint));
        Assert.Equal("purchase", secondHint.ApiEngineKey, ignoreCase: true);
        Assert.False(queue.HasPendingTaskLane);
        Assert.True(queue.HasPending);
        Assert.True(queue.TryTake(out var recoveryHint));
        Assert.True(recoveryHint.IsTenantRecovery);
        Assert.Equal("itdos", recoveryHint.OsClient, ignoreCase: true);
        Assert.False(queue.TryTake(out _));
        Assert.False(queue.HasPending);
    }

    [Fact]
    public void InfrastructureDatabaseContention_GetsABoundedRetryBudgetIndependentOfBusinessAttempts()
    {
        var item = new Microi.net.BackgroundTaskRecord
        {
            MaxAttempts = 1,
            LastError = ""
        };
        var deadlock = new InvalidOperationException(
            "V8 wrapper",
            new Exception("Deadlock found when trying to get lock; try restarting transaction"));

        Assert.True(Microi.net.BackgroundTaskStore.ShouldRequeueInfrastructureContention(
            item,
            deadlock,
            out var firstAttempt));
        Assert.Equal(1, firstAttempt);

        item.LastError = "[InfrastructureContentionRetry:1] deadlock";
        Assert.True(Microi.net.BackgroundTaskStore.ShouldRequeueInfrastructureContention(
            item,
            deadlock,
            out var secondAttempt));
        Assert.Equal(2, secondAttempt);

        item.LastError = "[InfrastructureContentionRetry:2] deadlock";
        Assert.False(Microi.net.BackgroundTaskStore.ShouldRequeueInfrastructureContention(
            item,
            deadlock,
            out var exhaustedAttempt));
        Assert.Equal(3, exhaustedAttempt);

        item.LastError = "";
        Assert.False(Microi.net.BackgroundTaskStore.ShouldRequeueInfrastructureContention(
            item,
            new InvalidOperationException("Value cannot be null. (Parameter 'source')"),
            out _));
    }

    [Theory]
    [InlineData("ordinary_job", 90)]
    [InlineData("admin_build_sanitized_empty_database", 900)]
    [InlineData("ADMIN_BUILD_SANITIZED_EMPTY_DATABASE", 900)]
    public void EmptyDatabaseRelease_UsesLongerDatabaseAndRedisLease(
        string apiEngineKey,
        int expectedSeconds)
    {
        Assert.Equal(
            expectedSeconds,
            Microi.net.BackgroundTaskStore.ResolveLeaseSeconds(apiEngineKey));
    }

    [Fact]
    public void BackgroundTaskTimestamps_FitTheCrossDatabaseVarcharContract()
    {
        var value = new DateTime(2026, 8, 27, 17, 23, 45, 123, DateTimeKind.Utc)
            .AddTicks(4567);

        var serialized = Microi.net.BackgroundTaskStore.DbTime(value);

        Assert.Equal("2026-08-27 17:23:45.123", serialized);
        Assert.True(serialized.Length <= 25);
        Assert.True(string.CompareOrdinal(
            serialized,
            Microi.net.BackgroundTaskStore.DbTime(value.AddMilliseconds(1))) < 0);
    }

    [Fact]
    public void PostgreSqlBackgroundTaskSql_QuotesMixedCaseIdentifiersWithoutTouchingParametersOrLiterals()
    {
        var client = new Microi.net.OsClientSecret
        {
            OsClientModel = new Newtonsoft.Json.Linq.JObject
            {
                ["DbType"] = "PostgreSql"
            }
        };

        var sql = Microi.net.BackgroundTaskStore.QuoteSqlIdentifiers(
            client,
            "UPDATE mci_background_task SET AttemptCount=0,Msg='Id Status' " +
            "WHERE IsDeleted=0 AND RuntimeOsClientType=@runtimeType");

        Assert.Contains("UPDATE \"mci_background_task\"", sql);
        Assert.Contains("\"AttemptCount\"=0", sql);
        Assert.Contains("\"IsDeleted\"=0", sql);
        Assert.Contains("\"RuntimeOsClientType\"=@runtimeType", sql);
        Assert.Contains("\"Msg\"='Id Status'", sql);
        Assert.DoesNotContain("'\"Id\" \"Status\"'", sql);
    }

    [Fact]
    public void SqlServerBackgroundTaskSql_QuotesReservedProjectionAliases()
    {
        var client = new Microi.net.OsClientSecret
        {
            OsClientModel = new Newtonsoft.Json.Linq.JObject
            {
                ["DbType"] = "SqlServer"
            }
        };

        var sql = Microi.net.BackgroundTaskStore.QuoteSqlIdentifiers(
            client,
            "SELECT WorkCurrent AS Current,WorkTotal AS Total FROM mci_background_task " +
            "WHERE RuntimeOsClientType=@runtimeType AND Msg='Current Total'");

        Assert.Contains("[WorkCurrent] AS [Current]", sql);
        Assert.Contains("[WorkTotal] AS [Total]", sql);
        Assert.Contains("FROM [mci_background_task]", sql);
        Assert.Contains("[RuntimeOsClientType]=@runtimeType", sql);
        Assert.Contains("[Msg]='Current Total'", sql);
        Assert.DoesNotContain("'[Current] [Total]'", sql);
    }

    private static string FindServerRoot()
    {
        var repositoryRoot = Environment.GetEnvironmentVariable("MICROI_TEST_REPOSITORY_ROOT");
        if (!string.IsNullOrWhiteSpace(repositoryRoot))
        {
            var configuredServerRoot = Path.Combine(repositoryRoot, "Microi.Server");
            if (Directory.Exists(Path.Combine(configuredServerRoot, "Microi.Core"))
                && Directory.Exists(Path.Combine(configuredServerRoot, "Microi.net.Api")))
            {
                return configuredServerRoot;
            }
        }

        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Core"))
                && Directory.Exists(Path.Combine(directory.FullName, "Microi.net.Api")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Cannot find Microi.Server root.");
    }
}
