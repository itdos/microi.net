using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class EmbeddedUpgradePackageInstallerTests
{
    private const string Package = "{\"ScheduleJobs\":[{\"JobName\":\"sample\",\"ApiEngineKey\":\"sample-worker\",\"CronExpression\":\"0 * * * * ?\",\"OsClient\":\"foreign\",\"DllName\":\"bad\",\"JobType\":\"99\"}]}";

    [Fact]
    public async Task ResourcesCommitBeforeJobs_AndVersionWaitsForAllReadbacks()
    {
        var calls = new List<string>();
        async Task<object> Execute(string stage)
        {
            await Task.Yield(); calls.Add(stage);
            return stage == "Resources"
                ? JObject.Parse("{Code:1,Data:{EmbeddedUpgrade:{Stage:'ScheduleJobs'}}}")
                : new DosResult(1);
        }
        var result = await EmbeddedUpgradePackageInstaller.RunAsync(Package, Execute, job =>
        {
            Assert.Equal(new[] { "Resources" }, calls);
            Assert.Equal("1", job.Value<string>("JobType"));
            Assert.Null(job["OsClient"]); Assert.Null(job["DllName"]);
            calls.Add("QuartzAndMetadataReadback");
            return Task.FromResult(new DosResult<object>(1));
        }, () => { });
        Assert.Null(UpgradeAppStore.GetInstallFailureMessage(result));
        Assert.Equal(new[] { "Resources", "QuartzAndMetadataReadback", "Finalize" }, calls);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailedOrOldImporterCannotRegisterJobs(bool oldImporter)
    {
        var registered = false;
        var result = await EmbeddedUpgradePackageInstaller.RunAsync(Package,
            _ => Task.FromResult<object>(new DosResult(oldImporter ? 1 : 0, null, "failed")),
            _ => { registered = true; return Task.FromResult(new DosResult<object>(1)); }, () => { });
        Assert.False(registered);
        Assert.NotNull(UpgradeAppStore.GetInstallFailureMessage(result));
    }

    [Fact]
    public async Task JobFailureDoesNotFinalize_AndReplayUsesTheSameJobIdentity()
    {
        var names = new List<string>(); var stages = new List<string>();
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var result = await EmbeddedUpgradePackageInstaller.RunAsync(Package, stage =>
            {
                stages.Add(stage);
                return Task.FromResult<object>(JObject.Parse("{Code:1,Data:{EmbeddedUpgrade:{Stage:'ScheduleJobs'}}}"));
            }, job => { names.Add(job.Value<string>("JobName")!); return Task.FromResult(new DosResult<object>(0, null, "readback failed")); }, () => { });
            Assert.Contains("readback failed", UpgradeAppStore.GetInstallFailureMessage(result));
        }
        Assert.Equal(new[] { "sample", "sample" }, names);
        Assert.Equal(new[] { "Resources", "Resources" }, stages);
    }

    [Fact]
    public async Task LostLeaseStopsBeforeScheduling_AndNoJobPackagesKeepSingleCall()
    {
        var checks = 0;
        await Assert.ThrowsAsync<InvalidOperationException>(() => EmbeddedUpgradePackageInstaller.RunAsync(Package,
            _ => Task.FromResult<object>(JObject.Parse("{Code:1,Data:{EmbeddedUpgrade:{Stage:'ScheduleJobs'}}}")),
            _ => throw new Xunit.Sdk.XunitException("stale owner scheduled a job"),
            () => { if (++checks == 2) throw new InvalidOperationException("lease lost"); }));
        var calls = 0;
        await EmbeddedUpgradePackageInstaller.RunAsync("{}", phase => { Assert.Null(phase); calls++; return Task.FromResult<object>(new DosResult(1)); },
            _ => throw new Xunit.Sdk.XunitException("unexpected job"), () => { });
        Assert.Equal(1, calls);
    }
}
