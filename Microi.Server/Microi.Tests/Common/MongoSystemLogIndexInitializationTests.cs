using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class MongoSystemLogIndexInitializationTests
{
    [Fact]
    public async Task SameCollection_UsesOneActiveInitializationFlight()
    {
        var key = "sys_log_test.log_" + Guid.NewGuid().ToString("N");
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var initializerCalls = 0;
        var registeredCallers = 0;
        const int callerCount = 24;

        Func<Task> initializer = async () =>
        {
            Interlocked.Increment(ref initializerCalls);
            await release.Task;
        };

        var callers = Enumerable.Range(0, callerCount).Select(async _ =>
        {
            var task = InvokeSingleFlight(key, initializer);
            Interlocked.Increment(ref registeredCallers);
            await task;
        }).ToArray();

        Assert.True(SpinWait.SpinUntil(
            () => Volatile.Read(ref registeredCallers) == callerCount,
            TimeSpan.FromSeconds(5)));
        Assert.Equal(1, Volatile.Read(ref initializerCalls));

        release.SetResult();
        await Task.WhenAll(callers);

        await InvokeSingleFlight(key, () =>
        {
            Interlocked.Increment(ref initializerCalls);
            return Task.CompletedTask;
        });
        Assert.Equal(2, Volatile.Read(ref initializerCalls));
    }

    [Fact]
    public async Task TransientFailure_RetriesWithinBoundAndCanRecover()
    {
        var attempts = 0;
        var finalException = await InvokeRetry(async () =>
        {
            await Task.Yield();
            if (Interlocked.Increment(ref attempts) < 3)
                throw new TimeoutException("temporary receive timeout");
        });

        Assert.Null(finalException);
        Assert.Equal(3, attempts);
    }

    [Fact]
    public async Task TransientFailure_InNonFirstAggregateBranchStillRetries()
    {
        var attempts = 0;
        var finalException = await InvokeRetry(() =>
        {
            if (Interlocked.Increment(ref attempts) < 2)
            {
                return Task.FromException(new AggregateException(
                    new InvalidOperationException("first permanent-looking branch"),
                    new TimeoutException("second transient branch")));
            }
            return Task.CompletedTask;
        });

        Assert.Null(finalException);
        Assert.Equal(2, attempts);
    }

    [Fact]
    public async Task PermanentFailure_IsReturnedWithoutRetryingOrThrowing()
    {
        var attempts = 0;
        var expected = new InvalidOperationException("invalid index definition");

        var finalException = await InvokeRetry(() =>
        {
            Interlocked.Increment(ref attempts);
            return Task.FromException(expected);
        });

        Assert.Same(expected, finalException);
        Assert.Equal(1, attempts);
    }

    [Fact]
    public void FailureSummary_IncludesInnerTypeAndRedactsCredentials()
    {
        var exception = new InvalidOperationException(
            "outer password=plain-text",
            new IOException("failed mongodb://reader:super-secret@mongo.internal:27017/database"));

        var summary = InvokeSafeSummary(exception);

        Assert.Contains("InvalidOperationException", summary);
        Assert.Contains("IOException", summary);
        Assert.Contains("password=***", summary);
        Assert.Contains("mongodb://***", summary);
        Assert.DoesNotContain("mongo.internal", summary);
        Assert.DoesNotContain("plain-text", summary);
        Assert.DoesNotContain("super-secret", summary);
    }

    [Fact]
    public void FailureSummary_RedactsQuotedMicroiAliasesPathsAndControlCharacters()
    {
        var exception = new InvalidOperationException(
            "index failed {\"AuthSecret\":\"auth-secret\",\"OsClientRedisPwd\":\"redis-secret\"," +
            "\"DiyToken\":\"token-secret\"}; C:\\private\\mongo.json; /etc/microi/mongo.json\u0001");

        var summary = InvokeSafeSummary(exception);

        Assert.DoesNotContain("auth-secret", summary);
        Assert.DoesNotContain("redis-secret", summary);
        Assert.DoesNotContain("token-secret", summary);
        Assert.DoesNotContain("C:\\private", summary);
        Assert.DoesNotContain("/etc/microi", summary);
        Assert.All(summary, character => Assert.False(char.IsControl(character)));
    }

    [Fact]
    public async Task CooldownSkipsImmediateNewFlightAndRateLimitsDiagnostic()
    {
        var key = "sys_log_test.cooldown_" + Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;
        var first = InvokeRegisterFailure(key, now);
        var second = InvokeRegisterFailure(key, now.AddSeconds(1));
        var initializerCalls = 0;

        await InvokeSingleFlight(key, () =>
        {
            Interlocked.Increment(ref initializerCalls);
            return Task.CompletedTask;
        });

        Assert.Equal(1, first.FailureCount);
        Assert.True(first.ShouldWriteDiagnostic);
        Assert.Equal(2, second.FailureCount);
        Assert.False(second.ShouldWriteDiagnostic);
        Assert.True(second.RetryNotBeforeUtc > first.RetryNotBeforeUtc);
        Assert.Equal(0, initializerCalls);

        var afterRateLimit = InvokeRegisterFailure(key, now.AddMinutes(2));
        Assert.True(afterRateLimit.ShouldWriteDiagnostic);
    }

    [Fact]
    public void CacheKeyIncludesNonReversibleEndpointFingerprint()
    {
        var first = InvokeCacheKey(new MongodbHost
        {
            Connection = "mongodb://reader:first-secret@mongo-a.internal:27017",
            DataBase = "sys_log_same",
            Table = "log_202609"
        });
        var second = InvokeCacheKey(new MongodbHost
        {
            Connection = "mongodb://reader:second-secret@mongo-b.internal:27017",
            DataBase = "sys_log_same",
            Table = "log_202609"
        });

        Assert.NotEqual(first, second);
        Assert.DoesNotContain("first-secret", first);
        Assert.DoesNotContain("mongo-a.internal", first);
        Assert.Contains("sys_log_same|log_202609", first);
    }

    private static Task InvokeSingleFlight(string cacheKey, Func<Task> initializer)
    {
        var method = GetPrivateStaticMethod("RunSysLogIndexSingleFlightAsync");
        return (Task)method.Invoke(null, new object[] { cacheKey, initializer })!;
    }

    private static async Task<Exception?> InvokeRetry(Func<Task> operation)
    {
        var method = GetPrivateStaticMethod("RunSysLogIndexOperationWithRetryAsync");
        var task = (Task<Exception?>)method.Invoke(null, new object[] { operation })!;
        return await task;
    }

    private static string InvokeSafeSummary(Exception exception)
    {
        var method = GetPrivateStaticMethod("BuildSafeExceptionSummary");
        return (string)method.Invoke(null, new object[] { exception })!;
    }

    private static string InvokeCacheKey(MongodbHost host)
    {
        var method = GetPrivateStaticMethod("BuildSysLogIndexCacheKey");
        return (string)method.Invoke(null, new object[] { host })!;
    }

    private static (int FailureCount, DateTime RetryNotBeforeUtc, bool ShouldWriteDiagnostic)
        InvokeRegisterFailure(string cacheKey, DateTime utcNow)
    {
        var method = GetPrivateStaticMethod("RegisterSysLogIndexFailure");
        var decision = method.Invoke(null, new object[] { cacheKey, utcNow })!;
        var type = decision.GetType();
        return (
            (int)type.GetProperty("FailureCount", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(decision)!,
            (DateTime)type.GetProperty("RetryNotBeforeUtc", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(decision)!,
            (bool)type.GetProperty("ShouldWriteDiagnostic", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(decision)!);
    }

    private static MethodInfo GetPrivateStaticMethod(string name)
    {
        return typeof(V8MongoDB).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)
               ?? throw new MissingMethodException(typeof(V8MongoDB).FullName, name);
    }
}
