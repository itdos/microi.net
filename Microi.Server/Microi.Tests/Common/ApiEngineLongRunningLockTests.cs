using System.Reflection;
using System.Threading;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ApiEngineLongRunningLockTests
{
    [Fact]
    public void TrustedBackgroundInvocation_UsesRenewableTwelveHourLockBoundary()
    {
        var trustedMethod = typeof(ApiEngine).GetMethod(
            "IsTrustedBackgroundLockInvocation",
            BindingFlags.Static | BindingFlags.NonPublic);
        var createMethod = typeof(ApiEngine).GetMethod(
            "CreateExecutionLockParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(trustedMethod);
        Assert.NotNull(createMethod);

        var request = new JObject { ["_BackgroundTaskId"] = "task-1" };
        var trusted = Assert.IsType<bool>(trustedMethod!.Invoke(
            null,
            new object?[] { true, request }));
        Assert.True(trusted);

        var lockParam = Assert.IsType<MicroiLockParam>(createMethod!.Invoke(
            null,
            new object?[] { "hongdi-dev", "chongstech", 1200, trusted, CancellationToken.None }));
        Assert.Equal(TimeSpan.FromMinutes(1), lockParam.Expiry);
        Assert.Equal(TimeSpan.FromMinutes(1), lockParam.AcquireTimeout);
        Assert.True(lockParam.AutoRenew);
        Assert.Equal(TimeSpan.FromHours(12), lockParam.MaxLeaseDuration);
    }

    [Fact]
    public void OrdinaryInvocation_PreservesHistoricalFixedTtlBehavior()
    {
        var trustedMethod = typeof(ApiEngine).GetMethod(
            "IsTrustedBackgroundLockInvocation",
            BindingFlags.Static | BindingFlags.NonPublic);
        var createMethod = typeof(ApiEngine).GetMethod(
            "CreateExecutionLockParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(trustedMethod);
        Assert.NotNull(createMethod);

        var trusted = Assert.IsType<bool>(trustedMethod!.Invoke(
            null,
            new object?[] { false, new JObject { ["_BackgroundTaskId"] = "caller-input" } }));
        Assert.False(trusted);

        var lockParam = Assert.IsType<MicroiLockParam>(createMethod!.Invoke(
            null,
            new object?[] { "short-api", "iTdos", 60, trusted, CancellationToken.None }));
        Assert.Equal(TimeSpan.FromMinutes(1), lockParam.Expiry);
        Assert.False(lockParam.AutoRenew);
        Assert.Equal(TimeSpan.Zero, lockParam.AcquireTimeout);
        Assert.Equal(TimeSpan.Zero, lockParam.MaxLeaseDuration);
    }

    [Fact]
    public void BackgroundLock_PreservesLongExecutionBudgetWithShortCrashRecovery()
    {
        var createMethod = typeof(ApiEngine).GetMethod(
            "CreateExecutionLockParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(createMethod);

        var lockParam = Assert.IsType<MicroiLockParam>(createMethod!.Invoke(
            null,
            new object?[] { "long-api", "iTdos", 13 * 60 * 60, true, CancellationToken.None }));
        Assert.Equal(TimeSpan.FromMinutes(1), lockParam.Expiry);
        Assert.Equal(TimeSpan.FromHours(13), lockParam.MaxLeaseDuration);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(30, 30)]
    [InlineData(60, 60)]
    [InlineData(3600, 60)]
    public void BackgroundLock_AbandonedLeaseAndAcquireWaitAreBounded(
        int executionSeconds, int recoverySeconds)
    {
        var createMethod = typeof(ApiEngine).GetMethod(
            "CreateExecutionLockParam", BindingFlags.Static | BindingFlags.NonPublic)!;
        using var cancellation = new CancellationTokenSource();
        var lockParam = Assert.IsType<MicroiLockParam>(createMethod.Invoke(
            null, new object?[] { "import-microi-store-package", "tenant", executionSeconds,
                true, cancellation.Token }));

        Assert.Equal(TimeSpan.FromSeconds(recoverySeconds), lockParam.Expiry);
        Assert.Equal(lockParam.Expiry, MicroiLock.ResolveAcquireTimeout(lockParam));
        Assert.True(MicroiLock.CalculateLeaseRenewIntervalMilliseconds(lockParam.Expiry)
            < lockParam.Expiry.TotalMilliseconds);
        Assert.Equal(cancellation.Token, lockParam.CancellationToken);
        Assert.Null(MicroiLock.ValidateLeaseConfiguration(lockParam));
    }

    [Fact]
    public void ApiEngineLockPath_UsesTrustedBackgroundRenewalHelpers()
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(),
            "Microi.Server",
            "Microi.net",
            "ApiEngine",
            "ApiEngine.cs"));

        Assert.Contains(
            "var renewableBackgroundTask = IsTrustedBackgroundLockInvocation(",
            source,
            StringComparison.Ordinal);
        Assert.Contains(
            "CreateExecutionLockParam(",
            source,
            StringComparison.Ordinal);
        Assert.Contains(
            "BackgroundApiLockMaximumDuration = TimeSpan.FromHours(12)",
            source,
            StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot(
        [System.Runtime.CompilerServices.CallerFilePath] string sourcePath = "")
    {
        DirectoryInfo? directory = new(Path.GetDirectoryName(sourcePath)!);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
