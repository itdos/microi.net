using Microi.Panel;
using Microi.Panel.Panel;
using Microsoft.AspNetCore.DataProtection;

namespace Microi.Tests.Panel;
public sealed class PanelScheduleTests
{
    [Fact]
    public async Task ConcurrentScheduleTicksEnqueueOneTaskAndAdvanceSlotAtomically()
    {
        var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../../.tmp/panel-20260910/tests",Guid.NewGuid().ToString("N")));
        var options=new OpsOptions{DataDir=root,LogDir=root};using var store=new OpsStore(options);var repo=new PanelRepository(options,store,new EphemeralDataProtectionProvider());
        var resource=PanelCatalog.Prepare(new(){Name="cache",PluginId="redis",Version="7.4.11",Password="Schedule-Test-Password-592"},repo.OwnerId);
        var installed=repo.Enqueue("Install",Guid.NewGuid().ToString(),resource,"test");installed.State="Succeeded";repo.SaveOperation(installed);resource.State="Installed";repo.SaveResource(resource);
        var request=new PanelScheduleRequest("nightly","cache","Restart",true,24,DateTimeOffset.UtcNow.AddSeconds(-1),1,"","nightly",true);
        var schedule=repo.SaveSchedule(request);
        var tasks=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>Task.Run(()=>repo.EnqueueSchedule(schedule),TestContext.Current.CancellationToken)));
        Assert.Single(tasks.Select(x=>x.Id).Distinct());var saved=Assert.Single(repo.Schedules());Assert.Equal(tasks[0].Id,saved.LastOperationId);Assert.True(saved.NextRun>DateTimeOffset.UtcNow.AddHours(23));
        var reopened=new PanelRepository(options,store,new EphemeralDataProtectionProvider()); // 密钥不同的实例不允许读取旧任务配置。
        Assert.ThrowsAny<System.Security.Cryptography.CryptographicException>(()=>reopened.Schedules());
    }
    [Fact]
    public void DisabledAndStaleScheduleCannotCreateAnOperation()
    {
        var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../../.tmp/panel-20260910/tests",Guid.NewGuid().ToString("N")));
        var options=new OpsOptions{DataDir=root,LogDir=root};using var store=new OpsStore(options);var repo=new PanelRepository(options,store,new EphemeralDataProtectionProvider());
        var resource=PanelCatalog.Prepare(new(){Name="cache",PluginId="redis",Version="7.4.11",Password="Schedule-Test-Password-592"},repo.OwnerId);
        var installed=repo.Enqueue("Install",Guid.NewGuid().ToString(),resource,"test");installed.State="Succeeded";repo.SaveOperation(installed);resource.State="Installed";repo.SaveResource(resource);
        var request=new PanelScheduleRequest("nightly","cache","Backup",true,24,DateTimeOffset.UtcNow.AddSeconds(-1),1,"","nightly",true);var prior=repo.SaveSchedule(request);
        var disabled=repo.SaveSchedule(request with{Enabled=false,ExpectedRevision=prior.Revision});Assert.Throws<OpsException>(()=>repo.EnqueueSchedule(prior));Assert.Throws<OpsException>(()=>repo.EnqueueSchedule(disabled));
        Assert.Throws<OpsException>(()=>repo.SaveSchedule(request));Assert.Single(repo.Operations());
    }
}
