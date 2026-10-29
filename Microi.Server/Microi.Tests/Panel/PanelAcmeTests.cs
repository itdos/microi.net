using Microi.Panel;
using Microi.Panel.Panel;
using Microsoft.AspNetCore.DataProtection;

namespace Microi.Tests.Panel;

public sealed class PanelAcmeTests
{
    [Theory]
    [InlineData("../unrelated", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "../unrelated")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    public void AccountRecoveryRejectsUntrustedArchiveIdentity(string operationId,string accountHash)
        =>Assert.Throws<OpsException>(()=>PanelAcme.AccountArchiveCommand(new(){Id="acme-test",DirectoryUrl="https://ca.example.test/dir"},operationId,accountHash));

    [Fact]
    public void AccountRecoveryArchiveRemainsInsideTheSameAccountState()
    {
        var registration=new PanelAcmeRegistration{Id="acme-test",DirectoryUrl="https://ca.example.test:14000/dir"};
        var command=PanelAcme.AccountArchiveCommand(registration,new string('a',32),new string('b',64));
        Assert.Equal(PanelAcme.AccountPath(registration),command[3]);
        Assert.Equal(PanelAcme.StatePath(registration)+"/unregistered-"+new string('a',32),command[4]);
        Assert.Equal(new string('b',64),command[5]);
    }
    [Theory]
    [InlineData("LetsEncrypt", "47.97.181.34")]
    [InlineData("LetsEncryptStaging", "203.0.113.10")]
    [InlineData("LetsEncrypt", "2001:db8::10")]
    public void PublicIpCertificatesSelectRequiredShortLivedProfileForIssueAndRenewal(string provider,string address)
    {
        // 初签和定时续期共用 run；公开 IP 必须选择 CA 要求的短周期 profile，不能靠默认策略猜测。
        var registration=new PanelAcmeRegistration{Id="acme-ip",Provider=provider,DirectoryUrl=PanelAcme.Directory(provider,""),Email="panel@example.test",Domains=["site.example.test",address]};
        var command=PanelAcme.Command(registration);
        var profile=Array.IndexOf(command,"--profile");
        Assert.True(profile>=0,"Public IP ACME requests must select the CA shortlived profile");
        Assert.Equal("shortlived",command[profile+1]);
        Assert.Equal("run",command[0]);Assert.DoesNotContain("--force",command);
    }
    [Theory]
    [InlineData("LetsEncrypt", "site.example.test")]
    [InlineData("LetsEncryptStaging", "site.example.test")]
    [InlineData("Custom", "203.0.113.10")]
    public void DnsOnlyAndCustomCaRequestsKeepTheirExistingProfilePolicy(string provider,string domain)
    {
        var registration=new PanelAcmeRegistration{Id="acme-profile",Provider=provider,DirectoryUrl=provider=="Custom"?"https://ca.example.test/dir":PanelAcme.Directory(provider,""),Email="panel@example.test",Domains=[domain]};
        Assert.DoesNotContain("--profile",PanelAcme.Command(registration));
    }
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
        using var directory = new PanelTestDirectory(); var root = directory.Root;
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
        using var directory = new PanelTestDirectory(); var root = directory.Root;
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

    [Fact]
    public void RenewalRetryBackoffIsBoundedByExpiryAndChecksAriAtLeastTwiceDaily()
    {
        var now=DateTimeOffset.UtcNow;
        var longLived=new PanelCertificate{NotBefore=now.AddDays(-10),NotAfter=now.AddDays(80)};
        Assert.InRange((PanelRepository.NextAcmeCheck("ari",longLived,0,now)-now).TotalHours,11,12);
        var first=PanelRepository.NextAcmeCheck("retry",longLived,1,now);
        var second=PanelRepository.NextAcmeCheck("retry",longLived,2,now);
        Assert.InRange((first-now).TotalSeconds,300,330);Assert.InRange((second-now).TotalSeconds,600,660);
        Assert.InRange((PanelRepository.NextAcmeCheck("retry",longLived,30,now)-now).TotalHours,6,6.6);
        longLived.NotAfter=now.AddMinutes(2);
        Assert.InRange((PanelRepository.NextAcmeCheck("retry",longLived,30,now)-now).TotalSeconds,30,33);
    }

    [Fact]
    public async Task RestartRetriesSameFailedDeploymentAndRetainsIssuedCertificateCheckpoint()
    {
        using var directory=new PanelTestDirectory();var options=new OpsOptions{DataDir=directory.Root,LogDir=directory.Root};
        using var store=new OpsStore(options);var protection=new EphemeralDataProtectionProvider();
        var repo=new PanelRepository(options,store,protection);
        var resource=PanelCatalog.Prepare(new(){Name="gateway",PluginId="nginx",Version="1.30.4"},repo.OwnerId);
        var install=repo.Enqueue("Install",Guid.NewGuid().ToString(),resource,"tester");install.State="Succeeded";repo.SaveOperation(install);resource.State="Installed";repo.SaveResource(resource);
        var registration=new PanelAcmeRegistration{Id="acme-retry",Revision="first",ResourceId=resource.Id,AutoRenew=true,NextCheck=DateTimeOffset.UtcNow.AddMinutes(-1)};
        repo.SaveBackupState("acme:"+registration.Id,registration);
        var operation=repo.EnqueueAcmeRenewal(registration);operation.State="Failed";repo.SaveOperation(operation);
        repo.SaveBackupState("acme-execution:"+operation.Id,new AcmeExecution{Stage="Deploying",Change=new(){Revision="r"+operation.Id,PreviousRevision=resource.ConfigRevision}});
        repo.CompleteAcme(registration.Id,operation.Id,"reload unavailable");
        var failed=Assert.Single(repo.AcmeRegistrations());Assert.Equal(1,failed.ConsecutiveFailures);Assert.Equal("Failed",failed.LastOutcome);
        failed.NextCheck=DateTimeOffset.UtcNow.AddSeconds(-1);repo.SaveBackupState("acme:"+failed.Id,failed);
        var restarted=new PanelRepository(options,store,protection);
        var due=Assert.Single(restarted.AcmeRegistrations());
        var retries=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>Task.Run(()=>restarted.EnqueueAcmeRenewal(due))));
        var retry=retries[0];Assert.All(retries,x=>Assert.Equal(operation.Id,x.Id));
        Assert.Equal(operation.Id,retry.Id);Assert.Equal("Queued",retry.State);Assert.Single(restarted.Operations(true));
        Assert.Equal("Deploying",restarted.BackupState<AcmeExecution>("acme-execution:"+retry.Id)!.Stage);
        restarted.CompleteAcme(failed.Id,retry.Id,"","Deployed","new-fingerprint");
        var completed=Assert.Single(restarted.AcmeRegistrations());Assert.Equal(0,completed.ConsecutiveFailures);Assert.Equal("new-fingerprint",completed.LastCertificateThumbprint);Assert.NotNull(completed.LastRenewed);
        var renewed=completed.LastRenewed;
        restarted.CompleteAcme(failed.Id,retry.Id,"","Unchanged","new-fingerprint");
        completed=Assert.Single(restarted.AcmeRegistrations());Assert.Equal(renewed,completed.LastRenewed);Assert.Equal("Unchanged",completed.LastOutcome);
        restarted.CompleteAcme(failed.Id,"older-operation","late failure");
        Assert.Empty(Assert.Single(restarted.AcmeRegistrations()).LastError);
    }

    [Fact]
    public void PausedOrChangedPolicyCannotAutomaticallyResumeAFailedIssuance()
    {
        using var directory=new PanelTestDirectory();var options=new OpsOptions{DataDir=directory.Root,LogDir=directory.Root};
        using var store=new OpsStore(options);var repo=new PanelRepository(options,store,new EphemeralDataProtectionProvider());
        var resource=PanelCatalog.Prepare(new(){Name="gateway",PluginId="nginx",Version="1.30.4"},repo.OwnerId);
        var install=repo.Enqueue("Install",Guid.NewGuid().ToString(),resource,"tester");install.State="Succeeded";repo.SaveOperation(install);resource.State="Installed";repo.SaveResource(resource);
        var registration=new PanelAcmeRegistration{Id="acme-pause",Revision="first",ResourceId=resource.Id,AutoRenew=true,NextCheck=DateTimeOffset.UtcNow.AddMinutes(-1)};
        repo.SaveBackupState("acme:"+registration.Id,registration);
        var operation=repo.EnqueueAcmeRenewal(registration);operation.State="Failed";repo.SaveOperation(operation);
        var stale=Assert.Single(repo.AcmeRegistrations());stale.NextCheck=DateTimeOffset.UtcNow.AddSeconds(-1);repo.SaveBackupState("acme:"+stale.Id,stale);
        repo.SaveAcmePolicy(stale.Id,new(stale.Revision,false,stale.Id));
        Assert.Throws<OpsException>(()=>repo.EnqueueAcmeRenewal(stale));Assert.Empty(repo.Operations(true));
        Assert.Equal("Failed",repo.Operation(operation.Id).State);
    }

    [Fact]
    public void PreflightFailureRecoversAfterRestartOncePerDurableAttempt()
    {
        using var directory=new PanelTestDirectory();var options=new OpsOptions{DataDir=directory.Root,LogDir=directory.Root};
        using var store=new OpsStore(options);var protection=new EphemeralDataProtectionProvider();var repo=new PanelRepository(options,store,protection);
        var registration=new PanelAcmeRegistration{Id="acme-external",Revision="first",ResourceId="host-nginx-test",Target="External",AutoRenew=true,NextCheck=DateTimeOffset.UtcNow.AddSeconds(-1)};
        repo.SaveBackupState("acme:"+registration.Id,registration);
        var operation=repo.EnqueueAcmeRenewal(registration);operation.State="Failed";operation.Error="Docker unavailable";repo.SaveOperation(operation);
        var queued=Assert.Single(repo.AcmeRegistrations());Assert.Equal(1,queued.Attempt);Assert.Equal(0,queued.CompletedAttempt);
        var restarted=new PanelRepository(options,store,protection);
        Assert.True(restarted.RecoverAcmePreflightFailure(queued));Assert.False(restarted.RecoverAcmePreflightFailure(queued));
        var failed=Assert.Single(restarted.AcmeRegistrations());Assert.Equal(1,failed.ConsecutiveFailures);
        Assert.InRange((failed.NextCheck-DateTimeOffset.UtcNow).TotalSeconds,290,330);
        var retry=restarted.Retry(operation.Id);Assert.Equal(2,Assert.Single(restarted.AcmeRegistrations()).Attempt);
        retry.State="Failed";retry.Error="Docker still unavailable";restarted.SaveOperation(retry);
        Assert.False(restarted.RecoverAcmePreflightFailure(queued));
        Assert.True(restarted.RecoverAcmePreflightFailure(Assert.Single(restarted.AcmeRegistrations())));
        Assert.Equal(2,Assert.Single(restarted.AcmeRegistrations()).ConsecutiveFailures);
        Assert.Empty(restarted.Resources()); // External identity never becomes a managed plugin instance.
    }

    [Theory]
    [InlineData("/www/site")]
    [InlineData("/www/site/.microi-acme-short")]
    [InlineData("/www/../site/.microi-acme-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    [InlineData("C:\\site\\.microi-acme-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    public void ExternalHelperNeverMountsAnArbitraryOrWholeSiteDirectory(string path)
        =>Assert.Throws<OpsException>(()=>PanelAcme.ValidateChallengePath(path));

    [Fact]
    public void ExternalDeploymentRequiresActualFingerprintAndManagedReceiptCoversEverySni()
    {
        PanelAcme.ValidateChallengePath("/www/site/.microi-acme-"+new string('a',64));
        using var key=System.Security.Cryptography.ECDsa.Create();
        var request=new System.Security.Cryptography.X509Certificates.CertificateRequest("CN=example.test",key,System.Security.Cryptography.HashAlgorithmName.SHA256);
        var san=new System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder();san.AddDnsName("example.test");request.CertificateExtensions.Add(san.Build());
        using var leaf=request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1),DateTimeOffset.UtcNow.AddDays(1));
        var certificate=PanelCertificate.Import("test","test",leaf.ExportCertificatePem(),key.ExportPkcs8PrivateKeyPem());
        var registration=new PanelAcmeRegistration{InstanceFingerprint=new string('f',64)};
        var receipt=new System.Text.Json.Nodes.JsonObject{["verified"]=true,["fingerprint"]=registration.InstanceFingerprint,["configSha256"]=new string('c',64),["certificateSha256"]=PanelAcme.CertificateSha256(certificate)};
        PanelAcme.ValidateExternalDeployment(receipt,registration,certificate);
        receipt["certificateSha256"]=new string('0',64);Assert.Throws<OpsException>(()=>PanelAcme.ValidateExternalDeployment(receipt,registration,certificate));
        var expected=new[]{new HostNginxTlsDomain("example.test",new string('a',64)),new HostNginxTlsDomain("second.test",new string('b',64))};
        var tls=new System.Text.Json.Nodes.JsonObject{["verified"]=true,["certificates"]=new System.Text.Json.Nodes.JsonArray(
            new System.Text.Json.Nodes.JsonObject{["serverName"]="example.test",["sha256"]=expected[0].CertificateSha256},
            new System.Text.Json.Nodes.JsonObject{["serverName"]="second.test",["sha256"]=expected[1].CertificateSha256})};
        NginxService.ValidateCertificateReceipt(tls,expected);
        tls["certificates"]![1]!["sha256"]=expected[0].CertificateSha256;Assert.Throws<OpsException>(()=>NginxService.ValidateCertificateReceipt(tls,expected));
        tls["verified"]="true";Assert.Throws<OpsException>(()=>NginxService.ValidateCertificateReceipt(tls,expected));
    }

    [Fact]
    public async Task PausingQueuedExternalRenewalStopsBeforeHostOrDockerSideEffects()
    {
        using var directory=new PanelTestDirectory();var options=new OpsOptions{DataDir=directory.Root,LogDir=directory.Root};
        using var store=new OpsStore(options);var repo=new PanelRepository(options,store,new EphemeralDataProtectionProvider());
        var registration=new PanelAcmeRegistration{Id="acme-pause-external",Revision="first",ResourceId="host-nginx-test",Target="External",AutoRenew=true,NextCheck=DateTimeOffset.UtcNow.AddSeconds(-1)};
        repo.SaveBackupState("acme:"+registration.Id,registration);
        var operation=repo.EnqueueAcmeRenewal(registration);
        repo.SaveAcmePolicy(registration.Id,new(registration.Revision,false,registration.Id));
        var executor=new PanelAcme(repo,null!,null!);
        var error=await Assert.ThrowsAsync<OpsException>(()=>executor.ExecuteExternal(operation,CancellationToken.None));
        Assert.Contains("暂停",error.Message);Assert.False(Assert.Single(repo.AcmeRegistrations()).AutoRenew);
        Assert.Empty(repo.Resources());Assert.Empty(repo.Certificates());
    }
}
