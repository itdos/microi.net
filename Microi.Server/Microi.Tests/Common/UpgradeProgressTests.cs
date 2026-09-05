using Microi.net;

namespace Microi.Tests.Common;

public sealed class UpgradeProgressTests
{
    [Fact]
    public void TenantProgressRemainsVisibleThroughProductionConsoleFilter()
    {
        using var original = new StringWriter();
        var interceptor = new ConsoleLogInterceptor(original);
        using (UpgradeProgress.EnterTenant("tenant-two", 2, 300))
        {
            UpgradeProgress.Configure(new[] { "检查租户版本", "迁移" });
            UpgradeProgress.Complete("检查租户版本");
            interceptor.WriteLine("Microi：" + UpgradeProgress.Prefix() + " 租户数据库版本已是当前版本。");
        }
        Assert.Contains("租户2/300：tenant-two", original.ToString());
        Assert.Contains("本租户50.0%", original.ToString());
        Assert.Contains("升级点1/2", original.ToString());
    }

    [Fact]
    public void RealCheckpointsDetermineTenantAndBatchPercent()
    {
        var batch = new UpgradeProgress.Batch();
        using (UpgradeProgress.EnterTenant("one", 1, 2, batch))
        {
            UpgradeProgress.Configure(new[] { "read", "migrate" });
            UpgradeProgress.Begin("migrate");
            Assert.Equal(0, UpgradeProgress.Percent);
            UpgradeProgress.Complete("read");
            Assert.Equal(50, UpgradeProgress.Percent);
            Assert.Contains("总进度25.0%", UpgradeProgress.Prefix());
            Assert.Contains("租户1/2：one", UpgradeProgress.Prefix());
            UpgradeProgress.Complete("read");
            Assert.Equal(50, UpgradeProgress.Percent);
            UpgradeProgress.Complete("migrate");
            UpgradeProgress.FinishTenant(true);
        }
        using (UpgradeProgress.EnterTenant("two", 2, 2, batch))
        {
            Assert.Contains("总进度50.0%", UpgradeProgress.Prefix());
            UpgradeProgress.CompleteAll();
            Assert.Contains("总进度100.0%", UpgradeProgress.Prefix());
        }
    }

    [Fact]
    public void FailedAndCancelledTenantNeverPretendsAllStepsSucceeded()
    {
        var batch = new UpgradeProgress.Batch();
        using (UpgradeProgress.EnterTenant("failed", 1, 2, batch))
        {
            UpgradeProgress.Configure(new[] { "read", "write", "commit" });
            UpgradeProgress.Complete("read");
            UpgradeProgress.Begin("write");
            UpgradeProgress.FinishTenant(false);
            Assert.Equal(33, UpgradeProgress.Percent);
        }
        using (UpgradeProgress.EnterTenant("next", 2, 2, batch))
        {
            UpgradeProgress.CompleteAll();
            Assert.Contains("总进度66.7%", UpgradeProgress.Prefix());
            Assert.Equal(1, batch.Failed);
        }
    }

    [Fact]
    public void HundredsOfCurrentTenantsFinishWithExactBatchTotals()
    {
        var batch = new UpgradeProgress.Batch();
        for (var index = 1; index <= 300; index++)
        {
            using (UpgradeProgress.EnterTenant("tenant" + index, index, 300, batch))
            {
                UpgradeProgress.Configure(new[] { "read", "migration", "cache" });
                UpgradeProgress.CompleteAll();
                if (index == 300) Assert.Contains("总进度100.0%", UpgradeProgress.Prefix());
                UpgradeProgress.FinishTenant(true);
            }
        }
        Assert.Equal(300, batch.Succeeded);
        Assert.Equal(0, batch.Failed);
        Assert.Equal(900, batch.CompletedSteps);
        Assert.Equal(900, batch.TotalSteps);
    }

    [Fact]
    public async Task ConcurrentAsyncFlowsAndNestedScopesKeepTheirOwnTenant()
    {
        using (UpgradeProgress.EnterTenant("parent"))
        {
            var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var first = Task.Run(async () =>
            {
                using (UpgradeProgress.EnterTenant("child-one"))
                {
                    await ready.Task;
                    Assert.Contains("child-one", UpgradeProgress.Prefix());
                    Assert.DoesNotContain("child-two", UpgradeProgress.Prefix());
                }
            });
            var second = Task.Run(() =>
            {
                using (UpgradeProgress.EnterTenant("child-two"))
                {
                    ready.SetResult();
                    Assert.Contains("child-two", UpgradeProgress.Prefix());
                }
            });
            await Task.WhenAll(first, second);
            Assert.Contains("parent", UpgradeProgress.Prefix());
        }
        Assert.Contains("租户0/0", UpgradeProgress.Prefix());
    }
}
