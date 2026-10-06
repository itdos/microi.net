using Microi.FixedStep;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;

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

    private sealed class Registrar(CompiledRulesBinding binding):ITrustedRulesRegistrar
    {
        public IEnumerable<CompiledRulesBinding> Registrations {get{yield return binding;}}
    }
}
