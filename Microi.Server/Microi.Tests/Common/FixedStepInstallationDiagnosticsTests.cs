using Microi.FixedStep;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>真实宿主的只读安装诊断必须可发现；不得靠任意脚本或放宽规则授权排错。</summary>
public sealed class FixedStepInstallationDiagnosticsTests
{
    [Fact]
    public void Actual_host_registers_read_only_installation_diagnostics()
    {
        var services=new ServiceCollection();services.AddMicroiFixedStepRuntime();
        Assert.Single(services.Where(s=>s.ServiceType.FullName=="Microi.FixedStep.FixedStepInstallationDiagnostics"));
        using var provider=services.BuildServiceProvider();
        Assert.True(provider.GetRequiredService<FixedStepInstallationDiagnostics>().Snapshot("tenant").Available);
    }

    [Fact]
    public void Empty_compiled_catalog_is_available_but_not_an_authorization_proof()
    {
        var monitor=new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(Array.Empty<ITrustedRulesRegistrar>()));
        var snapshot=monitor.Snapshot("tenant");
        Assert.Equal("fixed-step-installation/v1",snapshot.Protocol);Assert.True(snapshot.CurrentNodeOnly);
        Assert.False(snapshot.AuthorizationProof);Assert.Empty(snapshot.Registrations);
    }

    [Fact]
    public void Snapshot_is_tenant_isolated_and_does_not_construct_rules()
    {
        var (_,original)=FixedStepPublicationProofTests.Fixture();var calls=0;
        var binding=new CompiledRulesBinding(original.Tenant,original.RegistrationId,original.ApprovalDigest,original.EntryType,
            ()=>{calls++;return original.Factory();},original.ProofKind,original.PublicationSnapshotSha256);
        var registrar=new Registrar(binding);
        var monitor=new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(new[]{registrar}));
        Assert.Empty(monitor.Snapshot("other-tenant").Registrations);Assert.Empty(monitor.Snapshot("Tenant").Registrations);
        Assert.Equal("Pending",Assert.Single(monitor.Snapshot("tenant").Registrations).State);
        Assert.Equal(0,calls);
    }

    [Fact]
    public void Known_failure_and_success_keep_attempts_and_return_detached_snapshots()
    {
        var (_,binding)=FixedStepPublicationProofTests.Fixture();
        var monitor=new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(new[]{new Registrar(binding)}));
        monitor.RecordAttempt(binding,new InvalidOperationException("DependencyHashMismatch"));
        var failure=Assert.Single(monitor.Snapshot("tenant").Registrations);
        Assert.Equal("DependencyHashMismatch",failure.ErrorCode);Assert.Equal(1,failure.Attempts);Assert.Null(failure.LastRegisteredUtc);
        monitor.RecordAttempt(binding);var success=Assert.Single(monitor.Snapshot("tenant").Registrations);
        Assert.Equal("CatalogRegistered",success.State);Assert.Equal(2,success.Attempts);Assert.Null(success.ErrorCode);Assert.NotNull(success.LastRegisteredUtc);
        success.State="mutated";Assert.Equal("CatalogRegistered",Assert.Single(monitor.Snapshot("tenant").Registrations).State);
        Assert.Equal("RegistrationFailed",failure.State);
    }

    [Fact]
    public void Unknown_exception_text_and_paths_are_never_exposed()
    {
        var (_,binding)=FixedStepPublicationProofTests.Fixture();
        var monitor=new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(new[]{new Registrar(binding)}));
        monitor.RecordAttempt(binding,new InvalidOperationException("SELECT pwd FROM users; /private/key.pem; secret-token"));
        var json=JsonConvert.SerializeObject(monitor.Snapshot("tenant"));
        Assert.Contains("RegistrationFailed",json);Assert.DoesNotContain("SELECT",json);Assert.DoesNotContain("private/key",json);Assert.DoesNotContain("secret-token",json);
    }

    [Fact]
    public void Unknown_bindings_cannot_expand_the_compiled_diagnostic_catalog()
    {
        var (_,binding)=FixedStepPublicationProofTests.Fixture();
        var monitor=new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(Array.Empty<ITrustedRulesRegistrar>()));
        Assert.Equal("DiagnosticBindingUnknown",Assert.Throws<InvalidOperationException>(()=>monitor.RecordAttempt(binding)).Message);
        Assert.Empty(monitor.Snapshot("tenant").Registrations);
    }

    [Fact]
    public void Dependency_content_mismatch_reports_actual_trusted_identity_and_both_hashes()
    {
        var (monitor,binding,error)=DependencyFailure(true);
        Assert.Equal("DependencyHashMismatch",error.Message);
        monitor.RecordAttempt(binding,error);
        var snapshot=monitor.Snapshot("tenant");
        var row=JObject.FromObject(Assert.Single(snapshot.Registrations));
        Assert.Equal(binding.EntryType.Assembly.FullName,row["DependencyIdentity"]?.Value<string>());
        Assert.Equal(new string('0',64),row["DependencyExpectedSha256"]?.Value<string>());
        var actual=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(binding.EntryType.Assembly.Location))).ToLowerInvariant();
        Assert.Equal(actual,row["DependencyActualSha256"]?.Value<string>());
        Assert.Equal("ContentMismatch",row["DependencyFailureReason"]?.Value<string>());
        Assert.False(snapshot.AuthorizationProof);
        Assert.Empty(monitor.Snapshot("other-tenant").Registrations);
        Assert.DoesNotContain(binding.EntryType.Assembly.Location,JsonConvert.SerializeObject(snapshot));
    }

    [Fact]
    public void Dependency_missing_manifest_does_not_read_or_expose_unapproved_file_hash()
    {
        var (monitor,binding,error)=DependencyFailure(false);
        monitor.RecordAttempt(binding,error);
        var row=JObject.FromObject(Assert.Single(monitor.Snapshot("tenant").Registrations));
        Assert.Equal(binding.EntryType.Assembly.FullName,row["DependencyIdentity"]?.Value<string>());
        Assert.Equal("MissingManifest",row["DependencyFailureReason"]?.Value<string>());
        Assert.Null(row["DependencyExpectedSha256"]?.Value<string>());
        Assert.Null(row["DependencyActualSha256"]?.Value<string>());
        Assert.Equal("DependencyHashMismatch",row["ErrorCode"]?.Value<string>());
    }

    [Fact]
    public void Dependency_failure_metadata_cannot_be_forged_through_exception_data()
    {
        var (_,binding)=FixedStepPublicationProofTests.Fixture();
        var monitor=new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(new[]{new Registrar(binding)}));
        var error=new InvalidOperationException("DependencyHashMismatch");
        error.Data["DependencyIdentity"]="/private/token-secret.pem";
        error.Data["Microi.TrustedDependencyFailure.v1"]=new {DependencyIdentity="/private/token-secret.pem",DependencyActualSha256="secret-token"};
        monitor.RecordAttempt(binding,error);
        var row=JObject.FromObject(Assert.Single(monitor.Snapshot("tenant").Registrations));
        Assert.Null(row["DependencyIdentity"]?.Value<string>());
        Assert.Null(row["DependencyActualSha256"]?.Value<string>());
        Assert.DoesNotContain("token-secret",row.ToString());Assert.DoesNotContain("secret-token",row.ToString());
    }

    [Fact]
    public void Dependency_failure_witness_is_detached_and_cleared_after_success()
    {
        var (monitor,binding,error)=DependencyFailure(true);
        monitor.RecordAttempt(binding,error);
        var before=JObject.FromObject(Assert.Single(monitor.Snapshot("tenant").Registrations));
        Assert.Equal("ContentMismatch",before["DependencyFailureReason"]?.Value<string>());
        before["DependencyIdentity"]="forged";
        Assert.Equal(binding.EntryType.Assembly.FullName,JObject.FromObject(Assert.Single(monitor.Snapshot("tenant").Registrations))["DependencyIdentity"]?.Value<string>());
        monitor.RecordAttempt(binding);
        var after=JObject.FromObject(Assert.Single(monitor.Snapshot("tenant").Registrations));
        Assert.Equal("CatalogRegistered",after["State"]?.Value<string>());
        Assert.Null(after["DependencyIdentity"]?.Value<string>());Assert.Null(after["DependencyExpectedSha256"]?.Value<string>());
        Assert.Null(after["DependencyActualSha256"]?.Value<string>());Assert.Null(after["DependencyFailureReason"]?.Value<string>());
    }

    private static (FixedStepInstallationDiagnostics monitor,CompiledRulesBinding binding,InvalidOperationException error) DependencyFailure(bool manifestPresent)
    {
        // 真实Verifier在第一个已加载程序集处失败；测试不替换错误消息，也不运行尚未通过校验的规则工厂。
        var (row,binding)=FixedStepPublicationProofTests.Fixture();
        var receipt=RulesInstallationRecord.Verify(row,binding,true);
        receipt.DependencyClosureSha256.Clear();
        if(manifestPresent)receipt.DependencyClosureSha256[binding.EntryType.Assembly.FullName!]=new string('0',64);
        var error=Assert.Throws<InvalidOperationException>(()=>InstallationVerifier.Verify(new InstallationStore(receipt),binding.Tenant,binding.RegistrationId,binding.EntryType));
        return (new FixedStepInstallationDiagnostics(new CompiledRulesDeployments(new[]{new Registrar(binding)})),binding,error);
    }

    private sealed class InstallationStore(ApprovedInstallation receipt):IApprovedRulesInstallationStore
    {
        public ApprovedInstallation ReadVerified(string tenant,string registrationId)=>receipt;
    }

    private sealed class Registrar(CompiledRulesBinding binding):ITrustedRulesRegistrar
    {
        public IEnumerable<CompiledRulesBinding> Registrations {get{yield return binding;}}
    }
}
