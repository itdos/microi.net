using Microi.net;
using StackExchange.Redis;

namespace Microi.Tests.FullStack;

[Trait("Category", "FullStack")]
[Trait("Suite", "BackgroundTaskHandoff")]
public sealed class BackgroundTaskHandoffRedisTests
{
    [Fact]
    public async Task ConfirmedReleaseAllowsSecondConnectionWithoutDeletingItsNewLease()
    {
        var address = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_REDIS");
        Assert.False(string.IsNullOrWhiteSpace(address), "Full requires the registered shared Redis fixture.");
        using var first = await ConnectionMultiplexer.ConnectAsync(address!);
        using var second = await ConnectionMultiplexer.ConnectAsync(address!);
        var key = "microi-test:background-handoff:" + Guid.NewGuid().ToString("N");
        var oldOwner = Guid.NewGuid().ToString("N");
        var nextOwner = Guid.NewGuid().ToString("N");
        var firstDb = first.GetDatabase();
        var secondDb = second.GetDatabase();
        try
        {
            Assert.True(await firstDb.StringSetAsync(key, oldOwner, TimeSpan.FromMinutes(1), When.NotExists));
            var oldLease = new BackgroundTaskConcurrencyLease(firstDb, key, oldOwner, 90000);
            Assert.True(await oldLease.ReleaseConfirmedAsync(TimeSpan.FromMilliseconds(500)));
            Assert.True(await secondDb.StringSetAsync(key, nextOwner, TimeSpan.FromMinutes(1), When.NotExists));
            oldLease.Dispose();
            Assert.Equal(nextOwner, (await secondDb.StringGetAsync(key)).ToString());

            // 旧持有者的迟到确认和兜底释放都不能移除另一连接的新租约。
            var staleLease = new BackgroundTaskConcurrencyLease(firstDb, key, oldOwner, 90000);
            Assert.False(await staleLease.ReleaseConfirmedAsync(TimeSpan.FromMilliseconds(500)));
            staleLease.Dispose();
            Assert.Equal(nextOwner, (await firstDb.StringGetAsync(key)).ToString());
            Assert.Equal(1, BackgroundTaskStore.ContinuationDelaySeconds(0, false));
        }
        finally
        {
            // 只删除本用例随机创建的 Key，不清空共享测试库。
            await firstDb.KeyDeleteAsync(key);
            Assert.False(await secondDb.KeyExistsAsync(key));
        }
    }
}
