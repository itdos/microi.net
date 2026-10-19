using System.Reflection;
using Microi.net;
using StackExchange.Redis;

namespace Microi.Tests.Common;

public sealed class BackgroundTaskContinuationHandoffTests
{
    [Theory]
    [InlineData(0, true, 0)]
    [InlineData(-1, true, 0)]
    [InlineData(0, false, 1)]
    [InlineData(-1, false, 1)]
    [InlineData(3, true, 3)]
    [InlineData(3, false, 3)]
    [InlineData(9999, true, 3600)]
    public void OnlyConfirmedDefaultContinuationCanRunImmediately(int requested, bool confirmed, int expected)
    {
        Assert.Equal(expected, BackgroundTaskStore.ContinuationDelaySeconds(requested, confirmed));
    }

    [Fact]
    public async Task HandoffWaitsForRenewalBeforeReleasingEitherLease()
    {
        var renewal = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var events = new List<string>();
        var handoff = BackgroundTaskService.TryReleaseContinuationLeasesAsync(
            renewal.Task, () => events.Add("stop-renewal"),
            () => { events.Add("lane"); return Task.FromResult(true); },
            () => { events.Add("concurrency"); return Task.FromResult(true); });
        Assert.Equal(new[] { "stop-renewal" }, events);
        Assert.False(handoff.IsCompleted);
        renewal.SetResult();
        Assert.True(await handoff);
        Assert.Equal(new[] { "stop-renewal", "concurrency", "lane" }, events);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task EitherUnconfirmedLeaseKeepsTheProtectiveDelay(bool concurrency, bool lane)
    {
        var confirmed = await BackgroundTaskService.TryReleaseContinuationLeasesAsync(
            Task.CompletedTask, () => { }, () => Task.FromResult(lane), () => Task.FromResult(concurrency));
        Assert.False(confirmed);
        Assert.Equal(1, BackgroundTaskStore.ContinuationDelaySeconds(0, confirmed));
    }

    [Fact]
    public async Task ReleaseFailureFallsBackWithoutLosingTheContinuation()
    {
        Assert.False(await BackgroundTaskService.TryReleaseContinuationLeasesAsync(
            Task.CompletedTask, () => { }, () => Task.FromResult(true),
            () => Task.FromException<bool>(new IOException("redis unavailable"))));
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(0, false)]
    [InlineData(-1, false)]
    public async Task RedisAcknowledgementIsOwnerScopedAndNeverFireAndForget(long reply, bool expected)
    {
        var database = DispatchProxy.Create<IDatabase, RedisProxy>();
        var proxy = (RedisProxy)(object)database;
        proxy.Reply = Task.FromResult(RedisResult.Create(reply));
        var lease = new BackgroundTaskConcurrencyLease(database, "owned-lock", "unique-claim-owner", 90000);
        Assert.Equal(expected, await lease.ReleaseConfirmedAsync(TimeSpan.FromSeconds(1)));
        Assert.Contains("owner == ARGV[1]", proxy.Script);
        Assert.Equal("owned-lock", proxy.Keys![0].ToString());
        Assert.Equal("unique-claim-owner", proxy.Values![0].ToString());
        Assert.Equal(CommandFlags.None, proxy.Flags);
        lease.Dispose();
        Assert.Equal(expected ? 0 : 1, proxy.FallbackReleases);
    }

    [Fact]
    public async Task TimedOutAcknowledgementReturnsFalseAndObservesLateFailure()
    {
        var database = DispatchProxy.Create<IDatabase, RedisProxy>();
        var proxy = (RedisProxy)(object)database;
        var pending = new TaskCompletionSource<RedisResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        proxy.Reply = pending.Task;
        var lease = new BackgroundTaskConcurrencyLease(database, "owned-lock", "old-owner", 90000);
        Assert.False(await lease.ReleaseConfirmedAsync(TimeSpan.FromMilliseconds(20)));
        pending.SetException(new IOException("late transport failure"));
        lease.Dispose();
        Assert.Equal(1, proxy.FallbackReleases);
    }

    public class RedisProxy : DispatchProxy
    {
        public Task<RedisResult> Reply = Task.FromResult(RedisResult.Create(0L));
        public string? Script;
        public RedisKey[]? Keys;
        public RedisValue[]? Values;
        public CommandFlags Flags;
        public int FallbackReleases;

        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method?.Name == nameof(IDatabase.ScriptEvaluateAsync))
            {
                Script = (string)args![0]!;
                Keys = (RedisKey[])args[1]!;
                Values = (RedisValue[])args[2]!;
                Flags = (CommandFlags)args[3]!;
                return Reply;
            }
            if (method?.Name == nameof(IDatabase.ScriptEvaluate))
            {
                FallbackReleases++;
                return RedisResult.Create(1L);
            }
            throw new NotSupportedException(method?.Name);
        }
    }
}
