using Microi.FixedStep;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>真实DI组合与身份调用边界；主库与许可证能力以明确夹具替代，不读取或写入真实审批。</summary>
public sealed class FixedStepOfficialIdentityHostTests
{
    [Fact]
    public void Actual_host_registration_binds_existing_license_identity_adapter()
    {
        var services=new ServiceCollection();services.AddMicroiFixedStepRuntime();
        var descriptor=Assert.Single(services.Where(x=>x.ServiceType==typeof(IOfficialRulesPublisherIdentity)));
        Assert.Equal(typeof(LicenseOfficialRulesPublisherIdentity),descriptor.ImplementationType);
        using var provider=services.BuildServiceProvider();
        var identity=provider.GetRequiredService<IOfficialRulesPublisherIdentity>();
        Assert.IsType<LicenseOfficialRulesPublisherIdentity>(identity);
        // 不匹配官方租户短路，不触碰私钥文件；只证明真实宿主适配而不伪造官方身份成功。
        Assert.False(identity.IsOfficialPublisher("fixture-not-official"));
    }

    [Fact]
    public void Actual_di_store_rechecks_trusted_identity_and_primary_after_revocation()
    {
        var (row,binding)=FixedStepPublicationProofTests.Fixture();
        var reader=new Reader(row);var identity=new Identity();
        var services=new ServiceCollection();
        services.AddSingleton<ITrustedRulesRegistrar>(new Registrar(binding));
        services.AddSingleton<IPrimaryRulesInstallationReader>(reader);
        services.AddSingleton<IOfficialRulesPublisherIdentity>(identity);
        services.AddMicroiFixedStepRuntime();
        using var provider=services.BuildServiceProvider();
        var store=provider.GetRequiredService<IApprovedRulesInstallationStore>();
        Assert.Equal("fixture-app",store.ReadVerified("tenant","reg").Package.PackageKey);
        identity.Official=false;
        Assert.Equal("OfficialPublisherRequired",Assert.Throws<InvalidOperationException>(()=>store.ReadVerified("tenant","reg")).Message);
        Assert.Equal(2,identity.Calls);Assert.Equal(2,reader.Calls);Assert.Equal("tenant",identity.LastTenant);
    }

    [Fact]
    public void Old_two_argument_constructor_fails_closed_for_official_proof()
    {
        var (row,binding)=FixedStepPublicationProofTests.Fixture();
        var store=new SqlApprovedRulesInstallationStore(new CompiledRulesDeployments(new[]{new Registrar(binding)}),new Reader(row));
        Assert.Equal("OfficialPublisherRequired",Assert.Throws<InvalidOperationException>(()=>store.ReadVerified("tenant","reg")).Message);
    }

    [Fact]
    public void Identity_exception_cannot_reuse_previous_success()
    {
        var (row,binding)=FixedStepPublicationProofTests.Fixture();var identity=new Identity();var reader=new Reader(row);
        var store=new SqlApprovedRulesInstallationStore(new CompiledRulesDeployments(new[]{new Registrar(binding)}),reader,identity);
        store.ReadVerified("tenant","reg");identity.Throw=true;
        Assert.Equal("IdentityUnavailable",Assert.Throws<InvalidOperationException>(()=>store.ReadVerified("tenant","reg")).Message);
        Assert.Equal(2,identity.Calls);Assert.Equal(2,reader.Calls);
    }

    private sealed class Reader(JObject row):IPrimaryRulesInstallationReader
    {public int Calls;public JObject Read(string tenant,string registration){Calls++;return(JObject)row.DeepClone();}}
    private sealed class Identity:IOfficialRulesPublisherIdentity
    {public bool Official=true,Throw;public int Calls;public string LastTenant="";public bool IsOfficialPublisher(string tenant){Calls++;LastTenant=tenant;if(Throw)throw new InvalidOperationException("IdentityUnavailable");return Official;}}
    private sealed class Registrar(CompiledRulesBinding binding):ITrustedRulesRegistrar
    {public IEnumerable<CompiledRulesBinding> Registrations=>new[]{binding};}
}
