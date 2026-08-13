namespace Dos.Common.Tests;

public sealed class BackgroundTaskWorkerSupervisionTests
{
    [Fact]
    public void Worker_IsRegisteredSupervisedObservableAndSchemaAware()
    {
        var serverRoot = FindServerRoot();
        var program = File.ReadAllText(Path.Combine(serverRoot, "Microi.net.Api", "Program.cs"));
        var worker = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Services",
            "BackgroundTaskWorkerService.cs"));
        var controller = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Controllers",
            "BackgroundTaskController.cs"));
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

        Assert.Contains("services.AddHostedService<BackgroundTaskWorkerService>()", program);
        Assert.Contains("while (!stoppingToken.IsCancellationRequested)", worker);
        Assert.Contains("BackgroundTaskWorkerRuntime.MarkFault(ex)", worker);
        Assert.Contains("BackgroundTaskWorkerRuntime.MarkHeartbeat", worker);
        Assert.Contains("LoopHealthy", worker);
        Assert.Contains("WorkerStatus", controller);
        Assert.Contains("BackgroundTaskService.GetWorkerReadiness()", controller);
        Assert.Contains("BackgroundTaskStore.TryGetAvailability", runtime);
        Assert.Contains("heartbeat?.Invoke()", runtime);
        Assert.Contains("RunningSlotCount", runtime);
        Assert.Contains("ReservedConfiguredTenantSlotCount", runtime);
        Assert.Contains("BackgroundTaskStore.TryClaimConfiguredTenant(NodeId, excludedApiEngineKey)", runtime);
        Assert.Contains("nonConfiguredRunning >= parallelism - 1", runtime);
        Assert.Contains("ReservedNonDiyLangSlotCount", runtime);
        Assert.Contains("ShouldReserveNonMaintenanceSlot", runtime);
        Assert.Contains("DiyLangBackgroundTaskService.ClusterConcurrencyKey", runtime);
        Assert.Contains("concurrencyLeaseOsClient = OsClientExtend.GetConfigOsClient()", runtime);
        Assert.Contains("ActiveTasks", runtime);
        Assert.Contains("CommandFlags.FireAndForget", runtime);
        Assert.Contains("WorkerRenewalShutdownTimedOut", runtime);
        Assert.Contains("WorkerLeaseRenewalFailed", runtime);
        Assert.Contains("ShouldRetryRenewalFailure", runtime);
        Assert.Contains("PendingNotifications", runtime);
        Assert.DoesNotContain("var current = BackgroundTaskStore.Get(item.OsClient, item.Id)", runtime);
        Assert.Contains("Msg='等待同一并发组的上一项任务完成'", store);
        Assert.Contains("AttemptCount>=MaxAttempts", store);
        Assert.Contains("任务已耗尽重试次数，系统已自动终结", store);
        Assert.Contains("ApiEngineKey<>@excludedApiEngineKey", store);
        Assert.Contains("Interlocked.Increment(ref _tenantScanCursor)", store);
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

    [Theory]
    [InlineData(1, 1, false)]
    [InlineData(2, 0, false)]
    [InlineData(2, 1, true)]
    [InlineData(3, 1, true)]
    [InlineData(4, 1, true)]
    [InlineData(4, 2, true)]
    public void LanguageMaintenance_CannotConsumeEveryWorkerSlot(
        int parallelism,
        int runningLanguageTasks,
        bool shouldReserve)
    {
        Assert.Equal(
            shouldReserve,
            Microi.net.BackgroundTaskService.ShouldReserveNonMaintenanceSlot(
                parallelism,
                runningLanguageTasks));
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

    private static string FindServerRoot()
    {
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
