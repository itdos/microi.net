using Microi.Panel;
using Microi.Panel.Panel;
using Microsoft.AspNetCore.DataProtection;

namespace Microi.Tests.Panel;

public sealed class PanelAcmeTests
{
    [Fact]
    public void CaDomainFailureRemainsDiagnosableWhileCredentialsRemainRedacted()
    {
        var text=Redaction.Clean("invalid authorization: acme: error: 400 :: urn:ietf:params:acme:error:connection :: could not resolve URL https://example.test\nAuthorization: Bearer secret-value\npassword=another-value");
        Assert.Contains("could not resolve URL",text);Assert.Contains("urn:ietf:params:acme:error:connection",text);
        Assert.DoesNotContain("secret-value",text);Assert.DoesNotContain("another-value",text);
        Assert.DoesNotContain("credential-value",Redaction.Clean("invalid authorization: credential-value"));
    }
    [Fact]
    public void ContainerLogQueryConvertsEngineTimestampWithoutLosingRetryBoundary()
    {
        Assert.Equal("1788984612.1122620",DockerEngine.LogTimestamp("2026-09-09T20:10:12.112261958Z"));
        Assert.Equal("1788984612.1122619",DockerEngine.LogTimestamp("2026-09-10T04:10:12.1122619+08:00"));
        Assert.Throws<OpsException>(()=>DockerEngine.LogTimestamp("not-a-timestamp"));
    }
    [Fact]
    public void GeneratedCertificateIdFitsTheSamePolicyAsManualCertificates()
    {
        var id=PanelAcme.CertificateId("panel-owner","gateway","application");
        Assert.Equal(id,PanelCatalog.SafeName(id));Assert.Matches("^acme-[a-f0-9]{24}$",id);
        Assert.Contains(id,PanelAcme.StatePath(new(){Id=id,DirectoryUrl="https://ca.example.test/dir"}));
    }
    [Fact]
    public void IncompleteAccountRecoveryRequiresExplicitCaRejectionAndNoRegistrationReceipt()
    {
        var registration=new PanelAcmeRegistration{Id="acme-test",DirectoryUrl="https://ca.example.test:14000/dir"};
        var account=new System.Text.Json.Nodes.JsonObject{["id"]=registration.Id,["server"]=registration.DirectoryUrl,["registration"]=null};
        const string missing="urn:ietf:params:acme:error:accountDoesNotExist";
        Assert.True(PanelAcme.CanRecoverUnregisteredAccount(missing,account,registration));
        Assert.False(PanelAcme.CanRecoverUnregisteredAccount("network timeout",account,registration));
        account["registration"]=new System.Text.Json.Nodes.JsonObject{["status"]="valid"};
        Assert.False(PanelAcme.CanRecoverUnregisteredAccount(missing,account,registration));
        Assert.Contains("--account-id",PanelAcme.RegisterCommand(registration));
        Assert.Equal("register",PanelAcme.RegisterCommand(registration)[1]);
        Assert.EndsWith("/accounts/ca.example.test_14000/acme-test",PanelAcme.AccountPath(registration));
    }
    [Fact]
    public void DockerCertificateArchiveIsDecodedBeforeParsingPem()
    {
        var bytes=System.Text.Encoding.UTF8.GetBytes("-----BEGIN CERTIFICATE-----\npublic-pem\n-----END CERTIFICATE-----");
        using var archive=new MemoryStream();
        using(var writer=new System.Formats.Tar.TarWriter(archive,leaveOpen:true))
            writer.WriteEntry(new System.Formats.Tar.PaxTarEntry(System.Formats.Tar.TarEntryType.RegularFile,"test.crt"){DataStream=new MemoryStream(bytes)});
        Assert.Equal(bytes,DockerEngine.SingleArchiveFile(archive.ToArray(),"test.crt",1024));
        Assert.Throws<OpsException>(()=>DockerEngine.SingleArchiveFile(archive.ToArray(),"other.crt",1024));
        Assert.Throws<OpsException>(()=>DockerEngine.SingleArchiveFile(archive.ToArray(),"test.crt",8));
    }
    [Theory]
    [InlineData("http://ca.example.test/directory")]
    [InlineData("https://user:secret@ca.example.test/directory")]
    [InlineData("https://ca.example.test/directory#fragment")]
    [InlineData("https://ca.example.test/directory?secret=value")]
    [InlineData("https://ca.example.test/ newline")]
    public void CustomCaNeverDisablesTlsOrAcceptsCredentialsInUrl(string url)=>Assert.Throws<OpsException>(()=>PanelAcme.Directory("Custom",url));

    [Fact]
    public void CertificateCommandUsesExistingWebrootAndArgumentArray()
    {
        var registration=new PanelAcmeRegistration{Id="acme-example",Email="ops@example.test",DirectoryUrl=PanelAcme.Directory("LetsEncrypt",""),Domains=["app.example.test","www.example.test"]};
        var command=PanelAcme.Command(registration);Assert.Equal("run",command[0]);
        Assert.Contains("--http.webroot",command);Assert.Contains("/srv/panel/acme",command);
        Assert.Contains("--cert.name",command);Assert.Contains("acme-example",command);
        Assert.DoesNotContain("--tls-skip-verify",command);Assert.DoesNotContain("--renew-force",command);
        Assert.DoesNotContain("--deploy-hook",command);Assert.Equal(2,command.Count(x=>x=="--domains"));
        Assert.Contains("@sha256:",PanelAcme.LegoImage("amd64"));
        Assert.Throws<OpsException>(()=>PanelAcme.LegoImage("unverified-cpu"));
    }

    [Fact]
    public async Task RenewalSlotAndLedgerAdvanceAtomicallyAndPauseRejectsStaleWork()
    {
        var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../../.tmp/panel-20260910/tests",Guid.NewGuid().ToString("N")));
        var options=new OpsOptions{DataDir=root,LogDir=root};using var store=new OpsStore(options);var repo=new PanelRepository(options,store,new EphemeralDataProtectionProvider());
        var resource=PanelCatalog.Prepare(new(){Name="gateway",PluginId="nginx",Version="1.30.4"},repo.OwnerId);
        var install=repo.Enqueue("Install",Guid.NewGuid().ToString(),resource,"tester");install.State="Succeeded";repo.SaveOperation(install);resource.State="Installed";repo.SaveResource(resource);
        var registration=new PanelAcmeRegistration{Id=PanelAcme.CertificateId(repo.OwnerId,"gateway","site"),Revision="first",ResourceId="gateway",SiteId="site",Domains=["app.example.test"],Email="ops@example.test",
            Provider="LetsEncrypt",DirectoryUrl=PanelAcme.Directory("LetsEncrypt",""),AutoRenew=true,NextCheck=DateTimeOffset.UtcNow.AddMinutes(-1)};
        repo.SaveBackupState("acme:"+registration.Id,registration);
        var operations=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>Task.Run(()=>repo.EnqueueAcmeRenewal(registration))));
        Assert.All(operations,x=>Assert.Equal(operations[0].Id,x.Id));Assert.Single(repo.Operations(true));
        var current=Assert.Single(repo.AcmeRegistrations());Assert.Equal(operations[0].Id,current.LastOperationId);Assert.True(current.NextCheck>DateTimeOffset.UtcNow);
        var done=operations[0];done.State="Succeeded";repo.SaveOperation(done);
        repo.SaveAcmePolicy(current.Id,new(current.Revision,false,current.Id));
        var paused=Assert.Single(repo.AcmeRegistrations());Assert.False(paused.AutoRenew);
        paused.NextCheck=DateTimeOffset.UtcNow.AddMinutes(-1);
        Assert.Throws<OpsException>(()=>repo.EnqueueAcmeRenewal(paused));Assert.Empty(repo.Operations(true));
    }

    [Fact]
    public void RejectedAcmeQueueCannotOverwritePolicyOrLoseRenewalSlot()
    {
        var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../../.tmp/panel-20260910/tests",Guid.NewGuid().ToString("N")));
        var options=new OpsOptions{DataDir=root,LogDir=root};using var store=new OpsStore(options);var repo=new PanelRepository(options,store,new EphemeralDataProtectionProvider());
        var resource=PanelCatalog.Prepare(new(){Name="gateway",PluginId="nginx",Version="1.30.4"},repo.OwnerId);repo.Enqueue("Install",Guid.NewGuid().ToString(),resource,"tester");resource.State="Installed";repo.SaveResource(resource);
        var registration=new PanelAcmeRegistration{Id="acme-test",Revision="one",ResourceId="gateway",AutoRenew=true,NextCheck=DateTimeOffset.UtcNow.AddMinutes(-1)};
        repo.SaveBackupState("acme:"+registration.Id,registration);
        Assert.Throws<OpsException>(()=>repo.EnqueueAcmeRenewal(registration));
        var current=Assert.Single(repo.AcmeRegistrations());Assert.Equal(registration.NextCheck,current.NextCheck);Assert.Empty(current.LastOperationId);
    }

    [Fact]
    public void ShortLivedCertificatesAreCheckedBeforeTheirRenewalWindowEnds()
    {
        var now=DateTimeOffset.UtcNow;var certificate=new PanelCertificate{NotBefore=now,NotAfter=now.AddMinutes(5)};
        var next=PanelRepository.NextAcmeCheck("acme-short",certificate);Assert.InRange((next-now).TotalSeconds,75,84);
    }
}
