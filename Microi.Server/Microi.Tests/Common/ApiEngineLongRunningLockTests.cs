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
        Assert.Equal(TimeSpan.FromMinutes(20), lockParam.Expiry);
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
        Assert.Equal(TimeSpan.Zero, lockParam.MaxLeaseDuration);
    }

    [Fact]
    public void BackgroundLock_NeverShortensExplicitlyLongerExpiry()
    {
        var createMethod = typeof(ApiEngine).GetMethod(
            "CreateExecutionLockParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(createMethod);

        var lockParam = Assert.IsType<MicroiLockParam>(createMethod!.Invoke(
            null,
            new object?[] { "long-api", "iTdos", 13 * 60 * 60, true, CancellationToken.None }));
        Assert.Equal(TimeSpan.FromHours(13), lockParam.Expiry);
        Assert.Equal(lockParam.Expiry, lockParam.MaxLeaseDuration);
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
